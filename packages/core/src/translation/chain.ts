import { OwnModelProvider } from './OwnModelProvider.js';
import type { TranslationProvider, TranslationSegment, TranslationResult } from './TranslationProvider.js';

// Own model only — Gemini fallback disabled for testing.
// Re-enable by uncommenting the GeminiProvider import and fallback block below.
export async function translateWithFallback(
  segments: TranslationSegment[],
  sourceLang: string,
  targetLang: string,
): Promise<TranslationResult[]> {
  const own = new OwnModelProvider();
  return own.translate(segments, sourceLang, targetLang);
}

// To re-enable Gemini fallback:
// import { GeminiProvider } from './GeminiProvider.js';
// try { return await own.translate(...) } catch { return gemini.translate(...) }

export type { TranslationProvider, TranslationSegment, TranslationResult };
