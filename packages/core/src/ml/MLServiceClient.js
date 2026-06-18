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
const TIMEOUT_MS = 30_000;
async function post(path, body, timeoutMs = TIMEOUT_MS) {
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
    finally {
        clearTimeout(timer);
    }
}
async function translate(segments, sourceLang, targetLang) {
    const data = await post('/translate', {
        segments,
        sourceLang,
        targetLang,
    });
    return data.results;
}
