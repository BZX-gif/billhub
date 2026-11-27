import { createId } from "./ids";
import { normalizeText } from "./text";
import { DEFAULT_SETTINGS } from "./types";
import type { Product, Settings, Unit } from "./types";
import { isUnit, roundMoney } from "./units";

export interface ProductInput {
  name: string;
  price: number;
  unit: Unit;
  aliases: string[];
}

export interface ProductFormValues {
  name: string;
  price: string;
  unit: Unit;
  aliases: string;
}

export function normalizeAliases(raw: string | string[]): string[] {
  const parts = Array.isArray(raw) ? raw : raw.split(",");
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const part of parts) {
    const alias = part.trim().replace(/\s+/g, " ");
    if (!alias) continue;
    if (alias.length > 60) continue;
    const key = normalizeText(alias);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    aliases.push(alias);
    if (aliases.length >= 20) break;
  }
  return aliases;
}

export function validateProductInput(
  values: ProductFormValues,
  products: Product[],
  excludeId?: string,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = values.name.trim();
  if (!name) {
    errors.name = "Enter the product name.";
  } else if (name.length > 80) {
    errors.name = "Product name is too long (max 80 characters).";
  } else {
    const duplicate = products.find(
      (product) =>
        product.id !== excludeId &&
        normalizeText(product.name) === normalizeText(name),
    );
    if (duplicate) errors.name = "A product with this name already exists.";
  }

  const price = Number(values.price);
  if (values.price.trim() === "") {
    errors.price = "Enter a price.";
  } else if (!Number.isFinite(price)) {
    errors.price = "Price must be a number.";
  } else if (price <= 0) {
    errors.price = "Price must be more than 0.";
  } else if (price > 10_000_000) {
    errors.price = "Price looks too high. Check the amount.";
  }

  if (!isUnit(values.unit)) {
    errors.unit = "Choose a unit.";
  }

  return errors;
}

export function productFromInput(
  values: ProductFormValues,
  existing?: Product,
  now = new Date(),
): Product {
  const timestamp = now.toISOString();
  return {
    id: existing?.id ?? createId("product"),
    name: values.name.trim().replace(/\s+/g, " "),
    price: roundMoney(Number(values.price)),
    unit: values.unit,
    aliases: normalizeAliases(values.aliases),
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    isSample: existing?.isSample,
  };
}

export function seedSettingsForShop(input: {
  shopName: string;
  address: string;
  phone: string;
  language?: Settings["language"];
  receiptWidth?: Settings["receiptWidth"];
  thankYouMessage?: string;
}): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    shopName: input.shopName.trim() || DEFAULT_SETTINGS.shopName,
    setupComplete: true,
  };
}

export function currencyLabel(symbol: string): string {
  if (symbol === "₹") return "Indian Rupee (₹)";
  if (symbol === "Rs") return "Rupees (Rs)";
  if (symbol === "$") return "US Dollar ($)";
  if (symbol === "€") return "Euro (€)";
  return symbol;
}
