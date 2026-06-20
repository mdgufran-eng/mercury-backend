"use strict";
// Sentence-level segmenter with inline-tag extraction.
// Tags (HTML, {variable}, {{variable}}, %s etc.) are replaced with {N} placeholders
// so the TM can match across formatting differences.
//
// Sentence splitting: sbd (Sentence Boundary Disambiguation) with OmegaT-inspired
// abbreviation rules prevents incorrect splits on "Dr.", "No. 6 Dock", "approx.", etc.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extract = extract;
exports.reassemble = reassemble;
exports.expandTags = expandTags;
const sbd_1 = __importDefault(require("sbd"));
const htmlparser2_1 = require("htmlparser2");
const dom_serializer_1 = __importDefault(require("dom-serializer"));
const MongoTM_js_1 = require("./MongoTM.js");
// Single source of truth — imported from MongoTM so both files use identical pattern.
// Aliased to a local name so callers inside this file stay unchanged.
const INLINE_TAG_RE = MongoTM_js_1.INLINE_TAG_RE;
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
function isTranslatableString(text) {
    const normalized = text.trim();
    if (!/[a-zA-Z]/.test(normalized))
        return false;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized)) {
        return false;
    }
    return true;
}
// Recursively collect all leaf string values from a JSON object.
function collectStrings(value, prefix, out) {
    if (typeof value === 'string') {
        if (isTranslatableString(value))
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
// Abbreviations that must NOT cause sentence breaks.
// Sourced from OmegaT defaultRules.srx + travel-domain additions.
const TRAVEL_ABBREVIATIONS = [
    // Titles
    'Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof', 'Rev', 'Gen', 'Sgt', 'Cpl', 'Pvt',
    // Places / directions
    'St', 'Mt', 'Ft', 'Ave', 'Blvd', 'Rd', 'Sq', 'Jr', 'Sr',
    // Travel-specific
    'No', 'Vol', 'approx', 'incl', 'excl', 'max', 'min', 'avg', 'dept',
    'tel', 'ext', 'vs', 'cf', 'pp', 'ed',
    // Latin
    'e.g', 'i.e', 'etc', 'P.S', 'N.B',
];
const SBD_OPTIONS = {
    newline_boundaries: true, // split on newlines (good for bullet lists)
    html_boundaries: false, // we handle HTML ourselves via parser-backed block extraction
    sanitize: false,
    allowed_tags: false,
    abbreviations: TRAVEL_ABBREVIATIONS,
};
// Split text into sentences using sbd — handles abbreviations correctly.
function splitSentences(text) {
    return sbd_1.default.sentences(text, SBD_OPTIONS)
        .map((s) => s.trimEnd())
        .filter((s) => s.trim().length > 0);
}
const HTML_RE = /<\/?[a-z][\s\S]*>/i;
const HTML_BLOCK_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li']);
function isHtmlString(text) {
    return HTML_RE.test(text);
}
function isElement(node) {
    return node.type === 'tag' || node.type === 'script' || node.type === 'style';
}
function isHtmlBlock(node) {
    return isElement(node) && HTML_BLOCK_TAGS.has(node.name.toLowerCase());
}
function childNodes(node) {
    return isElement(node) ? node.children : [];
}
function innerHtml(node) {
    return (0, dom_serializer_1.default)(node.children, { decodeEntities: false });
}
function textContent(node) {
    if (node.type === 'text')
        return node.data;
    return childNodes(node).map(textContent).join('');
}
function collectHtmlBlocks(nodes, parentPath, out) {
    nodes.forEach((node, index) => {
        const path = [...parentPath, index];
        if (isHtmlBlock(node)) {
            const text = textContent(node);
            const html = innerHtml(node).trim();
            if (isTranslatableString(text) && html.length > 0 && text.trim().toLowerCase() !== 'undefined') {
                out.push({ path, html });
            }
            return;
        }
        collectHtmlBlocks(childNodes(node), path, out);
    });
}
function getNodeAtPath(nodes, path) {
    let currentNodes = nodes;
    let current;
    for (const index of path) {
        current = currentNodes[index];
        if (!current)
            return undefined;
        currentNodes = childNodes(current);
    }
    return current;
}
function parseHtmlFragment(html) {
    return (0, htmlparser2_1.parseDocument)(html, { decodeEntities: false }).children;
}
function extractHtmlSegments(fieldKey, value) {
    const doc = (0, htmlparser2_1.parseDocument)(value, { decodeEntities: false });
    const blocks = [];
    collectHtmlBlocks(doc.children, [], blocks);
    return blocks.map((block, index) => {
        const { tagged, tags } = extractTags(block.html);
        return {
            id: `${fieldKey}::html::${index}`,
            fieldKey,
            sentenceIndex: index,
            source: tagged,
            tags,
            wordCount: countWords(tagged),
            kind: 'htmlBlock',
            htmlPath: block.path,
        };
    });
}
function reassembleHtml(sourceHtml, segments, translations) {
    const doc = (0, htmlparser2_1.parseDocument)(sourceHtml, { decodeEntities: false });
    for (const seg of segments) {
        if (!seg.htmlPath)
            continue;
        const node = getNodeAtPath(doc.children, seg.htmlPath);
        if (!node || !isElement(node))
            continue;
        const translatedTagged = translations.get(seg.id) ?? seg.source;
        node.children = parseHtmlFragment(expandTags(translatedTagged, seg.tags));
    }
    return (0, dom_serializer_1.default)(doc.children, { decodeEntities: false });
}
// Extract all translatable segments from a JSON source object.
function extract(source) {
    const leaves = [];
    collectStrings(source, '', leaves);
    const segments = [];
    for (const { key, value } of leaves) {
        if (isHtmlString(value)) {
            segments.push(...extractHtmlSegments(key, value));
            continue;
        }
        const sentences = splitSentences(value);
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
                kind: 'plain',
            });
        });
    }
    return segments;
}
// Reassemble target JSON from translated segments.
// Walks the ORIGINAL structure and replaces string values in place,
// preserving all key names exactly (including dotted keys like "experience.title").
function reassemble(source, segments, translations) {
    // Build fieldKey → joined translated string
    const byField = new Map();
    for (const seg of segments) {
        const list = byField.get(seg.fieldKey) ?? [];
        list.push(seg);
        byField.set(seg.fieldKey, list);
    }
    const fieldValues = new Map();
    for (const [fieldKey, segs] of byField) {
        segs.sort((a, b) => a.sentenceIndex - b.sentenceIndex);
        if (segs.some((seg) => seg.kind === 'htmlBlock'))
            continue;
        const parts = segs.map((seg) => {
            const translatedTagged = translations.get(seg.id) ?? seg.source;
            return expandTags(translatedTagged, seg.tags);
        });
        fieldValues.set(fieldKey, parts.join(' '));
    }
    // Walk original structure with same path logic as collectStrings,
    // replacing strings using the exact same key that was collected.
    function replaceIn(value, prefix) {
        if (typeof value === 'string') {
            const htmlSegments = byField.get(prefix)?.filter((seg) => seg.kind === 'htmlBlock') ?? [];
            if (htmlSegments.length > 0) {
                return reassembleHtml(value, htmlSegments, translations);
            }
            return fieldValues.get(prefix) ?? value;
        }
        if (Array.isArray(value)) {
            return value.map((v, i) => replaceIn(v, `${prefix}[${i}]`));
        }
        if (value !== null && typeof value === 'object') {
            const result = {};
            for (const [k, v] of Object.entries(value)) {
                result[k] = replaceIn(v, prefix ? `${prefix}.${k}` : k);
            }
            return result;
        }
        return value;
    }
    return replaceIn(source, '');
}
