/**
 * Speech noise detection (fillers, hesitation sounds, non-speech noise).
 *
 * Two layers:
 *  - `isFillerWord`   — known conversational filler / interjection words.
 *  - `isNonWordNoise` — sounds that are not words at all ("huu", "hmm", "aaa").
 *
 * Both layers are only applied to words the shop's catalogue does not use, so
 * a real product name that happens to look like a filler word is never lost
 * (see `parseUtterance` / `matchProduct`).
 *
 * Everything here works on `normalizeText()` output (lowercase, transliterated,
 * canonical spelling), so "achha", "अच्छा" and "accha" all collapse to "aca".
 */
import { normalizeText } from "./text";
import { FILLER_TOKENS, unitForWord } from "./vocabulary";

/**
 * Extra spoken fillers on top of the shared lexicon. Devanagari forms are
 * covered automatically because the whole pipeline transliterates first
 * (हूँ → hun, अच्छा → aca, जी → ji, …).
 */
const EXTRA_FILLER_WORDS = [
  // Hesitations
  "hu", "huu", "huuu", "huh", "hmm", "hmmm", "hmmmm", "ha", "haa", "han", "hn",
  // Agreement / acknowledgement
  "haan", "haanji", "yes", "yeah", "yep", "no", "nope", "nah", "na", "nai",
  "acha", "accha", "achha", "achcha", "ji", "jee", "ok", "okay", "oke", "okei",
  "theek", "teek", "thik", "sahi",
  // Discourse markers / exclamations
  "arey", "arre", "aray", "matlab", "mtlb", "means", "bas", "bass",
  // Courtesy and address words that carry no product meaning
  "please", "plz", "plij", "kripya", "bhai", "bhaiya", "sir", "madam",
];

const EXTRA_FILLER_TOKENS: Set<string> = new Set(
  EXTRA_FILLER_WORDS.map((word) => normalizeText(word)).filter(Boolean),
);

/** True when the (normalised) token is a known conversational filler. */
export function isFillerWord(token: string): boolean {
  const key = normalizeText(token);
  if (!key) return false;
  return FILLER_TOKENS.has(key) || EXTRA_FILLER_TOKENS.has(key);
}

/**
 * True when a token is a non-word sound rather than speech: "huu", "hmmm",
 * "aaaa", "hm". Deliberately conservative — a plausible word such as "msg" or
 * "bun" is never classified as noise, it simply stays unmatched.
 */
export function isNonWordNoise(token: string): boolean {
  const key = normalizeText(token);
  if (!key) return true;
  if (isFillerWord(key)) return true;
  if (unitForWord(key)) return false; // "no", "g", "pc" are units, not noise
  if (/\d/.test(key)) return false;
  if (key.length < 3) return true; // stray letters: "hu", "x"
  if (/(.)\1{2,}/.test(key)) return true; // "aaaa", "hhhh"
  // A hum: only breathing consonants/vowels, e.g. "huu", "mmm", "hnn".
  if (/^[haeioumn]+$/.test(key) && key.length <= 4) return true;
  return false;
}
