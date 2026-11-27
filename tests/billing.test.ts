import { describe, expect, it } from "vitest";
import {
  computeDiscount,
  computeLineAmount,
  computeTotals,
  createBill,
  formatBillNumber,
  nextBillSequence,
  summarizeToday,
  validateDraft,
} from "@/lib/billing";
import type { Bill, Draft, DraftItem, Settings } from "@/lib/types";
import { DEFAULT_SETTINGS, emptyDraft } from "@/lib/types";
import { createSampleProducts } from "@/lib/sampleData";

const products = createSampleProducts(new Date("2026-01-01T00:00:00Z"));
const sugar = products.find((p) => p.name === "Sugar")!;
const flour = products.find((p) => p.name === "Wheat Flour (Aata)")!;
const oil = products.find((p) => p.name === "Soybean Oil")!;

function draftItem(overrides: Partial<DraftItem>): DraftItem {
  return {
    id: `item-${Math.random().toString(36).slice(2)}`,
    productId: null,
    name: "Item",
    quantity: 1,
    unit: "kg",
    unitPrice: 10,
    source: "manual",
    matchStatus: "matched",
    alternatives: [],
    needsReview: false,
    ...overrides,
  };
}

function validDraft(): Draft {
  return {
    ...emptyDraft(),
    items: [
      draftItem({ productId: sugar.id, name: sugar.name, quantity: 3, unitPrice: 45 }),
      draftItem({ productId: flour.id, name: flour.name, quantity: 2, unitPrice: 40 }),
      draftItem({ productId: oil.id, name: oil.name, quantity: 3, unit: "litre", unitPrice: 130 }),
    ],
  };
}

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  shopName: "Sharma Kirana Store",
  address: "12 Main Market, Jaipur",
  phone: "9876543210",
  setupComplete: true,
};

describe("bill calculations", () => {
  it("computes line amounts", () => {
    expect(computeLineAmount(3, 45)).toBe(135);
    expect(computeLineAmount(3, 130)).toBe(390);
    expect(computeLineAmount(0.5, 130)).toBe(65);
    expect(computeLineAmount(0.333, 45)).toBe(14.99);
  });

  it("computes the example bill", () => {
    const totals = computeTotals(
      [
        { quantity: 3, unitPrice: 45 },
        { quantity: 2, unitPrice: 40 },
        { quantity: 3, unitPrice: 130 },
      ],
      "amount",
      0,
    );
    expect(totals).toEqual({ subtotal: 605, discountAmount: 0, total: 605 });
  });

  it("applies amount and percentage discounts safely", () => {
    expect(computeDiscount(605, "amount", 50)).toBe(50);
    expect(computeDiscount(605, "percent", 10)).toBe(60.5);
    expect(computeDiscount(605, "percent", 100)).toBe(605);
    expect(computeDiscount(605, "amount", 9999)).toBe(605);
    expect(computeDiscount(605, "amount", -20)).toBe(0);
  });

  it("rounds currency to two decimals", () => {
    const totals = computeTotals([{ quantity: 1, unitPrice: 0.333 }], "amount", 0);
    expect(totals.subtotal).toBe(0.33);
    expect(totals.total).toBe(0.33);
    const tenPercent = computeTotals([{ quantity: 1, unitPrice: 99.99 }], "percent", 10);
    expect(tenPercent.discountAmount).toBe(10);
    expect(tenPercent.total).toBe(89.99);
  });
});

