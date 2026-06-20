"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiProvider = void 0;
const GEMINI_API_KEY = process.env['GEMINI_API_KEY'] ?? '';
const GEMINI_MODEL = process.env['GEMINI_MODEL'] ?? 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const TIMEOUT_MS = 60_000;
class GeminiProvider {
    name = 'gemini';
    async translate(segments, sourceLang, targetLang) {
        if (!GEMINI_API_KEY)
            throw new Error('GEMINI_API_KEY not set');
        const prompt = buildPrompt(segments, sourceLang, targetLang);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
                }),
                signal: controller.signal,
            });
            if (!res.ok) {
                throw new Error(`Gemini API responded ${res.status}: ${await res.text()}`);
            }
            const data = (await res.json());
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
            const results = JSON.parse(rawText);
            return results.map((r) => ({ id: r.id, text: r.text, confidence: 0.9 }));
        }
        finally {
            clearTimeout(timer);
        }
    }
}
exports.GeminiProvider = GeminiProvider;
function buildPrompt(segments, sourceLang, targetLang) {
    return `Translate the following segments from ${sourceLang} to ${targetLang}.

Rules:
- Return a JSON array with the same number of objects: [{"id": "...", "text": "..."}]
- Preserve all {N} placeholders (e.g. {1}, {2}) exactly as-is — do not translate or move them
- Translate only the surrounding human-readable text
- Do not add explanations or metadata

Segments to translate:
${JSON.stringify(segments, null, 2)}`;
}
