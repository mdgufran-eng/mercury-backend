"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@mercury/core");
const saxes_1 = require("saxes");
const stream_1 = require("stream");
const adminTmRoutes = async (fastify) => {
    // GET /admin/api/tm?sourceLang=EN&targetLang=FR&q=hello&limit=50&skip=0
    fastify.get('/admin/api/tm', async (request, reply) => {
        const q = request.query;
        const filter = {};
        if (q.sourceLang)
            filter['sourceLanguage'] = q.sourceLang.toUpperCase();
        if (q.targetLang)
            filter['targetLanguage'] = q.targetLang.toLowerCase();
        if (q.q) {
            // Escape regex metacharacters to prevent ReDoS and unintended wildcard matches
            const escaped = q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter['sourceText'] = { $regex: escaped, $options: 'i' };
        }
        const limit = Math.min(parseInt(q.limit ?? '50', 10), 200);
        const skip = parseInt(q.skip ?? '0', 10);
        const db = fastify.mongo;
        const [data, total] = await Promise.all([
            core_1.Collections.translationMemory(db)
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            core_1.Collections.translationMemory(db).countDocuments(filter),
        ]);
        return reply.send({ data, total, limit, skip });
    });
    // POST /admin/api/tm/import — receive TMX file, parse and bulk-upsert into MongoDB
    fastify.post('/admin/api/tm/import', async (request, reply) => {
        const db = fastify.mongo;
        let sourceLang = 'en';
        let targetLang = ''; // intentionally empty — must be provided by caller
        let fileBuffer = null;
        const MAX_TMX_BYTES = 800 * 1024 * 1024; // 800 MB hard cap to prevent OOM
        for await (const part of request.parts()) {
            if (part.type === 'field') {
                if (part.fieldname === 'sourceLang')
                    sourceLang = part.value.toLowerCase();
                if (part.fieldname === 'targetLang')
                    targetLang = part.value.toLowerCase();
            }
            else if (!fileBuffer) {
                fileBuffer = await part.toBuffer();
                if (fileBuffer.length > MAX_TMX_BYTES) {
                    return reply.status(413).send({
                        error: `TMX file too large (max 800 MB, got ${(fileBuffer.length / 1e6).toFixed(0)} MB)`,
                    });
                }
            }
        }
        if (!fileBuffer)
            return reply.status(400).send({ error: 'No TMX file provided (field: "file")' });
        if (!targetLang)
            return reply.status(400).send({ error: 'targetLang field required (e.g. "fr")' });
        // Parse TMX from buffer using saxes
        const pairs = await new Promise((resolve, reject) => {
            const result = [];
            const parser = new saxes_1.SaxesParser();
            let currentLang = '', currentText = '', tuSrc = '', tuTgt = '';
            let inSeg = false;
            const norm = (t) => t.trim().replace(/\s+/g, ' ');
            parser.on('opentag', (node) => {
                const name = node.name.toLowerCase();
                if (name === 'tuv') {
                    currentLang = (node.attributes['xml:lang'] ?? node.attributes['lang'] ?? '')
                        .toLowerCase().split('-')[0] ?? '';
                }
                else if (name === 'seg') {
                    inSeg = true;
                    currentText = '';
                }
            });
            parser.on('text', (text) => { if (inSeg)
                currentText += text; });
            parser.on('closetag', (node) => {
                const name = node.name.toLowerCase();
                if (name === 'seg') {
                    inSeg = false;
                    if (currentLang === sourceLang)
                        tuSrc = norm(currentText);
                    else if (currentLang === targetLang)
                        tuTgt = norm(currentText);
                }
                else if (name === 'tu') {
                    if (tuSrc && tuTgt)
                        result.push([tuSrc, tuTgt]);
                    tuSrc = tuTgt = '';
                    currentLang = '';
                }
            });
            const stream = stream_1.Readable.from(fileBuffer);
            stream.on('data', (chunk) => parser.write(chunk.toString('utf8')));
            stream.on('end', () => { try {
                parser.close();
            }
            catch { /* ignore */ } resolve(result); });
            stream.on('error', reject);
        });
        // Filter + deduplicate (most frequent FR wins)
        function wc(t) { return t.trim().split(/\s+/).length; }
        const freq = new Map();
        for (const [en, fr] of pairs) {
            if (!en || !fr || en.toLowerCase() === fr.toLowerCase())
                continue;
            if (en.trim().length <= 1)
                continue; // single-char noise (e.g. "-" × 15k)
            if (wc(en) < 2 || wc(en) > core_1.MongoTM.TM_WORD_LIMIT)
                continue;
            const ratio = wc(fr) / wc(en);
            if (ratio < 0.4 || ratio > 3.5)
                continue;
            const key = en.toLowerCase();
            if (!freq.has(key))
                freq.set(key, new Map());
            const m = freq.get(key);
            m.set(fr, (m.get(fr) ?? 0) + 1);
        }
        const enFirst = new Map();
        for (const [en] of pairs) {
            const k = en.trim().replace(/\s+/g, ' ').toLowerCase();
            if (!enFirst.has(k))
                enFirst.set(k, en.trim().replace(/\s+/g, ' '));
        }
        const resolved = [];
        for (const [enKey, frMap] of freq) {
            const bestFr = [...frMap.entries()].sort((a, b) => b[1] - a[1])[0][0];
            const originalEn = enFirst.get(enKey) ?? enKey;
            resolved.push({ sourceText: originalEn, targetText: bestFr, sourceHash: core_1.MongoTM.sourceHash(originalEn) });
        }
        // Bulk upsert in batches of 1000
        const BATCH = 1000;
        let imported = 0;
        for (let i = 0; i < resolved.length; i += BATCH) {
            await core_1.MongoTM.bulkUpsert(db, resolved.slice(i, i + BATCH), sourceLang, targetLang);
            imported += Math.min(BATCH, resolved.length - i);
        }
        return reply.send({ imported, skipped: pairs.length - resolved.length, sourceLang, targetLang });
    });
};
exports.default = adminTmRoutes;
