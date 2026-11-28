import type { MatchStatus, Product } from "./types";
import { ALIAS_GROUPS } from "./vocabulary";
import { isFillerWord, isNonWordNoise } from "./noise";
import {
  diceCoefficient,
  levenshteinRatio,
  normalizeText,
  tokenize,
} from "./text";

export interface ProductScore {
  productId: string;
  score: number;
}

export interface ProductMatch {
  status: MatchStatus;
  productId: string | null;
  score: number;
  alternatives: ProductScore[];
}

const MATCH_THRESHOLD = 0.76;
const AMBIGUOUS_THRESHOLD = 0.58;
/** Two candidates this close must be confirmed by the shopkeeper. */
const DECISIVE_GAP = 0.06;

/**
 * Lowest score that may be shown as a candidate at all. Anything weaker is
 * treated as "not the product" — never as a weak match.
 */
export const MIN_CANDIDATE_SCORE = AMBIGUOUS_THRESHOLD;

/**
 * A one-word query may only be accepted when it clears this bar. Short words
 * share too many letters ("huu"/"dal"), so fuzzy single words need real
 * evidence — exact names and approved aliases sit far above it.
 */
const SINGLE_TOKEN_FUZZY_FLOOR = 0.8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function tokenVariants(token: string): string[] {
  const variants = [token];
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    variants.push(token.slice(0, -1));
  }
  return variants;
}

/** Similarity of a single spoken word to a single catalogue word. */
export function tokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const variantsA = tokenVariants(a);
  const variantsB = tokenVariants(b);
  for (const va of variantsA) {
    for (const vb of variantsB) {
      if (va === vb) return 0.99;
    }
  }
  if (a.length >= 4 && b.length >= 4) {
    if (a.startsWith(b) || b.startsWith(a)) return 0.88;
  }
  const charScore = Math.max(
    diceCoefficient(a, b),
    a.length >= 4 && b.length >= 4 ? levenshteinRatio(a, b) : 0,
  );
  return charScore >= 0.7 ? charScore : charScore * 0.6;
}

