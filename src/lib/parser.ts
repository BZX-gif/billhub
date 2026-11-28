import { parseNumberToken, parseQuantityPrefix } from "./numbers";
import { normalizeText, tokenize } from "./text";
import { clampQuantity, convertQuantity } from "./units";
import { PHRASE_NUMBER_FIXES, unitForWord } from "./vocabulary";
import { isFillerWord, isNonWordNoise } from "./noise";
import type { Product, Unit } from "./types";

export interface ParsedItem {
  /** The spoken fragment this item came from. */
  raw: string;
  /** Cleaned product words (before catalogue matching). */
  query: string;
  quantity: number;
  /** Unit exactly as spoken, null when the shopkeeper did not say one. */
  unit: Unit | null;
  explicitQuantity: boolean;
  explicitUnit: boolean;
  notes: string[];
}

export interface ParseResult {
  items: ParsedItem[];
  /** Fragments that had no recognisable product. */
  ignored: string[];
  /** Fragments that were only filler / non-speech noise (dropped silently). */
  noise: string[];
}

const RAW_SPLIT_REGEX =
  /\s+(?:aur|and|plus|with|fir|phir|add|और)\s+|[,;]\s*|\s*\n+\s*/i;

interface QuantityGroup {
  value: number;
  unit: Unit | null;
  indexes: number[];
}

function findUnitNear(tokens: string[], from: number): { unit: Unit; index: number } | null {
  for (let i = from; i < Math.min(tokens.length, from + 2); i++) {
    const unit = unitForWord(tokens[i]);
    if (unit) return { unit, index: i };
  }
  return null;
}

function extractQuantities(tokens: string[]): QuantityGroup[] {
  const groups: QuantityGroup[] = [];
  const used = new Set<number>();

  for (let i = 0; i < tokens.length; i++) {
    if (used.has(i)) continue;
    const prefix = parseQuantityPrefix(tokens[i]);
    const direct = parseNumberToken(tokens[i]);

    if (prefix !== null && direct === null) {
      const nextNumber = i + 1 < tokens.length ? parseNumberToken(tokens[i + 1]) : null;
      if (nextNumber !== null) {
        const unit = findUnitNear(tokens, i + 2);
        const indexes = [i, i + 1];
        if (unit) indexes.push(unit.index);
        groups.push({ value: nextNumber + prefix, unit: unit?.unit ?? null, indexes });
        indexes.forEach((index) => used.add(index));
        continue;
      }
      const unit = findUnitNear(tokens, i + 1);
      const indexes = [i];
      if (unit) indexes.push(unit.index);
      groups.push({ value: 1 + prefix, unit: unit?.unit ?? null, indexes });
      indexes.forEach((index) => used.add(index));
      continue;
    }

    if (direct !== null) {
      const unit = findUnitNear(tokens, i + 1);
      const indexes = [i];
      if (unit) indexes.push(unit.index);
      groups.push({ value: direct, unit: unit?.unit ?? null, indexes });
      indexes.forEach((index) => used.add(index));
    }
  }

  return groups;
}

function mergeGroups(groups: QuantityGroup[], notes: string[]): { quantity: number; unit: Unit | null } {
  const valid = groups.filter((group) => Number.isFinite(group.value) && group.value >= 0);
  if (valid.length === 0) return { quantity: 0, unit: null };
  const first = valid[0]!;
  if (valid.length === 1) return { quantity: clampQuantity(first.value), unit: first.unit };

  const targetUnit = valid.find((group) => group.unit)?.unit ?? null;
  if (!targetUnit) {
    return { quantity: clampQuantity(valid.reduce((sum, group) => sum + group.value, 0)), unit: null };
  }

  let total = 0;
  let convertedAny = false;
  for (const group of valid) {
    const from = group.unit ?? targetUnit;
    const converted = convertQuantity(group.value, from, targetUnit);
    if (converted === null) continue;
    total += converted;
    if (group.unit && group.unit !== targetUnit) convertedAny = true;
  }
  if (!Number.isFinite(total) || total <= 0) {
    return { quantity: clampQuantity(first.value), unit: first.unit };
  }
  if (convertedAny) notes.push("Combined quantities into one unit");
  return { quantity: clampQuantity(total), unit: targetUnit };
}

/**
 * Decide whether a normalised token is conversational noise *in this
 * fragment*, given the tokens that surround it.
 *
 * - `"no"` / `"na"` right after a number is the piece unit ("2 no sabun").
 * - Any other unit word ("2 kg", "500 ml") is never noise.
 * - Everything else that is a known filler or a non-word sound is dropped.
 */
function isNoiseToken(token: string, index: number, tokens: string[]): boolean {
  // Numbers are never noise: "do" is the Hindi word for two, "paune do kilo"
  // must stay 1.75 kg, not collapse to "paune kilo".
  if (parseNumberToken(token) !== null || parseQuantityPrefix(token) !== null) {
    return false;
  }
  if (unitForWord(token)) {
    const previous = index > 0 ? tokens[index - 1] : undefined;
    // Unit words such as "no"/"na"/"g" only mean a unit when a quantity is
    // spoken right before them; standing alone they are fillers ("no").
    const isAmbiguousUnit = token === "no" || token === "na";
    if (!isAmbiguousUnit) return false;
    if (!previous || parseNumberToken(previous) === null) {
      return isFillerWord(token);
    }
    return false;
  }
  return isFillerWord(token) || isNonWordNoise(token);
}

