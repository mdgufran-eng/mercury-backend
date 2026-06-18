import type { TranslationProvider, TranslationSegment, TranslationResult } from './TranslationProvider.js';
export declare function translateWithFallback(segments: TranslationSegment[], sourceLang: string, targetLang: string): Promise<TranslationResult[]>;
export type { TranslationProvider, TranslationSegment, TranslationResult };
