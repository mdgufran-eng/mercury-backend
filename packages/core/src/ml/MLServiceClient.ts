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

const ML_URL = process.env['ML_SERVICE_URL'] ?? 'http://localhost:8000';
const TIMEOUT_MS = 30_000;

export interface TranslationSegment {
  id: string;
  text: string;
}

export interface TranslationResult {
  id: string;
  text: string;
  confidence: number;
}

async function post<T>(path: string, body: unknown, timeoutMs = TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${ML_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`ML service ${path} → ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

export async function translate(
  segments: TranslationSegment[],
  sourceLang: string,
  targetLang: string,
): Promise<TranslationResult[]> {
  const data = await post<{ results: TranslationResult[] }>('/translate', {
    segments,
    sourceLang,
    targetLang,
  });
  return data.results;
}
