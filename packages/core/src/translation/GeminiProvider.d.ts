import type { TranslationProvider, TranslationSegment, TranslationResult } from './TranslationProvider.js';
export declare class GeminiProvider implements TranslationProvider {
    readonly name = "gemini";
    translate(segments: TranslationSegment[], sourceLang: string, targetLang: string): Promise<TranslationResult[]>;
}
