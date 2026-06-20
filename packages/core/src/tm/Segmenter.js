"use strict";
// Sentence-level segmenter with inline-tag extraction.
// Tags (HTML, {variable}, {{variable}}, %s etc.) are replaced with {N} placeholders
// so the TM can match across formatting differences.
Object.defineProperty(exports, "__esModule", { value: true });
exports.extract = extract;
exports.reassemble = reassemble;
exports.expandTags = expandTags;
// Order matters: HTML > double-brace > single-brace variable > printf
const INLINE_TAG_RE = /<[^>]+?>|<!--[\s\S]*?-->|\{\{[^}]+\}\}|\{[a-zA-Z_][^}]*\}|%[sdife]/g;
function extractTags(text) {
    const tags = {};
    let counter = 0;
    const tagged = text.replace(INLINE_TAG_RE, (match) => {
        counter += 1;
        tags[String(counter)] = match;
        return `{${counter}}`;
    });
    return { tagged, tags };
}
function expandTags(tagged, tags) {
    return tagged.replace(/\{(\d+)\}/g, (_, n) => tags[n] ?? `{${n}}`);
}
function countWords(text) {
    // Strip {N} placeholders before counting.
    return text.replace(/\{(\d+)\}/g, '').trim().split(/\s+/).filter(Boolean).length;
}
// Recursively collect all leaf string values from a JSON object.
function collectStrings(value, prefix, out) {
    if (typeof value === 'string') {
        if (value.trim().length > 0)
            out.push({ key: prefix, value });
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((v, i) => collectStrings(v, `${prefix}[${i}]`, out));
        return;
    }
    if (value !== null && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) {
            collectStrings(v, prefix ? `${prefix}.${k}` : k, out);
        }
    }
}
// Set a deeply nested value by dot/bracket path.
function setPath(obj, path, value) {
    const keys = path.split(/\.|\[(\d+)\]/).filter(Boolean);
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        const next = cur[k];
        if (next === undefined || next === null) {
            const isIndex = /^\d+$/.test(keys[i + 1]);
            cur[k] = isIndex ? [] : {};
        }
        cur = cur[k];
    }
    const lastKey = keys[keys.length - 1];
    cur[lastKey] = value;
}
// Extract all translatable segments from a JSON source object.
function extract(source) {
    const leaves = [];
    collectStrings(source, '', leaves);
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
    const segments = [];
    for (const { key, value } of leaves) {
        const sentences = [...segmenter.segment(value)].map((s) => s.segment.trimEnd());
        sentences.forEach((sentence, sentenceIndex) => {
            if (!sentence.trim())
                return;
            const { tagged, tags } = extractTags(sentence);
            segments.push({
                id: `${key}::${sentenceIndex}`,
                fieldKey: key,
                sentenceIndex,
                source: tagged,
                tags,
                wordCount: countWords(tagged),
            });
        });
    }
    return segments;
}
// Reassemble target JSON from translated segments.
// `translations` maps segmentId → translated tagged text.
function reassemble(source, segments, translations) {
    // Group segments by fieldKey, ordered by sentenceIndex.
    const byField = new Map();
    for (const seg of segments) {
        const list = byField.get(seg.fieldKey) ?? [];
        list.push(seg);
        byField.set(seg.fieldKey, list);
    }
    const target = structuredClone(source);
    for (const [fieldKey, segs] of byField) {
        segs.sort((a, b) => a.sentenceIndex - b.sentenceIndex);
        const parts = segs.map((seg) => {
            const translatedTagged = translations.get(seg.id) ?? seg.source; // fall back to source
            return expandTags(translatedTagged, seg.tags);
        });
        setPath(target, fieldKey, parts.join(' '));
    }
    return target;
}