function containsSequence(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

function replaceSequence(tokens: string[], needle: string[], replacement: string[]): string[] {
  for (let i = 0; i <= tokens.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (tokens[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) return [...tokens.slice(0, i), ...replacement, ...tokens.slice(i + needle.length)];
  }
  return tokens;
}

/** Generate query variants with spoken Hinglish words expanded to concepts. */
function queryVariants(query: string): Array<{ text: string; expanded: boolean }> {
  const normalized = normalizeText(query);
  const tokens = tokenize(normalized);
  const variants: Array<{ text: string; expanded: boolean }> = [
    { text: normalized, expanded: false },
  ];
  const seen = new Set<string>([normalized]);

  for (const group of ALIAS_GROUPS) {
    for (const word of group.words) {
      const wordTokens = tokenize(normalizeText(word));
      if (wordTokens.length === 0) continue;
      if (!containsSequence(tokens, wordTokens)) continue;
      const replaced = replaceSequence(
        tokens,
        wordTokens,
        tokenize(normalizeText(group.concept)),
      );
      const text = replaced.join(" ").trim();
      if (text && !seen.has(text)) {
        seen.add(text);
        variants.push({ text, expanded: true });
      }
    }
  }
  return variants;
}

/** Every string a product can be recognised by. */
function productTargets(product: Product): string[] {
  const targets = new Set<string>();
  const add = (value: string) => {
    const normalized = normalizeText(value);
    if (normalized) targets.add(normalized);
  };
  add(product.name);
  for (const alias of product.aliases) add(alias);
  return [...targets];
}

function scoreAgainstTarget(query: string, target: string): number {
  if (!query || !target) return 0;
  if (query === target) return 1;
  const qTokens = tokenize(query);
  const tTokens = tokenize(target);
  if (qTokens.length === 0 || tTokens.length === 0) return 0;

  const allQueryTokensPresent = qTokens.every((qt) =>
    tTokens.some((tt) => tokenSimilarity(qt, tt) >= 0.92),
  );
  if (allQueryTokensPresent) {
    return clamp(0.95 - 0.015 * (tTokens.length - qTokens.length), 0.86, 0.95);
  }

  const allTargetTokensPresent = tTokens.every((tt) =>
    qTokens.some((qt) => tokenSimilarity(qt, tt) >= 0.92),
  );
  if (allTargetTokensPresent) return 0.9;

  if (qTokens.length === 1) {
    const qt = qTokens[0]!;
    if (qt.length < 3) return 0;
    const best = Math.max(...tTokens.map((tt) => tokenSimilarity(qt, tt)));
    if (best >= 0.86) return best * 0.93;
    if (best >= 0.7) return best * 0.82;
    return 0;
  }

  const perToken = qTokens.map((qt) =>
    Math.max(...tTokens.map((tt) => tokenSimilarity(qt, tt))),
  );
  const average = perToken.reduce((sum, value) => sum + value, 0) / perToken.length;
  const weakest = Math.min(...perToken);
  if (weakest < 0.55) return clamp(average * 0.72, 0, 0.82);
  return clamp(0.55 + 0.35 * average, 0, 0.88);
}

/**
 * Score how well a spoken query matches one product. Expansions of Hinglish
 * words ("chini" → "sugar") are slightly discounted so literal matches win.
 */
export function scoreProduct(query: string, product: Product): number {
  return evaluateProduct(query, product).score;
}

interface ProductEvaluation extends ProductScore {
  /** The query hit a product name or alias literally (no fuzzy guessing). */
  exact: boolean;
}

/**
 * Full evaluation for one product: best score plus whether the hit was a
 * literal name/alias (as opposed to a fuzzy similarity).
 */
function evaluateProduct(query: string, product: Product): ProductEvaluation {
  const targets = productTargets(product);
  if (targets.length === 0) return { productId: product.id, score: 0, exact: false };
  const variants = queryVariants(query);
  let best = 0;
  let exact = false;
  for (const variant of variants) {
    for (const target of targets) {
      const raw = scoreAgainstTarget(variant.text, target);
      if (raw === 1) exact = true;
      const score = variant.expanded ? raw * 0.985 : raw;
      if (score > best) best = score;
    }
  }
  return { productId: product.id, score: Math.round(best * 1000) / 1000, exact };
}

/** Rank every product against a query, best first. */
export function rankProducts(query: string, products: Product[]): ProductScore[] {
  return products
    .map((product) => evaluateProduct(query, product))
    .filter((entry) => entry.score > 0.35)
    .sort((a, b) => b.score - a.score)
    .map(({ productId, score }) => ({ productId, score }));
}

/**
 * Match a spoken product name to the catalogue.
 *
 * - `matched`   — confident, safe to prefill the bill.
 * - `ambiguous` — close candidates, the shopkeeper must confirm.
 * - `unmatched` — no confident match, never guessed.
 *
 * Strictness rules (billing accuracy beats recognition quantity):
 * - a literal product name / registered alias is always accepted first;
 * - a fuzzy single word needs strong similarity *and* a clear winner;
 * - filler words and non-word sounds ("huu", "hmm", "haan") are never
 *   promoted to a product, however similar they look to a catalogue word.
 */
export function matchProduct(query: string, products: Product[]): ProductMatch {
  const tokens = tokenize(normalizeText(query));
  // Weak evidence is not a candidate: it is shown to the shopkeeper only when
  // it clears the ambiguity floor, so a stray word cannot suggest a product.
  const evaluated = products
    .map((product) => evaluateProduct(query, product))
    .filter((entry) => entry.score >= AMBIGUOUS_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  const best = evaluated[0];
  const alternatives = evaluated.slice(0, 4).map(({ productId, score }) => ({ productId, score }));

  if (tokens.length === 0 || !best) {
    return { status: "unmatched", productId: null, score: 0, alternatives };
  }

  const isSingleNoiseToken =
    tokens.length === 1 &&
    !best.exact &&
    (isFillerWord(tokens[0]!) || isNonWordNoise(tokens[0]!));

  if (isSingleNoiseToken || best.score < AMBIGUOUS_THRESHOLD) {
    return { status: "unmatched", productId: null, score: best.score, alternatives };
  }

  if (tokens.length === 1 && !best.exact && best.score < SINGLE_TOKEN_FUZZY_FLOOR) {
    return { status: "unmatched", productId: null, score: best.score, alternatives };
  }

  const runnerUp = evaluated[1]?.score ?? 0;
  const decisive = best.score - runnerUp >= DECISIVE_GAP;

  if (best.score >= MATCH_THRESHOLD && decisive) {
    return { status: "matched", productId: best.productId, score: best.score, alternatives };
  }

  return {
    status: "ambiguous",
    productId: best.score >= MATCH_THRESHOLD ? best.productId : null,
    score: best.score,
    alternatives,
  };
}
