"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INLINE_TAG_RE = exports.TM_WORD_LIMIT = void 0;
exports.sourceHash = sourceHash;
exports.batchLookup = batchLookup;
exports.store = store;
exports.bulkUpsert = bulkUpsert;
exports.count = count;
const crypto_1 = require("crypto");
const collections_js_1 = require("../db/collections.js");
exports.TM_WORD_LIMIT = 20;
// Shared with Segmenter.ts — exported so both use the identical pattern.
// Order: HTML tags first, then double-brace, single-brace variable, printf.
exports.INLINE_TAG_RE = /<[^>]+?>|<!--[\s\S]*?-->|\{\{[^}]+\}\}|\{[a-zA-Z_][^}]*\}|%[sdife]/g;
function normalize(text) {
    return text.trim().replace(/\s+/g, ' ');
}
function toTagged(text) {
    let counter = 0;
    return normalize(text).replace(exports.INLINE_TAG_RE, () => `{${++counter}}`);
}
function sourceHash(text) {
    return (0, crypto_1.createHash)('sha256').update(toTagged(text).toLowerCase()).digest('hex');
}
function wordCount(text) {
    return text.trim().split(/\s+/).length;
}
// Batch lookup — one MongoDB $in query for all short segments.
// Returns Map<segmentId, targetText> for TM hits only.
async function batchLookup(db, segments, srcLang, tgtLang) {
    const short = segments.filter((s) => wordCount(s.text) <= exports.TM_WORD_LIMIT);
    if (short.length === 0)
        return new Map();
    const hashes = short.map((s) => sourceHash(s.text));
    const rows = await (0, collections_js_1.translationMemory)(db)
        .find({
        sourceHash: { $in: hashes },
        sourceLanguage: srcLang.toUpperCase(),
        targetLanguage: tgtLang.toLowerCase(),
    })
        .toArray();
    const byHash = new Map(rows.map((r) => [r.sourceHash, r.targetText]));
    const hits = new Map();
    for (const seg of short) {
        const val = byHash.get(sourceHash(seg.text));
        if (val)
            hits.set(seg.id, val);
    }
    return hits;
}
// Store a single approved translation into TM.
async function store(db, sourceText, targetText, srcLang, tgtLang, origin = 'APPROVED') {
    if (wordCount(sourceText) > exports.TM_WORD_LIMIT)
        return;
    const hash = sourceHash(sourceText);
    await (0, collections_js_1.translationMemory)(db).updateOne({
        sourceHash: hash,
        sourceLanguage: srcLang.toUpperCase(),
        targetLanguage: tgtLang.toLowerCase(),
    }, {
        $set: { sourceText: normalize(sourceText), targetText, origin },
        $setOnInsert: { createdAt: new Date() },
    }, { upsert: true });
}
// Bulk upsert for TMX import — batched bulkWrite.
async function bulkUpsert(db, entries, srcLang, tgtLang) {
    if (entries.length === 0)
        return;
    const ops = entries.map((e) => ({
        updateOne: {
            filter: {
                sourceHash: e.sourceHash,
                sourceLanguage: srcLang.toUpperCase(),
                targetLanguage: tgtLang.toLowerCase(),
            },
            update: {
                $set: { sourceText: e.sourceText, targetText: e.targetText, origin: 'IMPORTED_TMX' },
                $setOnInsert: { createdAt: new Date() },
            },
            upsert: true,
        },
    }));
    await (0, collections_js_1.translationMemory)(db).bulkWrite(ops, { ordered: false });
}
// Count TM entries for a language pair.
async function count(db, srcLang, tgtLang) {
    return (0, collections_js_1.translationMemory)(db).countDocuments({
        sourceLanguage: srcLang.toUpperCase(),
        targetLanguage: tgtLang.toLowerCase(),
    });
}
