import { ExpirationCandidate } from './expiration-recognizer.port';

type DateMatch = {
  rawText: string;
  year: number;
  month: number;
  day: number;
  isFourDigitYear: boolean;
  requiresConfirmation: boolean;
  index: number;
  contextPriority: number;
};

const DATE_PATTERNS: Array<{
  expression: RegExp;
  toDateMatch: (match: RegExpExecArray) => DateMatch;
}> = [
  {
    expression:
      /(?<!\d)((?:19|20)\d{2})[ \t]*(?:[.\-/]|년)[ \t]*(\d{1,2})[ \t]*(?:[.\-/]|월)[ \t]*(\d{1,2})[ \t]*일?(?!\d)/g,
    toDateMatch: (match) => ({
      rawText: match[0],
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      isFourDigitYear: true,
      requiresConfirmation: false,
      index: match.index,
      contextPriority: 0,
    }),
  },
  {
    expression: /(?<!\d)((?:19|20)\d{2})(\d{2})(\d{2})(?!\d)/g,
    toDateMatch: (match) => ({
      rawText: match[0],
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      isFourDigitYear: true,
      requiresConfirmation: false,
      index: match.index,
      contextPriority: 0,
    }),
  },
  {
    expression: /(?<!\d)((?:19|20)\d{2})[ \t]+(\d{2})(\d{2})(?!\d)/g,
    toDateMatch: (match) => ({
      rawText: match[0],
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      isFourDigitYear: true,
      requiresConfirmation: false,
      index: match.index,
      contextPriority: 0,
    }),
  },
  {
    expression:
      /(?<!\d)((?:19|20)\d{2})[ \t]+(\d{1,2})[ \t]*[.\-/][ \t]*(\d{2})/g,
    toDateMatch: (match) => ({
      rawText: match[0],
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      isFourDigitYear: true,
      requiresConfirmation: false,
      index: match.index,
      contextPriority: 0,
    }),
  },
  {
    expression: /(?<!\d)((?:19|20)\d{2})[ \t]+(\d{1,2})[ \t]+(\d{1,2})(?!\d)/g,
    toDateMatch: (match) => ({
      rawText: match[0],
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      isFourDigitYear: true,
      requiresConfirmation: false,
      index: match.index,
      contextPriority: 0,
    }),
  },
  {
    expression: /(?<!\d)(\d{2})[ \t]*[.\-/][ \t]*(\d{1,2})[ \t]*[.\-/][ \t]*(\d{1,2})(?!\d)/g,
    toDateMatch: (match) => ({
      rawText: match[0],
      year: 2000 + Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      isFourDigitYear: false,
      requiresConfirmation: true,
      index: match.index,
      contextPriority: 0,
    }),
  },
  {
    expression:
      /(?<!\d)((?:19|20)\d{2})[ \t]*[.\-/][ \t]*(\d{1,2})[ \t]*[.\-/][ \t]*(\d{2})(?=\d{1,4}(?!\d))/g,
    toDateMatch: (match) => ({
      rawText: match[0],
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      isFourDigitYear: true,
      requiresConfirmation: true,
      index: match.index,
      contextPriority: 0,
    }),
  },
];

export function extractExpirationDateCandidates(
  text: string,
  confidence: number,
): ExpirationCandidate[] {
  const validMatches = DATE_PATTERNS.flatMap(({ expression, toDateMatch }) => {
    expression.lastIndex = 0;
    return Array.from(text.matchAll(expression), toDateMatch);
  }).filter(isValidDate);
  const fourDigitRanges = validMatches
    .filter((match) => match.isFourDigitYear)
    .map((match) => ({
      start: match.index,
      end: match.index + match.rawText.length,
    }));

  const matches = validMatches
    .filter(
      (match) =>
        match.isFourDigitYear ||
        !fourDigitRanges.some(
          (range) =>
            match.index < range.end &&
            match.index + match.rawText.length > range.start,
        ),
    )
    .map((match) => ({
      ...match,
      contextPriority: getContextPriority(text, match),
    }))
    .sort(
      (a, b) => b.contextPriority - a.contextPriority || a.index - b.index,
    );

  const uniqueDates = new Map<string, ExpirationCandidate>();
  for (const match of matches) {
    const expirationDate = formatDate(match.year, match.month, match.day);
    const candidate = {
      rawText: match.rawText.trim(),
      expirationDate,
      confidence: normalizeConfidence(confidence),
      requiresConfirmation: match.requiresConfirmation,
    };
    const existing = uniqueDates.get(expirationDate);

    if (!existing || (existing.requiresConfirmation && !candidate.requiresConfirmation)) {
      uniqueDates.set(expirationDate, candidate);
    }
  }

  return [...uniqueDates.values()];
}

function getContextPriority(text: string, match: DateMatch) {
  const before = text.slice(Math.max(0, match.index - 16), match.index);
  const after = text.slice(
    match.index + match.rawText.length,
    match.index + match.rawText.length + 12,
  );

  if (/유통\s*기한\s*:?\s*$|소비\s*기한\s*:?\s*$/.test(before)) {
    return 2;
  }
  if (/^\s*(?:까지|까[지자])/.test(after)) {
    return 1;
  }
  return 0;
}

function isValidDate(match: DateMatch) {
  const date = new Date(Date.UTC(match.year, match.month - 1, match.day));
  return (
    date.getUTCFullYear() === match.year &&
    date.getUTCMonth() === match.month - 1 &&
    date.getUTCDate() === match.day
  );
}

function formatDate(year: number, month: number, day: number) {
  return [year, month, day]
    .map((value, index) => String(value).padStart(index === 0 ? 4 : 2, '0'))
    .join('-');
}

function normalizeConfidence(confidence: number) {
  if (!Number.isFinite(confidence)) {
    return 0;
  }
  return Math.min(1, Math.max(0, confidence / 100));
}
