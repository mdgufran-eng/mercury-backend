"use strict";
/**
 * Load a TMX file into MongoDB Translation Memory.
 *
 * Usage:
 *   node dist/scripts/importTmx.js <path-to-tmx> <srcLang> <tgtLang>
 *   node dist/scripts/importTmx.js ~/Desktop/Headout_Human-en_US-fr_FR.tmx en fr
 *
 * Strategy for inconsistencies (same EN → multiple FR):
 *   Pick the most frequent translation.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const fs_1 = require("fs");
const connection_js_1 = require("../db/connection.js");
const MongoTM = __importStar(require("../tm/MongoTM.js"));
const sax = __importStar(require("saxes"));
const [, , tmxPath, srcLang = 'en', tgtLang = 'fr'] = process.argv;
if (!tmxPath) {
    console.error('Usage: node importTmx.js <tmx-file> [srcLang] [tgtLang]');
    process.exit(1);
}
const TMX = path.resolve(tmxPath.replace('~', process.env['HOME'] ?? ''));
if (!fs.existsSync(TMX)) {
    console.error(`File not found: ${TMX}`);
    process.exit(1);
}
// ── Helpers ───────────────────────────────────────────────────────────────────
function norm(t) {
    return t.trim().replace(/\s+/g, ' ');
}
function wc(t) {
    return t.trim().split(/\s+/).length;
}
function isUsable(en, fr) {
    if (!en || !fr)
        return false;
    if (en.toLowerCase() === fr.toLowerCase())
        return false;
    if (en.trim().length <= 1)
        return false;
    if (wc(en) > MongoTM.TM_WORD_LIMIT)
        return false;
    if (wc(en) < 2)
        return false;
    const ratio = wc(fr) / wc(en);
    return ratio >= 0.4 && ratio <= 3.5;
}
// ── Parse TMX ─────────────────────────────────────────────────────────────────
async function parseTmx() {
    return new Promise((resolve, reject) => {
        const pairs = [];
        const parser = new sax.SaxesParser();
        let currentLang = '', currentText = '', tuSrc = '', tuTgt = '';
        let inSeg = false;
        parser.on('opentag', (node) => {
            const name = node.name.toLowerCase();
            if (name === 'tuv') {
                currentLang = (node.attributes['xml:lang'] ?? node.attributes['lang'] ?? '').toLowerCase().split('-')[0] ?? '';
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
                if (currentLang === srcLang)
                    tuSrc = norm(currentText);
                else if (currentLang === tgtLang)
                    tuTgt = norm(currentText);
            }
            else if (name === 'tu') {
                if (tuSrc && tuTgt)
                    pairs.push([tuSrc, tuTgt]);
                tuSrc = tuTgt = '';
                currentLang = '';
            }
        });
        const stream = (0, fs_1.createReadStream)(TMX, { encoding: 'utf8' });
        stream.on('data', (chunk) => parser.write(chunk));
        stream.on('end', () => { parser.close(); resolve(pairs); });
        stream.on('error', reject);
    });
}
// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\nLoading TMX → MongoDB TM`);
    console.log(`  File:  ${path.basename(TMX)} (${(fs.statSync(TMX).size / 1e6).toFixed(1)} MB)`);
    console.log(`  Langs: ${srcLang} → ${tgtLang}`);
    console.log(`  Word limit: ≤ ${MongoTM.TM_WORD_LIMIT} words\n`);
    const db = await (0, connection_js_1.connectMongo)();
    process.stdout.write('Parsing TMX... ');
    const t0 = Date.now();
    const raw = await parseTmx();
    console.log(`${raw.length.toLocaleString()} pairs (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    // Filter + resolve duplicates (most-frequent FR wins)
    process.stdout.write('Filtering + resolving duplicates... ');
    const freq = new Map();
    for (const [en, fr] of raw) {
        if (!isUsable(en, fr))
            continue;
        const key = norm(en).toLowerCase();
        if (!freq.has(key))
            freq.set(key, new Map());
        const frMap = freq.get(key);
        frMap.set(fr, (frMap.get(fr) ?? 0) + 1);
    }
    const enOriginal = new Map();
    for (const [en] of raw) {
        const k = norm(en).toLowerCase();
        if (!enOriginal.has(k))
            enOriginal.set(k, norm(en));
    }
    const resolved = [];
    for (const [enKey, frMap] of freq) {
        const bestFr = [...frMap.entries()].sort((a, b) => b[1] - a[1])[0][0];
        const originalEn = enOriginal.get(enKey) ?? enKey;
        resolved.push({
            sourceText: originalEn,
            targetText: bestFr,
            sourceHash: MongoTM.sourceHash(originalEn),
        });
    }
    const multiVariant = [...freq.values()].filter((m) => m.size > 1).length;
    console.log(`${resolved.length.toLocaleString()} usable pairs (${multiVariant.toLocaleString()} inconsistencies resolved)`);
    // Bulk upsert into MongoDB in batches of 1000
    const BATCH = 1000;
    let loaded = 0;
    const t1 = Date.now();
    process.stdout.write('Loading into MongoDB... ');
    for (let i = 0; i < resolved.length; i += BATCH) {
        await MongoTM.bulkUpsert(db, resolved.slice(i, i + BATCH), srcLang, tgtLang);
        loaded += Math.min(BATCH, resolved.length - i);
        if (i % 10000 === 0 && i > 0) {
            process.stdout.write(`\r  ${loaded.toLocaleString()}/${resolved.length.toLocaleString()} ...`);
        }
    }
    const elapsed = ((Date.now() - t1) / 1000).toFixed(1);
    console.log(`\r  ${loaded.toLocaleString()} pairs loaded in ${elapsed}s`);
    // Verify first 3
    const sample = resolved.slice(0, 3);
    console.log('\nVerification (first 3 pairs):');
    for (const entry of sample) {
        const row = await db.collection('translationMemory').findOne({ sourceHash: entry.sourceHash });
        const ok = row?.targetText === entry.targetText ? '✓' : '✗';
        console.log(`  ${ok} "${entry.sourceText.slice(0, 50)}" → "${(row?.targetText ?? '').slice(0, 40)}"`);
    }
    const total = await MongoTM.count(db, srcLang, tgtLang);
    console.log(`\n✅ Done! ${total.toLocaleString()} ${srcLang}→${tgtLang} pairs in MongoDB translationMemory.\n`);
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
