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
export interface TranslationSegment {
    id: string;
    text: string;
}
export interface TranslationResult {
    id: string;
    text: string;
    confidence: number;
}
export declare function translate(segments: TranslationSegment[], sourceLang: string, targetLang: string): Promise<TranslationResult[]>;
