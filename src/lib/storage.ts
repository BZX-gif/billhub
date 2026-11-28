import {
  computeTotals,
  computeLineAmount,
  formatBillNumber,
} from "./billing";
import { normalizeBillDate } from "./gst";
import { createId } from "./ids";
import { emptyDraft, DEFAULT_SETTINGS } from "./types";
import type {
  AppData,
  Bill,
  BillItem,
  DiscountType,
  Draft,
  DraftItem,
  MatchStatus,
  Product,
  Settings,
  Unit,
} from "./types";
import { isUnit, roundMoney } from "./units";
import { UNITS } from "./types";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const STORAGE_PREFIX = "voicebill.v1";
export const STORAGE_KEYS = {
  products: `${STORAGE_PREFIX}.products`,
  bills: `${STORAGE_PREFIX}.bills`,
  settings: `${STORAGE_PREFIX}.settings`,
  draft: `${STORAGE_PREFIX}.draft`,
} as const;

export function getBrowserStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const probe = `${STORAGE_PREFIX}.probe`;
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function sanitizeUnit(value: unknown, fallback: Unit = "piece"): Unit {
  return isUnit(value) ? value : fallback;
}

const MATCH_STATUSES: MatchStatus[] = ["matched", "ambiguous", "unmatched", "custom"];

export function sanitizeProduct(value: unknown, now = new Date()): Product | null {
  const record = asRecord(value);
  if (!record) return null;
  const name = asString(record.name).trim();
  if (!name) return null;
  const price = asFiniteNumber(record.price, -1);
  if (price < 0 || price > 10_000_000) return null;
  const timestamp = now.toISOString();
  const aliases = Array.isArray(record.aliases)
    ? record.aliases
        .filter((alias): alias is string => typeof alias === "string")
        .map((alias) => alias.trim())
        .filter(Boolean)
        .slice(0, 30)
    : [];

  return {
    id: asString(record.id).trim() || createId("product"),
    name: name.slice(0, 120),
    price: roundMoney(price),
    unit: sanitizeUnit(record.unit, "kg"),
    aliases: [...new Set(aliases)],
    createdAt: asString(record.createdAt, timestamp),
    updatedAt: asString(record.updatedAt, timestamp),
    isSample: record.isSample === true,
  };
}

export function sanitizeProducts(value: unknown): Product[] {
  if (!Array.isArray(value)) return [];
  const products: Product[] = [];
  const ids = new Set<string>();
  for (const entry of value) {
    const product = sanitizeProduct(entry);
    if (!product || ids.has(product.id)) continue;
    ids.add(product.id);
    products.push(product);
  }
  return products;
}

export function sanitizeSettings(value: unknown): Settings {
  const record = asRecord(value) ?? {};
  const settings: Settings = { ...DEFAULT_SETTINGS };
  settings.shopName = asString(record.shopName, settings.shopName).slice(0, 80) || settings.shopName;
  settings.address = asString(record.address, settings.address).slice(0, 300);
  settings.phone = asString(record.phone, settings.phone).slice(0, 40);
  settings.gstin = asString(record.gstin, settings.gstin).replace(/[^0-9a-zA-Z]/g, "").slice(0, 15).toUpperCase();
  settings.currencySymbol = (asString(record.currencySymbol, settings.currencySymbol) || "₹").slice(0, 4);
  const width = record.receiptWidth;
  settings.receiptWidth = width === "58mm" || width === "80mm" || width === "a4" ? width : settings.receiptWidth;
  settings.language = record.language === "en-IN" || record.language === "hi-IN" ? record.language : settings.language;
  settings.thankYouMessage = asString(record.thankYouMessage, settings.thankYouMessage).slice(0, 200);
  settings.autoAddVoice = typeof record.autoAddVoice === "boolean" ? record.autoAddVoice : settings.autoAddVoice;
  settings.setupComplete = record.setupComplete === true;
  const sequence = asFiniteNumber(record.billSequence, 0);
  settings.billSequence = sequence >= 0 && sequence < 10_000_000 ? Math.floor(sequence) : 0;
  return settings;
}

export function sanitizeDraftItem(value: unknown): DraftItem | null {
  const record = asRecord(value);
  if (!record) return null;
  const name = asString(record.name).trim();
  if (!name) return null;
  const quantity = asFiniteNumber(record.quantity, 0);
  if (!Number.isFinite(quantity) || quantity < 0) return null;
  const unitPrice = Math.max(0, asFiniteNumber(record.unitPrice, 0));
  const status = MATCH_STATUSES.includes(record.matchStatus as MatchStatus)
    ? (record.matchStatus as MatchStatus)
    : "unmatched";
  const alternatives = Array.isArray(record.alternatives)
    ? record.alternatives
        .map((alternative) => asRecord(alternative))
        .filter((alternative): alternative is Record<string, unknown> => Boolean(alternative))
        .map((alternative) => ({
          productId: asString(alternative.productId),
          score: asFiniteNumber(alternative.score, 0),
        }))
        .filter((alternative) => alternative.productId)
    : [];

  return {
    id: asString(record.id).trim() || createId("item"),
    productId: asString(record.productId).trim() || null,
    name: name.slice(0, 120),
    quantity,
    unit: sanitizeUnit(record.unit),
    unitPrice: roundMoney(unitPrice),
    source: record.source === "manual" || record.source === "custom" ? record.source : "voice",
    rawText: asString(record.rawText) || undefined,
    matchStatus: status,
    alternatives,
    notice: asString(record.notice) || undefined,
    needsReview: record.needsReview === true,
    reviewReason: asString(record.reviewReason) || undefined,
  };
}

