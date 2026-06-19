/**
 * Redis-backed Translation Memory.
 *
 * Only looks up sentences ≤ TM_WORD_LIMIT words — that's where the hit rate
 * is meaningful (43% for UI strings, 15% for short sentences).
 * Longer sentences go straight to the ML service.
 *
 * Key format: tm:{srcLang}:{tgtLang}:{sha256(normalized_lowercase_source)}
 * Value:      target text (plain string)
 */

import { createHash } from 'crypto';
import IORedis from 'ioredis';

export const TM_WORD_LIMIT = 20; // skip TM for longer sentences — low hit rate

// Must match importTmx.ts stripTags() so lookup keys align with stored keys.
// Both sides apply the same inline-tag → {N} substitution before hashing.
const INLINE_TAG_RE =
  /<[^>]+?>|<!--[\s\S]*?-->|\{\{[^}]+\}\}|\{[a-zA-Z_][^}]*\}|%[sdife]/g;

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function toTagged(text: string): string {
  let counter = 0;
  return normalize(text).replace(INLINE_TAG_RE, () => `{${++counter}}`);
}

function tmKey(source: string, srcLang: string, tgtLang: string): string {
  // source may already be in tagged form (from Segmenter) or raw (for direct lookups)
  // toTagged() is idempotent on already-tagged text since {N} (numeric) doesn't match INLINE_TAG_RE
  const hash = createHash('sha256')
    .update(toTagged(source).toLowerCase())
    .digest('hex');
  return `tm:${srcLang.toLowerCase()}:${tgtLang.toLowerCase()}:${hash}`;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

// ── Lookup ────────────────────────────────────────────────────────────────────

export async function lookup(
  redis: IORedis,
  source: string,
  srcLang: string,
  tgtLang: string,
): Promise<string | null> {
  if (wordCount(source) > TM_WORD_LIMIT) return null;
  return redis.get(tmKey(source, srcLang, tgtLang));
}

// Batch lookup — one Redis MGET round-trip for all short segments.
// Returns Map<segmentId, targetText> for TM hits only.
export async function batchLookup(
  redis: IORedis,
  segments: Array<{ id: string; text: string }>,
  srcLang: string,
  tgtLang: string,
): Promise<Map<string, string>> {
  const short = segments.filter((s) => wordCount(s.text) <= TM_WORD_LIMIT);
  if (short.length === 0) return new Map();

  const keys = short.map((s) => tmKey(s.text, srcLang, tgtLang));
  const values = await redis.mget(...keys);

  const hits = new Map<string, string>();
  short.forEach((seg, i) => {
    const val = values[i];
    if (val) hits.set(seg.id, val);
  });
  return hits;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export async function store(
  redis: IORedis,
  source: string,
  target: string,
  srcLang: string,
  tgtLang: string,
): Promise<void> {
  if (wordCount(source) > TM_WORD_LIMIT) return; // don't store long sentences
  await redis.set(tmKey(source, srcLang, tgtLang), target);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function count(
  redis: IORedis,
  srcLang: string,
  tgtLang: string,
): Promise<number> {
  const pattern = `tm:${srcLang.toLowerCase()}:${tgtLang.toLowerCase()}:*`;
  let cursor = '0';
  let total = 0;
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 1000);
    cursor = next;
    total += keys.length;
  } while (cursor !== '0');
  return total;
}
