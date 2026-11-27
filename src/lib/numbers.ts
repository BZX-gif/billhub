import { normalizeText } from "./text";

/**
 * Hindi + English number vocabulary used in shop speech.
 * Words are stored raw (Devanagari and Latin) and normalised at module load,
 * so "paanch", "panch", "पांच" and "पाँच" all resolve to 5.
 */
const NUMBER_WORD_GROUPS: Array<[number, string[]]> = [
  [0, ["shunya", "zero", "सुन्ना", "शून्य"]],
  [1, ["ek", "one", "एक"]],
  [2, ["do", "two", "दो"]],
  [3, ["teen", "three", "tin", "तीन"]],
  [4, ["char", "chaar", "four", "चार"]],
  [5, ["panch", "paanch", "five", "पांच", "पाँच"]],
  [6, ["chhah", "chhe", "cheh", "six", "छह", "छे"]],
  [7, ["saat", "sat", "seven", "सात"]],
  [8, ["aath", "ath", "eight", "आठ"]],
  [9, ["nau", "nine", "नौ"]],
  [10, ["das", "ten", "दस"]],
  [11, ["gyarah", "eleven", "ग्यारह"]],
  [12, ["barah", "twelve", "बारह"]],
  [13, ["terah", "thirteen", "तेरह"]],
  [14, ["chaudah", "fourteen", "चौदह"]],
  [15, ["pandrah", "fifteen", "पंद्रह", "पन्द्रह"]],
  [16, ["solah", "sixteen", "सोलह"]],
  [17, ["satrah", "seventeen", "सत्रह"]],
  [18, ["atharah", "eighteen", "अठारह"]],
  [19, ["unnis", "nineteen", "उन्नीस"]],
  [20, ["bees", "twenty", "बीस"]],
  [21, ["ikkis", "इक्कीस"]],
  [24, ["chaubis", "चौबीस"]],
  [25, ["pachchis", "pachis", "पच्चीस"]],
  [30, ["tees", "thirty", "तीस"]],
  [40, ["chalees", "chalis", "forty", "चालीस"]],
  [50, ["pachas", "pachaas", "fifty", "पचास"]],
  [60, ["saath", "sixty", "साठ"]],
  [70, ["sattar", "seventy", "सत्तर"]],
  [80, ["assi", "eighty", "अस्सी"]],
  [90, ["nabbe", "ninety", "नब्बे"]],
  [100, ["sau", "hundred", "सौ"]],
  [1000, ["hazar", "hajar", "thousand", "हज़ार", "हजार"]],
];

/** Fraction words that stand alone. */
const FRACTION_WORDS: Array<[number, string[]]> = [
  [0.5, ["adha", "aadha", "ardha", "half", "आधा"]],
  [1.5, ["dedh", "dedha", "one and a half", "डेढ़"]],
  [2.5, ["dhai", "dhaai", "two and a half", "ढाई"]],
  [0.25, ["paav", "pao", "पाव"]],
  [0.75, ["teen paav", "तीन पाव"]],
  [1.25, ["sava", "sawa", "सवा"]],
];

/** Prefix words modify the following number: sawa 2 = 2.25, paune 2 = 1.75. */
const PREFIX_WORDS: Array<[number, string[]]> = [
  [0.25, ["sava", "sawa", "सवा"]],
  [-0.25, ["paune", "poune", "पौने"]],
  [0.5, ["sade", "saadhe", "साढ़े"]],
];

function buildMap(groups: Array<[number, string[]]>): Map<string, number> {
  const map = new Map<string, number>();
  for (const [value, words] of groups) {
    for (const word of words) {
      const key = normalizeText(word);
      if (!key) continue;
      if (!map.has(key)) map.set(key, value);
    }
  }
  return map;
}

export const NUMBER_WORDS = buildMap(NUMBER_WORD_GROUPS);
export const STANDALONE_FRACTIONS = buildMap(FRACTION_WORDS);
export const QUANTITY_PREFIXES = buildMap(
  PREFIX_WORDS.map(([value, words]) => [value, words] as [number, string[]]),
);

/** Parse a single token/number-word. Returns null when it is not a number. */
export function parseNumberToken(token: string): number | null {
  if (!token) return null;
  const normalized = normalizeText(token);
  if (!normalized) return null;

  if (NUMBER_WORDS.has(normalized)) return NUMBER_WORDS.get(normalized)!;
  if (STANDALONE_FRACTIONS.has(normalized)) return STANDALONE_FRACTIONS.get(normalized)!;

  const fraction = normalized.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    if (denominator > 0) return Math.round((numerator / denominator) * 1_000_000) / 1_000_000;
    return null;
  }

  if (/^\d+(?:\.\d+)?$/.test(normalized)) {
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

/** Parse a single fraction / prefix word (sava, paune, sade). */
export function parseQuantityPrefix(token: string): number | null {
  const normalized = normalizeText(token);
  if (!normalized) return null;
  return QUANTITY_PREFIXES.get(normalized) ?? null;
}

/**
 * Parse a run of tokens into a quantity.
 * Handles "3", "1.5", "1/2", "paanch", "dedh", "sava do", "paune teen".
 */
export function parseQuantityPhrase(tokens: string[]): number | null {
  if (tokens.length === 0) return null;
  let index = 0;
  let offset = 0;
  let base: number | null = null;

  const firstPrefix = parseQuantityPrefix(tokens[0]);
  if (firstPrefix !== null) {
    offset = firstPrefix;
    index = 1;
    if (index >= tokens.length) {
      // "sava kilo" → 1.25, "paune packet" → 0.75
      return 1 + offset;
    }
  }

  base = parseNumberToken(tokens[index]);
  if (base === null) return null;
  index++;
  if (index < tokens.length) return null; // stray words after the number

  const value = base + offset;
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 1_000_000) / 1_000_000;
}
