export interface TranslationSegment {
  id: string;
  text: string; // tagged form with {N} placeholders
}

export interface TranslationResult {
  id: string;
  text: string; // translated tagged form
  confidence: number; // 0-1; used to decide Gemini fallback
}

export interface TranslationProvider {
  name: string;
  translate(
    segments: TranslationSegment[],
    sourceLang: string,
    targetLang: string,
  ): Promise<TranslationResult[]>;
}
