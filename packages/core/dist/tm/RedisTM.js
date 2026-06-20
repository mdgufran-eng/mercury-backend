"use strict";
/**
 * Redis-backed Translation Memory.
 *
 * Only looks up sentences ≤ TM_WORD_LIMIT words — that's where the hit rate
 * is meaningful (43% for UI strings, 15% for short sentences).
 * Longer sentences go straight to the ML service.
 *
 * Key format: tm:{srcLang}:{tgtLang}:{sha256(normalized_lowercase_source)}
 * Value:      target text (plain string)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TM_WORD_LIMIT = void 0;
exports.lookup = lookup;
exports.batchLookup = batchLookup;
exports.store = store;
exports.count = count;
const crypto_1 = require("crypto");
exports.TM_WORD_LIMIT = 20; // skip TM for longer sentences — low hit rate
// Must match importTmx.ts stripTags() so lookup keys align with stored keys.
// Both sides apply the same inline-tag → {N} substitution before hashing.
const INLINE_TAG_RE = /<[^>]+?>|<!--[\s\S]*?-->|\{\{[^}]+\}\}|\{[a-zA-Z_][^}]*\}|%[sdife]/g;
function normalize(text) {
    return text.trim().replace(/\s+/g, ' ');
}
function toTagged(text) {
    let counter = 0;
    return normalize(text).replace(INLINE_TAG_RE, () => `{${++counter}}`);
}
function tmKey(source, srcLang, tgtLang) {
    // source may already be in tagged form (from Segmenter) or raw (for direct lookups)
    // toTagged() is idempotent on already-tagged text since {N} (numeric) doesn't match INLINE_TAG_RE
    const hash = (0, crypto_1.createHash)('sha256')
        .update(toTagged(source).toLowerCase())
        .digest('hex');
    return `tm:${srcLang.toLowerCase()}:${tgtLang.toLowerCase()}:${hash}`;
}
function wordCount(text) {
    return text.trim().split(/\s+/).length;
}
// ── Lookup ────────────────────────────────────────────────────────────────────
async function lookup(redis, source, srcLang, tgtLang) {
    if (wordCount(source) > exports.TM_WORD_LIMIT)
        return null;
    return redis.get(tmKey(source, srcLang, tgtLang));
}
// Batch lookup — one Redis MGET round-trip for all short segments.
// Returns Map<segmentId, targetText> for TM hits only.
async function batchLookup(redis, segments, srcLang, tgtLang) {
    const short = segments.filter((s) => wordCount(s.text) <= exports.TM_WORD_LIMIT);
    if (short.length === 0)
        return new Map();
    const keys = short.map((s) => tmKey(s.text, srcLang, tgtLang));
    const values = await redis.mget(...keys);
    const hits = new Map();
    short.forEach((seg, i) => {
        const val = values[i];
        if (val)
            hits.set(seg.id, val);
    });
    return hits;
}
// ── Store ─────────────────────────────────────────────────────────────────────
async function store(redis, source, target, srcLang, tgtLang) {
    if (wordCount(source) > exports.TM_WORD_LIMIT)
        return; // don't store long sentences
    await redis.set(tmKey(source, srcLang, tgtLang), target);
}
// ── Stats ─────────────────────────────────────────────────────────────────────
async function count(redis, srcLang, tgtLang) {
    const pattern = `tm:${srcLang.toLowerCase()}:${tgtLang.toLowerCase()}:*`;
    let cursor = '0';
    let total = 0;
    do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 1000);
        cursor = next;
        total += keys.length;
    } while (cursor !== '0');
    return total;
}
