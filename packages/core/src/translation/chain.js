"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateWithFallback = translateWithFallback;
const OwnModelProvider_js_1 = require("./OwnModelProvider.js");
const GeminiProvider_js_1 = require("./GeminiProvider.js");
const MIN_CONFIDENCE = parseFloat(process.env['MIN_TRANSLATION_CONFIDENCE'] ?? '0.7');
// Tries OwnModel first; falls back to Gemini on failure or low confidence.
async function translateWithFallback(segments, sourceLang, targetLang) {
    const own = new OwnModelProvider_js_1.OwnModelProvider();
    const gemini = new GeminiProvider_js_1.GeminiProvider();
    let ownResults = null;
    try {
        ownResults = await own.translate(segments, sourceLang, targetLang);
    }
    catch {
        // own model unavailable — fall through to Gemini entirely
    }
    if (ownResults) {
        const needsFallback = ownResults.filter((r) => r.confidence < MIN_CONFIDENCE);
        const goodResults = ownResults.filter((r) => r.confidence >= MIN_CONFIDENCE);
        if (needsFallback.length === 0)
            return goodResults;
        // Retry low-confidence segments with Gemini
        const fallbackSegs = segments.filter((s) => needsFallback.some((r) => r.id === s.id));
        const fallbackResults = await gemini.translate(fallbackSegs, sourceLang, targetLang);
        const merged = new Map(goodResults.map((r) => [r.id, r]));
        for (const r of fallbackResults)
            merged.set(r.id, r);
        return segments.map((s) => merged.get(s.id));
    }
    return gemini.translate(segments, sourceLang, targetLang);
}
