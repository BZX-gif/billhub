/**
 * Text normalisation used by speech parsing and product matching.
 *
 * Hindi can arrive in Devanagari (hi-IN) or in Latin transliteration
 * ("chini", "aata"). We transliterate Devanagari to a rough Latin form and
 * then apply a light Hinglish spelling canonicalisation to BOTH the spoken
 * text and the catalogue aliases. Because both sides go through the same
 * pipeline, informal spellings still line up.
 */

const DEVANAGARI_CHARS: Record<string, string> = {
  // Independent vowels
  अ: "a", आ: "aa", इ: "i", ई: "i", उ: "u", ऊ: "u", ऋ: "ri", ए: "e", ऐ: "ai",
  ओ: "o", औ: "au", ऍ: "e", ऑ: "o", ऎ: "e", ऒ: "o",
  // Matras
  "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "ृ": "ri", "े": "e",
  "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o", "ॅ": "e", "ॆ": "e", "ॊ": "o",
  // Consonants
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "n",
  च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "n",
  ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n",
  त: "t", थ: "th", द: "d", ध: "dh", न: "n",
  प: "p", फ: "ph", ब: "b", भ: "bh", म: "m",
  य: "y", र: "r", ल: "l", व: "v", श: "sh", ष: "sh", स: "s", ह: "h",
  ळ: "l", क़: "q", ख़: "kh", ग़: "g", ज़: "z", ड़: "r", ढ़: "rh", फ़: "f",
  // Marks
  "ं": "n", "ँ": "n", "ः": "h", "्": "", "़": "", "ऽ": "",
  "।": " ", "॥": " ", "॰": " ",
};

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

/** Transliterate Devanagari characters to a rough Latin equivalent. */
export function transliterate(input: string): string {
  let out = "";
  for (const char of input) {
    out += DEVANAGARI_CHARS[char] ?? char;
  }
  return out;
}

/** Convert Devanagari (and a few other Indic) digits to ASCII digits. */
export function normalizeDigits(input: string): string {
  return input.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
}

/** Common spoken fractions written as symbols. */
function expandFractionSymbols(input: string): string {
  return input
    .replace(/½/g, " 0.5 ")
    .replace(/¼/g, " 0.25 ")
    .replace(/¾/g, " 0.75 ")
    .replace(/⅓/g, " 0.333 ")
    .replace(/⅔/g, " 0.667 ");
}

/**
 * Canonical spelling for matching. Applied identically to spoken text and
 * catalogue aliases so that "chini" / "cheeni" / "चीनी" converge.
 */
export function canonicalSpelling(token: string): string {
  return token
    .replace(/ph/g, "f")
    .replace(/chh/g, "c")
    .replace(/ch/g, "c")
    .replace(/sh/g, "s")
    .replace(/ksh/g, "ks")
    .replace(/([kgjpbtdq])h/g, "$1")
    .replace(/v/g, "w")
    .replace(/([bcdfgjklmnpqrstvwxyz])\1+/g, "$1")
    .replace(/aa/g, "a")
    .replace(/y$/g, "i");
}

/**
 * Normalise free text for parsing and matching:
 * lowercase, transliterate, convert digits, strip punctuation, canonical spelling.
 */
export function normalizeText(input: string): string {
  if (!input) return "";
  let text = expandFractionSymbols(normalizeDigits(input.normalize("NFC").toLowerCase()));
  text = transliterate(text);
  text = text
    .replace(/&/g, " aur ")
    .replace(/[^a-z0-9./\s-]/g, " ")
    .replace(/-/g, " ")
    // "2kg" → "2 kg", "500ml" → "500 ml"
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  return text
    .split(" ")
    .map((token) => canonicalSpelling(token))
    .filter(Boolean)
    .join(" ");
}

/** Display-friendly cleanup, keeps the user's original words. */
export function tidyName(input: string): string {
  const cleaned = input
    .replace(/[.,;:!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned
    .split(" ")
    .map((word) =>
      word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word,
    )
    .join(" ");
}

export function tokenize(normalized: string): string[] {
  return normalized.split(/\s+/).filter(Boolean);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[b.length] ?? Math.max(a.length, b.length);
}

export function levenshteinRatio(a: string, b: string): number {
  if (!a && !b) return 1;
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/** Sørensen–Dice coefficient over character bigrams. */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const bigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const gram = a.slice(i, i + 2);
    bigrams.set(gram, (bigrams.get(gram) ?? 0) + 1);
  }
  let hits = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const gram = b.slice(i, i + 2);
    const count = bigrams.get(gram) ?? 0;
    if (count > 0) {
      bigrams.set(gram, count - 1);
      hits++;
    }
  }
  return (2 * hits) / (a.length - 1 + (b.length - 1));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

export function uniqueBy<T, K>(items: T[], key: (item: T) => K): T[] {
  const seen = new Set<K>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}