describe("draft validation", () => {
  it("rejects an empty bill", () => {
    const validation = validateDraft(emptyDraft(), products);
    expect(validation.canFinalize).toBe(false);
    expect(validation.issues[0].message).toMatch(/at least one product/i);
  });

  it("accepts a complete bill", () => {
    const validation = validateDraft(validDraft(), products);
    expect(validation.issues).toEqual([]);
    expect(validation.canFinalize).toBe(true);
  });

  it("rejects a missing price", () => {
    const draft = validDraft();
    draft.items.push(draftItem({ name: "Loose item", unitPrice: 0 }));
    const validation = validateDraft(draft, products);
    expect(validation.canFinalize).toBe(false);
    expect(validation.issues.some((issue) => /price/i.test(issue.message))).toBe(true);
  });

  it("rejects unmatched products", () => {
    const draft = validDraft();
    draft.items.push(
      draftItem({ name: "Cement", matchStatus: "unmatched", needsReview: true, unitPrice: 400 }),
    );
    const validation = validateDraft(draft, products);
    expect(validation.canFinalize).toBe(false);
    expect(validation.issues.some((issue) => /choose a product/i.test(issue.message))).toBe(true);
  });

  it("rejects zero and negative quantities", () => {
    const draft = validDraft();
    draft.items[0].quantity = 0;
    expect(validateDraft(draft, products).canFinalize).toBe(false);
    draft.items[0].quantity = -2;
    expect(validateDraft(draft, products).canFinalize).toBe(false);
  });

  it("rejects items whose product was deleted", () => {
    const draft = validDraft();
    draft.items[0].productId = "missing-product";
    const validation = validateDraft(draft, products);
    expect(validation.canFinalize).toBe(false);
    expect(validation.issues.some((issue) => /no longer in your catalogue/i.test(issue.message))).toBe(true);
  });

  it("rejects an invalid discount percentage", () => {
    const draft = validDraft();
    draft.discountType = "percent";
    draft.discountValue = 140;
    expect(validateDraft(draft, products).canFinalize).toBe(false);
  });
});

describe("bill creation", () => {
  it("creates a numbered bill with a snapshot", () => {
    const bill = createBill({
      draft: validDraft(),
      products,
      settings,
      sequence: 1,
      now: new Date("2026-11-27T10:30:00+05:30"),
    });
    expect(bill.number).toBe("VB-0001");
    expect(bill.subtotal).toBe(605);
    expect(bill.total).toBe(605);
    expect(bill.itemCount).toBe(3);
    expect(bill.items[0].amount).toBe(135);
    expect(bill.shop.shopName).toBe("Sharma Kirana Store");
    expect(bill.thankYouMessage).toBe("Thank you! Visit again.");
  });

  it("stores the discount in the bill", () => {
    const draft = validDraft();
    draft.discountType = "percent";
    draft.discountValue = 10;
    const bill = createBill({ draft, products, settings, sequence: 7 });
    expect(bill.discountAmount).toBe(60.5);
    expect(bill.total).toBe(544.5);
  });

  it("refuses to create an invalid bill", () => {
    expect(() =>
      createBill({ draft: emptyDraft(), products, settings, sequence: 1 }),
    ).toThrow(/at least one product/i);
  });

  it("generates sequential, unique bill numbers", () => {
    const existing = [
      { number: "VB-0004" } as Bill,
      { number: "VB-0002" } as Bill,
    ];
    expect(nextBillSequence(existing, 0)).toBe(5);
    expect(nextBillSequence([], 9)).toBe(10);
    expect(formatBillNumber(12)).toBe("VB-0012");
    expect(formatBillNumber(0)).toBe("VB-0001");
  });
});

describe("dashboard summary", () => {
  it("counts only today's bills", () => {
    const now = new Date("2026-11-27T15:00:00");
    const today = (total: number, hour: number): Bill => ({
      id: `b${total}`,
      number: "VB-0001",
      createdAt: new Date(2026, 10, 27, hour, 0, 0).toISOString(),
      items: [],
      subtotal: total,
      discountType: "amount",
      discountValue: 0,
      discountAmount: 0,
      total,
      shop: { shopName: "S", address: "", phone: "", currencySymbol: "₹" },
      thankYouMessage: "Thanks",
      itemCount: 2,
    });
    const yesterday = {
      ...today(1000, 9),
      createdAt: new Date(2026, 10, 26, 9, 0, 0).toISOString(),
    };
    const summary = summarizeToday([today(100, 9), today(250, 18), yesterday], now);
    expect(summary.sales).toBe(350);
    expect(summary.billCount).toBe(2);
    expect(summary.itemCount).toBe(4);
  });
});