/**
 * Keep every word that the shop's catalogue actually recognises, so a product
 * whose name overlaps a filler word is never lost ("No Sugar" sweetener,
 * "Haan Wala Atta"). Returns the indexes that must be preserved.
 */
function catalogueProtectedIndexes(tokens: string[], products?: Product[]): Set<number> {
  const protectedIndexes = new Set<number>();
  if (!products || products.length === 0) return protectedIndexes;

  for (const product of products) {
    const targets = [product.name, ...product.aliases]
      .map((value) => tokenize(normalizeText(value)))
      .filter((target) => target.length > 0);
    for (const target of targets) {
      if (target.length === 1) {
        const index = tokens.indexOf(target[0]!);
        if (index >= 0) protectedIndexes.add(index);
        continue;
      }
      for (let i = 0; i <= tokens.length - target.length; i++) {
        let hit = true;
        for (let j = 0; j < target.length; j++) {
          if (tokens[i + j] !== target[j]) {
            hit = false;
            break;
          }
        }
        if (hit) {
          for (let j = 0; j < target.length; j++) protectedIndexes.add(i + j);
        }
      }
    }
  }
  return protectedIndexes;
}

/**
 * Turn a spoken/typed utterance into structured line items.
 * Multiple products separated by "aur" / "and" / commas are supported.
 *
 * When `products` is supplied, filler filtering becomes catalogue aware: a
 * word is only dropped when it is *not* part of a real product name.
 */
export function parseUtterance(input: string, products?: Product[]): ParseResult {
  const items: ParsedItem[] = [];
  const ignored: string[] = [];
  const noise: string[] = [];
  if (!input || !input.trim()) return { items, ignored, noise };

  let prepared = input;
  for (const [pattern, replacement] of PHRASE_NUMBER_FIXES) {
    prepared = prepared.replace(pattern, replacement);
  }

  const rawSegments = prepared
    .split(RAW_SPLIT_REGEX)
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const raw of rawSegments) {
    const normalized = normalizeText(raw);
    const allTokens = tokenize(normalized);
    if (allTokens.length === 0) continue;

    const preserved = catalogueProtectedIndexes(allTokens, products);
    const keptIndexes: number[] = [];
    allTokens.forEach((token, index) => {
      if (preserved.has(index) || !isNoiseToken(token, index, allTokens)) {
        keptIndexes.push(index);
      }
    });

    // Nothing but filler / noise: drop it silently instead of creating a line.
    if (keptIndexes.length === 0) {
      noise.push(raw);
      continue;
    }

    const tokens = keptIndexes.map((index) => allTokens[index]!);
    const notes: string[] = [];
    const groups = extractQuantities(tokens);
    const consumed = new Set<number>();
    groups.forEach((group) => group.indexes.forEach((index) => consumed.add(index)));

    const nameTokens = tokens.filter((_, index) => !consumed.has(index));
    const query = nameTokens.join(" ").trim();
    const explicitQuantity = groups.length > 0;

    // A single stray character ("a", "x") is never a real product; ignore it
    // rather than creating a line the shopkeeper has to clean up.
    if (!query || query.length < 2) {
      ignored.push(raw);
      continue;
    }

    // A lone non-word sound ("huu", "hmmm", "zzzz") is noise, not a product.
    // Catalogue words are always kept, so this can never drop a real product.
    // A measured hum ("3 kg huu") is dropped here too, but reported as ignored
    // because only the quantity survived — the shopkeeper still sees why.
    const isProtected = keptIndexes.some((index) => preserved.has(index));
    if (!isProtected && nameTokens.every((token) => isNonWordNoise(token))) {
      (explicitQuantity ? ignored : noise).push(raw);
      continue;
    }

    const merged = groups.length
      ? mergeGroups(groups, notes)
      : { quantity: 1, unit: null as Unit | null };
    const explicitUnit = groups.some((group) => group.unit !== null);

    if (!explicitQuantity) notes.push("Quantity not spoken — set to 1");
    if (explicitQuantity && merged.quantity === 0) {
      ignored.push(raw);
      continue;
    }

    items.push({
      raw,
      query,
      quantity: merged.quantity,
      unit: merged.unit,
      explicitQuantity,
      explicitUnit,
      notes,
    });
  }

  // De-duplicate identical products inside a single utterance (e.g. repeated
  // recognition of the same phrase) by merging their quantities.
  const deduped: ParsedItem[] = [];
  for (const item of items) {
    const existing = deduped.find(
      (candidate) =>
        candidate.query === item.query && (candidate.unit ?? null) === (item.unit ?? null),
    );
    if (existing) {
      existing.quantity = clampQuantity(existing.quantity + item.quantity);
      existing.raw = `${existing.raw}, ${item.raw}`;
      existing.notes.push("Merged repeated mention");
    } else {
      deduped.push({ ...item, notes: [...item.notes] });
    }
  }

  return { items: deduped, ignored, noise };
}
