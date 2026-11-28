/**
 * Stitching overheard speech into one running bill.
 *
 * Browser recognition chops speech into short final chunks. Someone who says
 * "3 kilo chini" … (pauses) … "aur 2 kilo aata" arrives as two chunks that only
 * make sense together. These helpers merge chunks the way a person would read
 * them aloud, without ever inventing or dropping a product word.
 */
import { cleanTranscript } from "./speech";
import { isFillerWord, isNonWordNoise } from "./noise";
import { normalizeText, tokenize } from "./text";
import { unitForWord } from "./vocabulary";

/** Particles that continue the previous sentence ("aur 2 kilo aata"). */
const CONTINUATION_PREFIXES = [
  "aur", "and", "or", "plus", "with", "also", "phir", "fir", "fir se", "wapis",
  "wapas", "continue", "continued", "remaining", "more", "uske", "iske", "baad",
  "और", "फिर", "फ़िर", "वापस", "बाकी", "बाक़ी", "और भी", "उसके", "बाद",
];

/** Polite/lead-in words that should not split a list either. */
const LEAD_IN_WORDS = ["ok", "okay", "acha", "accha", "ji", "haan", "hmm", "umm", "uh"];

/** Words that explicitly mean "start a fresh bill". */
const CLEAR_PATTERN = /^(clear|reset|cancel|start over|start again|naya bill|naya hisaab|साफ|रद्द|नया बिल|नया हिसाब|नई लिस्ट|नई लिस्ट शुरू)$/i;

function firstWord(text: string): string {
  return text.split(/\s+/)[0] ?? "";
}

/**
 * True when `next` simply carries on the previous chunk, so the two should be
 * appended to the same line instead of starting a new one.
 */
export function continuesPrevious(previous: string, next: string): boolean {
  const before = cleanTranscript(previous);
  const after = cleanTranscript(next);
  if (!before || !after) return false;

  // "3 kilo" + "chini" → the previous chunk stopped right after a quantity.
  if (/\b(aur|and|plus|with|or|of|ka|ki|ke|se|me|mein|में|का|की|के)$/i.test(before)) {
    return true;
  }
  const beforeTokens = before.toLowerCase().split(/\s+/);
  const lastWord = beforeTokens[beforeTokens.length - 1] ?? "";
  if (unitForWord(lastWord) && !/^\d/.test(after)) return true;

  const head = after.toLowerCase();
  const firstTwo = head.split(/\s+/).slice(0, 2).join(" ");
  if (CONTINUATION_PREFIXES.includes(firstWord(head)) || CONTINUATION_PREFIXES.includes(firstTwo)) {
    return true;
  }
  if (LEAD_IN_WORDS.includes(firstWord(head))) return true;

  // "…3 kilo chini" + "2 kilo aata": a bare quantity start is a new item.
  return false;
}

/** Join two chunks, collapsing the duplicated continuation word. */
export function appendChunk(previous: string, next: string): string {
  const before = cleanTranscript(previous);
  const after = cleanTranscript(next);
  if (!before) return after;
  if (!after) return before;
  if (before.toLowerCase().endsWith(after.toLowerCase())) return before;

  const head = firstWord(after).toLowerCase();
  if (CONTINUATION_PREFIXES.includes(head)) {
    const rest = after.slice(firstWord(after).length).trim();
    // Keep the connector when the previous chunk ended on a word ("aur" is the
    // natural joiner), drop it only when it would read as "…3 kilo aur".
    if (!rest) return before;
    if (/\b(aur|and|plus|with|or)$/i.test(before)) return `${before} ${rest}`;
    return `${before} ${after}`;
  }
  return `${before} ${after}`;
}

/**
 * Append a chunk to a list, merging it into the last line when it continues
 * that line. Returns the new list (never mutates the input).
 */
export function appendToList(list: string[], chunk: string): string[] {
  const text = cleanTranscript(chunk);
  if (!text) return list;
  const last = list[list.length - 1];
  if (last && continuesPrevious(last, text)) {
    return [...list.slice(0, -1), appendChunk(last, text)];
  }
  return [...list, text];
}

/** True when the transcript is a spoken command to reset the bill. */
export function isClearCommand(text: string): boolean {
  return CLEAR_PATTERN.test(cleanTranscript(text));
}

/**
 * True when nothing was said except hesitation ("hmm", "uh", "…"): the session
 * should stay listening and show no error for this.
 */
export function isHesitationOnly(text: string): boolean {
  const cleaned = cleanTranscript(text);
  if (!cleaned) return true;
  // Punctuation only ("…", "??") carries no words at all.
  if (!/[\p{L}\p{N}]/u.test(cleaned)) return true;
  const tokens = tokenize(normalizeText(cleaned));
  if (tokens.length === 0) return true;
  return tokens.every((token) => isFillerWord(token) || isNonWordNoise(token));
}
