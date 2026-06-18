export interface TranslationSegment {
    id: string;
    text: string;
}
export interface TranslationResult {
    id: string;
    text: string;
    confidence: number;
}
export interface TranslationProvider {
    name: string;
    translate(segments: TranslationSegment[], sourceLang: string, targetLang: string): Promise<TranslationResult[]>;
}
