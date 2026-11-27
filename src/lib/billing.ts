import { createId } from "./ids";
import type {
  Bill,
  BillItem,
  DiscountType,
  Draft,
  DraftItem,
  Product,
  Settings,
} from "./types";
import { clampQuantity, fromPaise, isUnit, roundMoney, toPaise } from "./units";

export interface BillTotals {
  subtotal: number;
  discountAmount: number;
  total: number;
}

export interface BillIssue {
  itemId?: string;
  message: string;
}

export interface DraftValidation {
  canFinalize: boolean;
  issues: BillIssue[];
  byItem: Record<string, string[]>;
}

/** qty × unit price, rounded to paise without float drift. */
export function computeLineAmount(quantity: number, unitPrice: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return 0;
  if (quantity <= 0 || unitPrice <= 0) return 0;
  return fromPaise(Math.round(quantity * toPaise(unitPrice)));
}

export function computeDiscount(
  subtotal: number,
  type: DiscountType,
  value: number,
): number {
  const subtotalPaise = Math.max(0, toPaise(subtotal));
  if (!Number.isFinite(value) || value <= 0) return 0;
  let discountPaise = 0;
  if (type === "percent") {
    const percent = Math.min(100, Math.max(0, value));
    discountPaise = Math.round((subtotalPaise * percent) / 100);
  } else {
    discountPaise = toPaise(value);
  }
  return fromPaise(Math.min(subtotalPaise, Math.max(0, discountPaise)));
}

export function computeTotals(
  items: Array<{ quantity: number; unitPrice: number }>,
  discountType: DiscountType = "amount",
  discountValue = 0,
): BillTotals {
  const subtotalPaise = items.reduce(
    (sum, item) => sum + Math.round(item.quantity * toPaise(item.unitPrice)),
    0,
  );
  const subtotal = fromPaise(subtotalPaise);
  const discountAmount = computeDiscount(subtotal, discountType, discountValue);
  const total = fromPaise(subtotalPaise - toPaise(discountAmount));
  return { subtotal, discountAmount, total };
}

export function totalsForDraft(draft: Draft): BillTotals {
  return computeTotals(draft.items, draft.discountType, draft.discountValue);
}

/**
 * Hard gate before a bill can be saved. Nothing with an unmatched product,
 * a missing price or an unresolved unit is allowed through.
 */
export function validateDraft(draft: Draft, products: Product[]): DraftValidation {
  const issues: BillIssue[] = [];
  const byItem: Record<string, string[]> = {};

  if (draft.items.length === 0) {
    issues.push({ message: "Add at least one product to create a bill." });
  }

  const productIds = new Set(products.map((product) => product.id));

  for (const item of draft.items) {
    const itemIssues: string[] = [];
    if (!item.name.trim()) {
      itemIssues.push("Product name is missing.");
    }
    if (!isUnit(item.unit)) {
      itemIssues.push("Choose a valid unit.");
    }
    if (!Number.isFinite(item.quantity) || clampQuantity(item.quantity) <= 0) {
      itemIssues.push("Quantity must be more than 0.");
    }
    if (!Number.isFinite(item.unitPrice) || item.unitPrice <= 0) {
      itemIssues.push("Price is missing. Set a price per unit.");
    }
    if (item.productId && !productIds.has(item.productId)) {
      itemIssues.push("This product is no longer in your catalogue.");
    }
    if (item.matchStatus === "unmatched") {
      itemIssues.push("Choose a product from your catalogue or add it.");
    }
    if (item.needsReview && item.reviewReason) {
      itemIssues.push(item.reviewReason);
    }
    if (itemIssues.length > 0) {
      byItem[item.id] = [...new Set(itemIssues)];
      issues.push({ itemId: item.id, message: itemIssues[0]! });
    }
  }

  if (draft.discountType === "percent" && (draft.discountValue < 0 || draft.discountValue > 100)) {
    issues.push({ message: "Discount percentage must be between 0 and 100." });
  }
  if (draft.discountType === "amount" && draft.discountValue < 0) {
    issues.push({ message: "Discount cannot be negative." });
  }

  const totals = totalsForDraft(draft);
  if (draft.items.length > 0 && totals.subtotal <= 0) {
    issues.push({ message: "Bill total must be more than zero." });
  }

  return {
    canFinalize: issues.length === 0 && draft.items.length > 0,
    issues,
    byItem,
  };
}

export function formatBillNumber(sequence: number): string {
  const safe = Math.max(1, Math.round(sequence));
  return `VB-${String(safe).padStart(4, "0")}`;
}

/** Next safe bill number, also taking existing bills into account. */
export function nextBillSequence(bills: Bill[], settingsSequence: number): number {
  let highest = Number.isFinite(settingsSequence) ? settingsSequence : 0;
  for (const bill of bills) {
    const match = bill.number?.match(/(\d+)\s*$/);
    if (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) highest = Math.max(highest, value);
    }
  }
  return Math.max(1, highest + 1);
}

export function toBillItems(items: DraftItem[]): BillItem[] {
  return items.map((item) => ({
    id: item.id,
    productId: item.productId,
    name: item.name,
    quantity: clampQuantity(item.quantity),
    unit: item.unit,
    unitPrice: roundMoney(item.unitPrice),
    amount: computeLineAmount(item.quantity, item.unitPrice),
  }));
}

export interface CreateBillInput {
  draft: Draft;
  products: Product[];
  settings: Settings;
  sequence: number;
  now?: Date;
}

export function createBill({ draft, products, settings, sequence, now = new Date() }: CreateBillInput): Bill {
  const validation = validateDraft(draft, products);
  if (!validation.canFinalize) {
    throw new Error(validation.issues[0]?.message ?? "This bill is not ready yet.");
  }

  const items = toBillItems(draft.items);
  const totals = computeTotals(items, draft.discountType, draft.discountValue);

  return {
    id: createId("bill"),
    number: formatBillNumber(sequence),
    createdAt: now.toISOString(),
    items,
    subtotal: totals.subtotal,
    discountType: draft.discountType,
    discountValue: draft.discountValue,
    discountAmount: totals.discountAmount,
    total: totals.total,
    customerName: draft.customerName.trim() || undefined,
    shop: {
      shopName: settings.shopName.trim() || "My Shop",
      address: settings.address.trim(),
      phone: settings.phone.trim(),
      currencySymbol: settings.currencySymbol || "₹",
    },
    thankYouMessage: settings.thankYouMessage.trim() || "Thank you! Visit again.",
    itemCount: items.length,
  };
}

export function summarizeToday(bills: Bill[], now = new Date()): { sales: number; billCount: number; itemCount: number } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let salesPaise = 0;
  let billCount = 0;
  let itemCount = 0;
  for (const bill of bills) {
    const created = new Date(bill.createdAt);
    if (Number.isNaN(created.getTime())) continue;
    if (created < start || created > end) continue;
    salesPaise += toPaise(bill.total);
    billCount += 1;
    itemCount += bill.itemCount;
  }
  return { sales: fromPaise(salesPaise), billCount, itemCount };
}
