import type { TranslationProvider, TranslationSegment, TranslationResult } from './TranslationProvider.js';
export declare class OwnModelProvider implements TranslationProvider {
    readonly name = "own-model";
    translate(segments: TranslationSegment[], sourceLang: string, targetLang: string): Promise<TranslationResult[]>;
}
