import type { DraftItem, Product, Unit } from "./types";
import type { ParsedItem } from "./parser";
import { matchProduct } from "./matching";
import { convertQuantity, formatQuantity, isUnit } from "./units";
import { createId } from "./ids";
import { tidyName } from "./text";

function emptyItem(overrides: Partial<DraftItem>): DraftItem {
  return {
    id: createId("item"),
    productId: null,
    name: "",
    quantity: 1,
    unit: "piece",
    unitPrice: 0,
    source: "voice",
    alternatives: [],
    matchStatus: "unmatched",
    needsReview: true,
    ...overrides,
  };
}

/**
 * Fit a parsed (spoken) quantity/unit onto a catalogue product's unit.
 * Compatible units are converted (500 gram of a kg-priced product → 0.5 kg).
 * Incompatible units are kept as spoken and flagged for review.
 */
export function fitQuantityToProduct(
  quantity: number,
  spokenUnit: Unit | null,
  product: Product,
): { quantity: number; unit: Unit; notice?: string; mismatch?: boolean } {
  if (!spokenUnit || spokenUnit === product.unit) {
    return { quantity, unit: product.unit };
  }
  const converted = convertQuantity(quantity, spokenUnit, product.unit);
  if (converted !== null) {
    return {
      quantity: converted,
      unit: product.unit,
      notice:
        `${formatQuantity(quantity)} ${spokenUnit} = ${formatQuantity(converted)} ${product.unit}`,
    };
  }
  return {
    quantity,
    unit: product.unit,
    mismatch: true,
  };
}

/** Build a draft line from one spoken fragment. Never invents prices. */
export function createDraftItemFromParsed(
  parsed: ParsedItem,
  products: Product[],
  source: DraftItem["source"] = "voice",
): DraftItem {
  const match = matchProduct(parsed.query, products);
  const notes = parsed.notes.join(" · ");
  const base: Partial<DraftItem> = {
    source,
    rawText: parsed.raw,
    alternatives: match.alternatives.map(({ productId, score }) => ({ productId, score })),
    notice: notes || undefined,
  };

  if (match.status === "matched" && match.productId) {
    const product = products.find((candidate) => candidate.id === match.productId);
    if (product) {
      const fitted = fitQuantityToProduct(parsed.quantity, parsed.unit, product);
      return emptyItem({
        ...base,
        productId: product.id,
        name: product.name,
        quantity: fitted.quantity,
        unit: fitted.unit,
        unitPrice: product.price,
        matchStatus: "matched",
        needsReview: Boolean(fitted.mismatch),
        reviewReason: fitted.mismatch
          ? `You said "${parsed.unit}", but ${product.name} is sold per ${product.unit}. Please check the quantity or unit.`
          : undefined,
        notice: [notes, fitted.notice].filter(Boolean).join(" · ") || undefined,
      });
    }
  }

  if (match.status === "ambiguous") {
    const product = match.productId
      ? products.find((candidate) => candidate.id === match.productId)
      : undefined;
    if (product) {
      const fitted = fitQuantityToProduct(parsed.quantity, parsed.unit, product);
      return emptyItem({
        ...base,
        productId: product.id,
        name: product.name,
        quantity: fitted.quantity,
        unit: fitted.unit,
        unitPrice: product.price,
        matchStatus: "ambiguous",
        needsReview: true,
        reviewReason: `Is this ${product.name}? Confirm the product before billing.`,
        notice: [notes, fitted.notice].filter(Boolean).join(" · ") || undefined,
      });
    }
  }

  // Unmatched or ambiguous without a usable candidate: never guess a product
  // or a price. The shopkeeper must choose or create one.
  const guessedUnit: Unit = parsed.unit && isUnit(parsed.unit) ? parsed.unit : "piece";
  return emptyItem({
    ...base,
    productId: null,
    name: tidyName(parsed.query) || "Unknown item",
    quantity: parsed.quantity,
    unit: guessedUnit,
    unitPrice: 0,
    matchStatus: match.status === "ambiguous" ? "ambiguous" : "unmatched",
    needsReview: true,
    reviewReason:
      match.status === "ambiguous"
        ? "More than one product matches. Choose the right one."
        : "This product is not in your catalogue. Choose a product or add it.",
  });
}

/** Attach a catalogue product to an unresolved line. */
export function applyProductToItem(item: DraftItem, product: Product): DraftItem {
  const fitted = fitQuantityToProduct(item.quantity, item.unit, product);
  return {
    ...item,
    productId: product.id,
    name: product.name,
    quantity: fitted.quantity,
    unit: fitted.unit,
    unitPrice: product.price,
    matchStatus: "matched",
    needsReview: Boolean(fitted.mismatch),
    reviewReason: fitted.mismatch
      ? `Quantity unit changed to ${product.unit} because ${product.name} is sold in ${product.unit}.`
      : undefined,
    alternatives: [],
    notice: [item.notice, fitted.notice].filter(Boolean).join(" · ") || undefined,
  };
}

/** Refresh price/name of a line after its catalogue product is edited. */
export function syncItemWithProduct(item: DraftItem, products: Product[]): DraftItem {
  if (!item.productId) return item;
  const product = products.find((candidate) => candidate.id === item.productId);
  if (!product) {
    return {
      ...item,
      productId: null,
      matchStatus: "unmatched",
      needsReview: true,
      reviewReason: "This product was removed from your catalogue. Choose another product.",
    };
  }
  return {
    ...item,
    name: product.name,
    unit: product.unit,
    unitPrice: product.price,
  };
}

/** Convert a manual line into a custom (non-catalogue) line. */
export function markItemAsCustom(item: DraftItem, price: number): DraftItem {
  return {
    ...item,
    productId: null,
    matchStatus: "custom",
    unitPrice: Math.max(0, Math.round(price * 100) / 100),
    needsReview: false,
    reviewReason: undefined,
    alternatives: [],
  };
}
