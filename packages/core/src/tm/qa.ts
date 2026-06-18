export interface QAError {
  code: string;
  message: string;
}

export interface QAResult {
  passed: boolean;
  errors: QAError[];
}

const TAG_RE = /\{(\d+)\}/g;

function extractTagSet(text: string): Set<string> {
  const tags = new Set<string>();
  for (const m of text.matchAll(TAG_RE)) tags.add(m[1]!);
  return tags;
}

export function runQA(source: string, target: string): QAResult {
  const errors: QAError[] = [];

  if (!target.trim()) {
    errors.push({ code: 'EMPTY_TARGET', message: 'Target segment is empty' });
    return { passed: false, errors };
  }

  const sourceTags = extractTagSet(source);
  const targetTags = extractTagSet(target);

  const missing = [...sourceTags].filter((t) => !targetTags.has(t));
  if (missing.length > 0) {
    errors.push({
      code: 'MISSING_TAGS',
      message: `Tags present in source but missing in target: {${missing.join('}, {')}}`,
    });
  }

  const extra = [...targetTags].filter((t) => !sourceTags.has(t));
  if (extra.length > 0) {
    errors.push({
      code: 'EXTRA_TAGS',
      message: `Tags in target not present in source: {${extra.join('}, {')}}`,
    });
  }

  if (source.trim().length > 0) {
    const ratio = target.length / source.length;
    if (ratio < 0.2 || ratio > 5.0) {
      errors.push({
        code: 'LENGTH_RATIO',
        message: `Target/source length ratio ${ratio.toFixed(2)} is outside [0.2, 5.0]`,
      });
    }
  }

  return { passed: errors.length === 0, errors };
}
