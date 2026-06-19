import { OwnModelProvider } from './OwnModelProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import type { TranslationProvider, TranslationSegment, TranslationResult } from './TranslationProvider.js';

const MIN_CONFIDENCE = parseFloat(process.env['MIN_TRANSLATION_CONFIDENCE'] ?? '0.7');

// Tries OwnModel first; falls back to Gemini on failure or low confidence.
export async function translateWithFallback(
  segments: TranslationSegment[],
  sourceLang: string,
  targetLang: string,
): Promise<TranslationResult[]> {
  const own = new OwnModelProvider();
  const gemini = new GeminiProvider();

  let ownResults: TranslationResult[] | null = null;

  try {
    ownResults = await own.translate(segments, sourceLang, targetLang);
  } catch {
    // own model unavailable — fall through to Gemini entirely
  }

  // Own model available — use its results directly, no Gemini fallback.
  if (ownResults) return ownResults;

  // Own model unavailable — fall back to Gemini entirely.
  return gemini.translate(segments, sourceLang, targetLang);
}

export type { TranslationProvider, TranslationSegment, TranslationResult };
