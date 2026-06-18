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

  if (ownResults) {
    const needsFallback = ownResults.filter((r) => r.confidence < MIN_CONFIDENCE);
    const goodResults = ownResults.filter((r) => r.confidence >= MIN_CONFIDENCE);

    if (needsFallback.length === 0) return goodResults;

    // Retry low-confidence segments with Gemini
    const fallbackSegs = segments.filter((s) =>
      needsFallback.some((r) => r.id === s.id),
    );
    const fallbackResults = await gemini.translate(fallbackSegs, sourceLang, targetLang);

    const merged = new Map<string, TranslationResult>(goodResults.map((r) => [r.id, r]));
    for (const r of fallbackResults) merged.set(r.id, r);
    return segments.map((s) => merged.get(s.id)!);
  }

  return gemini.translate(segments, sourceLang, targetLang);
}

export type { TranslationProvider, TranslationSegment, TranslationResult };
