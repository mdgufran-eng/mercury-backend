"use strict";
/**
 * HTTP client for the Mercury ML service (lives in a separate repo).
 *
 * Contract the ML service must implement:
 *
 *   POST /translate
 *     Body: { segments: [{id, text}], sourceLang, targetLang }
 *     Response: { results: [{id, text, confidence}] }
 *
 *   GET /health
 *     Response: { status: "ok" }
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.translate = translate;
const ML_URL = process.env['ML_SERVICE_URL'] ?? 'http://localhost:8000';
const TIMEOUT_MS = 30 * 60_000; // 30 min — allow large real-life ML batches to complete.
const MAX_BATCH_SEGMENTS = parsePositiveInt(process.env['ML_TRANSLATE_BATCH_SIZE'], 10);
const MAX_BATCH_WORDS = parsePositiveInt(process.env['ML_TRANSLATE_BATCH_WORDS'], 350);
function parsePositiveInt(value, fallback) {
    if (value === undefined)
        return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function countWords(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
}
function batchSegments(segments) {
    const batches = [];
    let current = [];
    let currentWords = 0;
    for (const segment of segments) {
        const segmentWords = countWords(segment.text);
        const wouldExceedSegments = current.length >= MAX_BATCH_SEGMENTS;
        const wouldExceedWords = current.length > 0 && currentWords + segmentWords > MAX_BATCH_WORDS;
        if (wouldExceedSegments || wouldExceedWords) {
            batches.push(current);
            current = [];
            currentWords = 0;
        }
        current.push(segment);
        currentWords += segmentWords;
    }
    if (current.length > 0)
        batches.push(current);
    return batches;
}
async function post(path, body, timeoutMs = TIMEOUT_MS, context = '') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${ML_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        if (!res.ok)
            throw new Error(`ML service ${path} → ${res.status}: ${await res.text()}`);
        return res.json();
    }
    catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            throw new Error(`ML service ${path} timed out after ${timeoutMs}ms${context ? ` (${context})` : ''}`);
        }
        throw err;
    }
    finally {
        clearTimeout(timer);
    }
}
async function translate(segments, sourceLang, targetLang) {
    if (segments.length === 0)
        return [];
    const batches = batchSegments(segments);
    const results = [];
    for (let i = 0; i < batches.length; i += 1) {
        const batch = batches[i];
        const words = batch.reduce((sum, segment) => sum + countWords(segment.text), 0);
        const data = await post('/translate', { segments: batch, sourceLang, targetLang }, TIMEOUT_MS, `batch ${i + 1}/${batches.length}, ${batch.length} segments, ${words} words`);
        results.push(...data.results);
    }
    return results;
}
