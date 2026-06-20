"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateWithFallback = translateWithFallback;
const OwnModelProvider_js_1 = require("./OwnModelProvider.js");
// Own model only — Gemini fallback disabled for testing.
// Re-enable by uncommenting the GeminiProvider import and fallback block below.
async function translateWithFallback(segments, sourceLang, targetLang) {
    const own = new OwnModelProvider_js_1.OwnModelProvider();
    return own.translate(segments, sourceLang, targetLang);
}