export function sanitizeDraft(value: unknown): Draft {
  const record = asRecord(value);
  if (!record) return emptyDraft();
  const items = Array.isArray(record.items)
    ? record.items
        .map(sanitizeDraftItem)
        .filter((item): item is DraftItem => Boolean(item))
    : [];
  const discountType: DiscountType = record.discountType === "percent" ? "percent" : "amount";
  const discountValue = Math.max(0, asFiniteNumber(record.discountValue, 0));
  return {
    items,
    discountType,
    discountValue: discountType === "percent" ? Math.min(100, discountValue) : roundMoney(discountValue),
    customerName: asString(record.customerName).slice(0, 80),
    billDate: normalizeBillDate(asString(record.billDate)) ?? "",
    updatedAt: asString(record.updatedAt, new Date().toISOString()),
  };
}

function sanitizeBillItem(value: unknown): BillItem | null {
  const record = asRecord(value);
  if (!record) return null;
  const name = asString(record.name).trim();
  if (!name) return null;
  const quantity = asFiniteNumber(record.quantity, 0);
  const unitPrice = Math.max(0, asFiniteNumber(record.unitPrice, 0));
  if (quantity <= 0) return null;
  return {
    id: asString(record.id).trim() || createId("item"),
    productId: asString(record.productId).trim() || null,
    name: name.slice(0, 120),
    quantity,
    unit: sanitizeUnit(record.unit),
    unitPrice: roundMoney(unitPrice),
    amount: computeLineAmount(quantity, unitPrice),
  };
}

export function sanitizeBill(value: unknown): Bill | null {
  const record = asRecord(value);
  if (!record) return null;
  const rawItems = Array.isArray(record.items) ? record.items : [];
  const items = rawItems
    .map(sanitizeBillItem)
    .filter((item): item is BillItem => Boolean(item));
  if (items.length === 0) return null;
  const createdAt = asString(record.createdAt);
  if (!createdAt || Number.isNaN(new Date(createdAt).getTime())) return null;

  const discountType: DiscountType = record.discountType === "percent" ? "percent" : "amount";
  const discountValue = Math.max(0, asFiniteNumber(record.discountValue, 0));
  const totals = computeTotals(items, discountType, discountValue);
  const shop = asRecord(record.shop) ?? {};

  return {
    id: asString(record.id).trim() || createId("bill"),
    number: asString(record.number).trim() || formatBillNumber(1),
    createdAt,
    items,
    subtotal: totals.subtotal,
    discountType,
    discountValue,
    discountAmount: totals.discountAmount,
    total: totals.total,
    customerName: asString(record.customerName).trim() || undefined,
    shop: {
      shopName: asString(shop.shopName, "My Shop"),
      address: asString(shop.address),
      phone: asString(shop.phone),
      currencySymbol: asString(shop.currencySymbol, "₹"),
      gstin: asString(shop.gstin).replace(/[^0-9a-zA-Z]/g, "").slice(0, 15).toUpperCase() || undefined,
    },
    thankYouMessage: asString(record.thankYouMessage, "Thank you! Visit again."),
    itemCount: items.length,
  };
}

export function sanitizeBills(value: unknown): Bill[] {
  if (!Array.isArray(value)) return [];
  const bills: Bill[] = [];
  const ids = new Set<string>();
  for (const entry of value) {
    const bill = sanitizeBill(entry);
    if (!bill || ids.has(bill.id)) continue;
    ids.add(bill.id);
    bills.push(bill);
  }
  return bills.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/** Read every slice of app data, tolerating missing or corrupt entries. */
export function loadAppData(storage: StorageLike | null): AppData {
  const data: AppData = {
    products: [],
    bills: [],
    settings: { ...DEFAULT_SETTINGS },
    draft: emptyDraft(),
  };
  if (!storage) return data;

  try {
    const products = safeParse<unknown>(storage.getItem(STORAGE_KEYS.products));
    if (products) data.products = sanitizeProducts(products);
    const bills = safeParse<unknown>(storage.getItem(STORAGE_KEYS.bills));
    if (bills) data.bills = sanitizeBills(bills);
    const settings = safeParse<unknown>(storage.getItem(STORAGE_KEYS.settings));
    if (settings) data.settings = sanitizeSettings(settings);
    const draft = safeParse<unknown>(storage.getItem(STORAGE_KEYS.draft));
    if (draft) data.draft = sanitizeDraft(draft);
  } catch {
    // Corrupt or inaccessible storage: fall back to safe defaults.
  }

  return data;
}

export type PersistResult = { ok: boolean; error?: string };

function persist(storage: StorageLike | null, key: string, value: unknown): PersistResult {
  if (!storage) return { ok: false, error: "Local storage is unavailable in this browser." };
  try {
    storage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save data. Browser storage may be full." };
  }
}

export function saveProducts(storage: StorageLike | null, products: Product[]): PersistResult {
  return persist(storage, STORAGE_KEYS.products, products);
}

export function saveBills(storage: StorageLike | null, bills: Bill[]): PersistResult {
  return persist(storage, STORAGE_KEYS.bills, bills);
}

export function saveSettings(storage: StorageLike | null, settings: Settings): PersistResult {
  return persist(storage, STORAGE_KEYS.settings, settings);
}

export function saveDraft(storage: StorageLike | null, draft: Draft): PersistResult {
  return persist(storage, STORAGE_KEYS.draft, draft);
}

export function clearLocalData(storage: StorageLike | null): void {
  if (!storage) return;
  for (const key of Object.values(STORAGE_KEYS)) {
    try {
      storage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

export const ALL_UNITS = UNITS;
