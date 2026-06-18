// Sentence-level segmenter with inline-tag extraction.
// Tags (HTML, {variable}, {{variable}}, %s etc.) are replaced with {N} placeholders
// so the TM can match across formatting differences.

export interface ExtractedSegment {
  id: string; // `${fieldKey}::${sentenceIndex}`
  fieldKey: string;
  sentenceIndex: number;
  source: string; // tagged form — {N} placeholders in place of inline tags
  tags: Record<string, string>; // "1" → "<b>", "2" → "</b>", etc.
  wordCount: number;
}

// Order matters: HTML > double-brace > single-brace variable > printf
const INLINE_TAG_RE =
  /<[^>]+?>|<!--[\s\S]*?-->|\{\{[^}]+\}\}|\{[a-zA-Z_][^}]*\}|%[sdife]/g;

function extractTags(text: string): { tagged: string; tags: Record<string, string> } {
  const tags: Record<string, string> = {};
  let counter = 0;
  const tagged = text.replace(INLINE_TAG_RE, (match) => {
    counter += 1;
    tags[String(counter)] = match;
    return `{${counter}}`;
  });
  return { tagged, tags };
}

function expandTags(tagged: string, tags: Record<string, string>): string {
  return tagged.replace(/\{(\d+)\}/g, (_, n) => tags[n] ?? `{${n}}`);
}

function countWords(text: string): number {
  // Strip {N} placeholders before counting.
  return text.replace(/\{(\d+)\}/g, '').trim().split(/\s+/).filter(Boolean).length;
}

// Recursively collect all leaf string values from a JSON object.
function collectStrings(
  value: unknown,
  prefix: string,
  out: Array<{ key: string; value: string }>,
): void {
  if (typeof value === 'string') {
    if (value.trim().length > 0) out.push({ key: prefix, value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => collectStrings(v, `${prefix}[${i}]`, out));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      collectStrings(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
}

// Set a deeply nested value by dot/bracket path.
function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(/\.|\[(\d+)\]/).filter(Boolean);
  let cur: unknown = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]!;
    const next = (cur as Record<string, unknown>)[k];
    if (next === undefined || next === null) {
      const isIndex = /^\d+$/.test(keys[i + 1]!);
      (cur as Record<string, unknown>)[k] = isIndex ? [] : {};
    }
    cur = (cur as Record<string, unknown>)[k];
  }
  const lastKey = keys[keys.length - 1]!;
  (cur as Record<string, unknown>)[lastKey] = value;
}

// Extract all translatable segments from a JSON source object.
export function extract(source: Record<string, unknown>): ExtractedSegment[] {
  const leaves: Array<{ key: string; value: string }> = [];
  collectStrings(source, '', leaves);

  const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
  const segments: ExtractedSegment[] = [];

  for (const { key, value } of leaves) {
    const sentences = [...segmenter.segment(value)].map((s) => s.segment.trimEnd());
    sentences.forEach((sentence, sentenceIndex) => {
      if (!sentence.trim()) return;
      const { tagged, tags } = extractTags(sentence);
      segments.push({
        id: `${key}::${sentenceIndex}`,
        fieldKey: key,
        sentenceIndex,
        source: tagged,
        tags,
        wordCount: countWords(tagged),
      });
    });
  }

  return segments;
}

// Reassemble target JSON from translated segments.
// Walks the ORIGINAL structure and replaces string values in place,
// preserving all key names exactly (including dotted keys like "experience.title").
export function reassemble(
  source: Record<string, unknown>,
  segments: ExtractedSegment[],
  translations: Map<string, string>,
): Record<string, unknown> {
  // Build fieldKey → joined translated string
  const byField = new Map<string, ExtractedSegment[]>();
  for (const seg of segments) {
    const list = byField.get(seg.fieldKey) ?? [];
    list.push(seg);
    byField.set(seg.fieldKey, list);
  }

  const fieldValues = new Map<string, string>();
  for (const [fieldKey, segs] of byField) {
    segs.sort((a, b) => a.sentenceIndex - b.sentenceIndex);
    const parts = segs.map((seg) => {
      const translatedTagged = translations.get(seg.id) ?? seg.source;
      return expandTags(translatedTagged, seg.tags);
    });
    fieldValues.set(fieldKey, parts.join(' '));
  }

  // Walk original structure with same path logic as collectStrings,
  // replacing strings using the exact same key that was collected.
  function replaceIn(value: unknown, prefix: string): unknown {
    if (typeof value === 'string') {
      return fieldValues.get(prefix) ?? value;
    }
    if (Array.isArray(value)) {
      return value.map((v, i) => replaceIn(v, `${prefix}[${i}]`));
    }
    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        result[k] = replaceIn(v, prefix ? `${prefix}.${k}` : k);
      }
      return result;
    }
    return value;
  }

  return replaceIn(source, '') as Record<string, unknown>;
}

export { expandTags };
