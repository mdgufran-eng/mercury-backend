import { createHash } from 'crypto';
import { Db } from 'mongodb';
import { translationMemory } from '../db/collections.js';

export const TM_WORD_LIMIT = 20;

// Must match Segmenter.ts extractTags() so lookup keys align with import keys.
const INLINE_TAG_RE =
  /<[^>]+?>|<!--[\s\S]*?-->|\{\{[^}]+\}\}|\{[a-zA-Z_][^}]*\}|%[sdife]/g;

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function toTagged(text: string): string {
  let counter = 0;
  return normalize(text).replace(INLINE_TAG_RE, () => `{${++counter}}`);
}

export function sourceHash(text: string): string {
  return createHash('sha256').update(toTagged(text).toLowerCase()).digest('hex');
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

// Batch lookup — one MongoDB $in query for all short segments.
// Returns Map<segmentId, targetText> for TM hits only.
export async function batchLookup(
  db: Db,
  segments: Array<{ id: string; text: string }>,
  srcLang: string,
  tgtLang: string,
): Promise<Map<string, string>> {
  const short = segments.filter((s) => wordCount(s.text) <= TM_WORD_LIMIT);
  if (short.length === 0) return new Map();

  const hashes = short.map((s) => sourceHash(s.text));

  const rows = await translationMemory(db)
    .find({
      sourceHash: { $in: hashes },
      sourceLanguage: srcLang.toUpperCase(),
      targetLanguage: tgtLang.toLowerCase(),
    })
    .toArray();

  const byHash = new Map(rows.map((r) => [r.sourceHash, r.targetText]));

  const hits = new Map<string, string>();
  for (const seg of short) {
    const val = byHash.get(sourceHash(seg.text));
    if (val) hits.set(seg.id, val);
  }
  return hits;
}

// Store a single approved translation into TM.
export async function store(
  db: Db,
  sourceText: string,
  targetText: string,
  srcLang: string,
  tgtLang: string,
  origin: 'APPROVED' | 'IMPORTED_TMX' = 'APPROVED',
): Promise<void> {
  if (wordCount(sourceText) > TM_WORD_LIMIT) return;
  const hash = sourceHash(sourceText);
  await translationMemory(db).updateOne(
    {
      sourceHash: hash,
      sourceLanguage: srcLang.toUpperCase(),
      targetLanguage: tgtLang.toLowerCase(),
    },
    {
      $set: { sourceText: normalize(sourceText), targetText, origin },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
}

// Bulk upsert for TMX import — batched bulkWrite.
export async function bulkUpsert(
  db: Db,
  entries: Array<{ sourceText: string; targetText: string; sourceHash: string }>,
  srcLang: string,
  tgtLang: string,
): Promise<void> {
  if (entries.length === 0) return;
  const ops = entries.map((e) => ({
    updateOne: {
      filter: {
        sourceHash: e.sourceHash,
        sourceLanguage: srcLang.toUpperCase(),
        targetLanguage: tgtLang.toLowerCase(),
      },
      update: {
        $set: { sourceText: e.sourceText, targetText: e.targetText, origin: 'IMPORTED_TMX' as const },
        $setOnInsert: { createdAt: new Date() },
      },
      upsert: true,
    },
  }));
  await translationMemory(db).bulkWrite(ops, { ordered: false });
}

// Count TM entries for a language pair.
export async function count(db: Db, srcLang: string, tgtLang: string): Promise<number> {
  return translationMemory(db).countDocuments({
    sourceLanguage: srcLang.toUpperCase(),
    targetLanguage: tgtLang.toLowerCase(),
  });
}
