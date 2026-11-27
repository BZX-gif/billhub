import { describe, expect, it } from "vitest";
import {
  STORAGE_KEYS,
  loadAppData,
  saveBills,
  saveDraft,
  saveProducts,
  saveSettings,
  sanitizeBill,
  sanitizeDraft,
  sanitizeProduct,
  sanitizeSettings,
  type StorageLike,
} from "@/lib/storage";
import { createSampleProducts } from "@/lib/sampleData";
import { DEFAULT_SETTINGS, emptyDraft } from "@/lib/types";
import { createBill } from "@/lib/billing";
import type { Draft } from "@/lib/types";

class MemoryStorage implements StorageLike {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
}

const settings = {
  ...DEFAULT_SETTINGS,
  shopName: "Sharma Kirana",
  setupComplete: true,
  billSequence: 0,
};

function completeDraft(): Draft {
  return {
    ...emptyDraft(),
    items: [
      {
        id: "i1",
        productId: "sample-sugar",
        name: "Sugar",
        quantity: 3,
        unit: "kg",
        unitPrice: 45,
        source: "voice",
        matchStatus: "matched",
        alternatives: [],
        needsReview: false,
      },
    ],
  };
}

describe("local persistence", () => {
  it("round-trips products, bills, settings and the draft", () => {
    const storage = new MemoryStorage();
    const products = createSampleProducts();
    const bill = createBill({
      draft: completeDraft(),
      products,
      settings,
      sequence: 1,
    });

    expect(saveProducts(storage, products).ok).toBe(true);
    expect(saveBills(storage, [bill]).ok).toBe(true);
    expect(saveSettings(storage, settings).ok).toBe(true);
    expect(saveDraft(storage, completeDraft()).ok).toBe(true);

    const loaded = loadAppData(storage);
    expect(loaded.products).toHaveLength(products.length);
    expect(loaded.products[0].aliases).toContain("chini");
    expect(loaded.bills).toHaveLength(1);
    expect(loaded.bills[0].number).toBe("VB-0001");
    expect(loaded.bills[0].total).toBe(135);
    expect(loaded.settings.shopName).toBe("Sharma Kirana");
    expect(loaded.draft.items).toHaveLength(1);
    expect(loaded.draft.items[0].name).toBe("Sugar");
  });

  it("returns safe defaults for empty or corrupt storage", () => {
    const storage = new MemoryStorage();
    expect(loadAppData(storage)).toMatchObject({ products: [], bills: [], draft: { items: [] } });
    storage.setItem(STORAGE_KEYS.products, "{not json");
    storage.setItem(STORAGE_KEYS.bills, "null");
    storage.setItem(STORAGE_KEYS.settings, '"oops"');
    const loaded = loadAppData(storage);
    expect(loaded.products).toEqual([]);
    expect(loaded.bills).toEqual([]);
    expect(loaded.settings.shopName).toBe(DEFAULT_SETTINGS.shopName);
  });

  it("keeps working when storage is unavailable", () => {
    const loaded = loadAppData(null);
    expect(loaded.settings.setupComplete).toBe(false);
  });

  it("drops invalid product data instead of crashing", () => {
    expect(sanitizeProduct(null)).toBeNull();
    expect(sanitizeProduct({ name: "", price: 10 })).toBeNull();
    expect(sanitizeProduct({ name: "Bad price", price: -5 })).toBeNull();
    const product = sanitizeProduct({ id: "x", name: " Sugar ", price: 45, unit: "kg", aliases: ["chini", "chini", 4] });
    expect(product).toMatchObject({ id: "x", name: "Sugar", price: 45, unit: "kg", aliases: ["chini"] });
  });

  it("sanitizes settings types", () => {
    const sanitized = sanitizeSettings({
      shopName: "  ",
      receiptWidth: "huge",
      language: "fr-FR",
      billSequence: -4,
      setupComplete: "yes",
    });
    expect(sanitized.receiptWidth).toBe("80mm");
    expect(sanitized.language).toBe("hi-IN");
    expect(sanitized.billSequence).toBe(0);
    expect(sanitized.setupComplete).toBe(false);
    expect(sanitized.shopName.length).toBeGreaterThan(0);
  });

  it("recomputes bill totals when reading stored bills", () => {
    const bill = sanitizeBill({
      id: "b1",
      number: "VB-0009",
      createdAt: new Date().toISOString(),
      items: [{ name: "Sugar", quantity: 2, unit: "kg", unitPrice: 45 }],
      subtotal: 9999,
      total: 9999,
      discountType: "amount",
      discountValue: 10,
      shop: { shopName: "Shop", address: "", phone: "", currencySymbol: "₹" },
    });
    expect(bill).not.toBeNull();
    expect(bill!.subtotal).toBe(90);
    expect(bill!.total).toBe(80);
    expect(bill!.itemCount).toBe(1);
  });

  it("rejects corrupt bills", () => {
    expect(sanitizeBill({ items: [] })).toBeNull();
    expect(sanitizeBill({ createdAt: "not-a-date", items: [{ name: "x", quantity: 1, unitPrice: 1 }] })).toBeNull();
  });

  it("sanitizes drafts with bad lines", () => {
    const draft = sanitizeDraft({ items: [{ name: "Sugar", quantity: -1 }, { name: "Ok", quantity: 2, unit: "kg" }] });
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0].name).toBe("Ok");
  });

  it("reports storage quota failures without throwing", () => {
    const failing: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => undefined,
    };
    const result = saveProducts(failing, []);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/storage/i);
  });
});
