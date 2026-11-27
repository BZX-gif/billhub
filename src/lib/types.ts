/** Shared domain types for VoiceBill. */

export const UNITS = ["kg", "gram", "litre", "ml", "piece", "packet", "dozen"] as const;
export type Unit = (typeof UNITS)[number];

export const UNIT_FAMILY: Record<Unit, "mass" | "volume" | "count" | "package"> = {
  kg: "mass",
  gram: "mass",
  litre: "volume",
  ml: "volume",
  piece: "count",
  dozen: "count",
  packet: "package",
};

/** Size of one unit in the family's base unit (gram / ml / piece / packet). */
export const UNIT_SIZE: Record<Unit, number> = {
  kg: 1000,
  gram: 1,
  litre: 1000,
  ml: 1,
  piece: 1,
  dozen: 12,
  packet: 1,
};

export const UNIT_LABEL: Record<Unit, string> = {
  kg: "kg",
  gram: "gram",
  litre: "litre",
  ml: "ml",
  piece: "piece",
  packet: "packet",
  dozen: "dozen",
};

export const UNIT_LABEL_HI: Record<Unit, string> = {
  kg: "किलो",
  gram: "ग्राम",
  litre: "लीटर",
  ml: "मिली",
  piece: "पीस",
  packet: "पैकेट",
  dozen: "दर्जन",
};

export type RecognitionLanguage = "hi-IN" | "en-IN";
export type ReceiptWidth = "58mm" | "80mm" | "a4";

export interface Product {
  id: string;
  name: string;
  /** Price in rupees for one `unit`. */
  price: number;
  unit: Unit;
  aliases: string[];
  createdAt: string;
  updatedAt: string;
  isSample?: boolean;
}

export type MatchStatus = "matched" | "ambiguous" | "unmatched" | "custom";

export interface MatchAlternative {
  productId: string;
  score: number;
}

export interface DraftItem {
  id: string;
  productId: string | null;
  name: string;
  quantity: number;
  unit: Unit;
  /** Price in rupees for one `unit`. */
  unitPrice: number;
  source: "voice" | "manual" | "custom";
  rawText?: string;
  matchStatus: MatchStatus;
  alternatives: MatchAlternative[];
  notice?: string;
  needsReview: boolean;
  reviewReason?: string;
}

export interface BillItem {
  id: string;
  productId: string | null;
  name: string;
  quantity: number;
  unit: Unit;
  unitPrice: number;
  amount: number;
}

export type DiscountType = "amount" | "percent";

export interface ShopSnapshot {
  shopName: string;
  address: string;
  phone: string;
  currencySymbol: string;
}

export interface Bill {
  id: string;
  number: string;
  createdAt: string;
  items: BillItem[];
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  total: number;
  customerName?: string;
  shop: ShopSnapshot;
  thankYouMessage: string;
  itemCount: number;
}

export interface Settings {
  shopName: string;
  address: string;
  phone: string;
  currencySymbol: string;
  receiptWidth: ReceiptWidth;
  language: RecognitionLanguage;
  thankYouMessage: string;
  autoAddVoice: boolean;
  setupComplete: boolean;
  billSequence: number;
}

export interface Draft {
  items: DraftItem[];
  discountType: DiscountType;
  discountValue: number;
  customerName: string;
  updatedAt: string;
}

export interface AppData {
  products: Product[];
  bills: Bill[];
  settings: Settings;
  draft: Draft;
}

export const DEFAULT_SETTINGS: Settings = {
  shopName: "My Shop",
  address: "",
  phone: "",
  currencySymbol: "₹",
  receiptWidth: "80mm",
  language: "hi-IN",
  thankYouMessage: "Thank you! Visit again.",
  autoAddVoice: true,
  setupComplete: false,
  billSequence: 0,
};

export const emptyDraft = (): Draft => ({
  items: [],
  discountType: "amount",
  discountValue: 0,
  customerName: "",
  updatedAt: new Date().toISOString(),
});
