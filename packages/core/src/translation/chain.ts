import { OwnModelProvider } from './OwnModelProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import type { TranslationProvider, TranslationSegment, TranslationResult } from './TranslationProvider.js';

// Own model first → Gemini fallback if model unavailable or throws.
export async function translateWithFallback(
  segments: TranslationSegment[],
  sourceLang: string,
  targetLang: string,
): Promise<TranslationResult[]> {
  const own = new OwnModelProvider();
  try {
    return await own.translate(segments, sourceLang, targetLang);
  } catch {
    // Own model unavailable — fall back to Gemini.
    const gemini = new GeminiProvider();
    return gemini.translate(segments, sourceLang, targetLang);
  }
}

export type { TranslationProvider, TranslationSegment, TranslationResult };
