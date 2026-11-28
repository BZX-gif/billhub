import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  gstinStateCode,
  gstinStateName,
  isValidGstin,
  normalizeGstin,
  billTimestamp,
  normalizeBillDate,
  printableGstin,
} from "@/lib/gst";
import { financialYearLabel, formatDate, formatTime, localDayKey } from "@/lib/format";
import { createBill } from "@/lib/billing";
import { sanitizeBill, sanitizeDraft, sanitizeSettings } from "@/lib/storage";
import { Receipt } from "@/components/receipt/Receipt";
import { emptyDraft, type Bill, type DraftItem, type Product, type Settings } from "@/lib/types";
import { createSampleProducts } from "@/lib/sampleData";
import { resetBrowserState, seedStorage, testSettings, withProviders } from "./helpers";
import { STORAGE_KEYS } from "@/lib/storage";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/settings",
}));

const products: Product[] = createSampleProducts(new Date("2026-01-01T00:00:00Z"));
const sugar = products.find((product) => product.name === "Sugar")!;

function draftWithSugar(): { draft: ReturnType<typeof emptyDraft>; products: Product[] } {
  const item: DraftItem = {
    id: "item-1",
    productId: sugar.id,
    name: sugar.name,
    quantity: 2,
    unit: "kg",
    unitPrice: sugar.price,
    source: "voice",
    matchStatus: "matched",
    alternatives: [],
    needsReview: false,
  };
  return { draft: { ...emptyDraft(), items: [item] }, products };
}

function settingsWithGstin(gstin: string): Settings {
  return testSettings({ gstin, shopName: "Sharma Kirana Store", address: "12 Main Market, Jaipur", phone: "9876543210" });
}

describe("GST number handling", () => {
  it("accepts a well-formed GSTIN", () => {
    for (const gstin of ["08ABCDE1234F1Z5", "27AAPFU0939F1ZV", "29AAGCB7383J1Z4"]) {
      expect(isValidGstin(gstin), gstin).toBe(true);
    }
  });

  it("rejects anything that is not a complete GSTIN", () => {
    for (const gstin of ["", "08ABCDE", "08ABCDE1234F1Z", "08ABCDE1234F1Z55", "ABCDE1234F1Z5", "08ABCDE1234F1Z5X"]) {
      expect(isValidGstin(gstin), gstin).toBe(false);
    }
  });

  it("normalises typing noise: spaces, dashes, lower case", () => {
    expect(normalizeGstin(" 08abc de-1234f1z5 ")).toBe("08ABCDE1234F1Z5");
    expect(isValidGstin(" 08abc de-1234f1z5 ")).toBe(true);
  });

  it("explains the state from the first two digits", () => {
    expect(gstinStateCode("08ABCDE1234F1Z5")).toBe("08");
    expect(gstinStateName("08ABCDE1234F1Z5")).toBe("Rajasthan");
    expect(gstinStateName("27AAPFU0939F1ZV")).toBe("Maharashtra");
    expect(gstinStateName("not-a-gstin")).toBeNull();
  });

  it("only prints a complete, valid number", () => {
    expect(printableGstin("08ABCDE1234F1Z5")).toBe("08ABCDE1234F1Z5");
    expect(printableGstin("08ABCDE")).toBeNull();
    expect(printableGstin("")).toBeNull();
    expect(printableGstin(undefined)).toBeNull();
  });

  it("keeps the GSTIN out of stored bills until it is valid", () => {
    expect(sanitizeSettings({ shopName: "Shop", gstin: "08abcde1234f1z5" }).gstin).toBe("08ABCDE1234F1Z5");
    expect(sanitizeSettings({ shopName: "Shop" }).gstin).toBe("");
  });
});

describe("bill date and GSTIN", () => {
  const now = new Date("2026-11-28T10:30:00.000Z");

  it("freezes the shop GSTIN and creation date into the bill", () => {
    const { draft } = draftWithSugar();
    const bill = createBill({
      draft,
      products,
      settings: settingsWithGstin("08ABCDE1234F1Z5"),
      sequence: 1,
      now,
    });
    expect(bill.shop.gstin).toBe("08ABCDE1234F1Z5");
    expect(bill.createdAt).toBe(now.toISOString());
  });

  it("omits the GSTIN when the shop is not registered", () => {
    const { draft } = draftWithSugar();
    const bill = createBill({ draft, products, settings: settingsWithGstin(""), sequence: 1, now });
    expect(bill.shop.gstin).toBeUndefined();
  });

  it("keeps an old bill's GSTIN even after the shop changes it", () => {
    const { draft } = draftWithSugar();
    const bill = createBill({
      draft,
      products,
      settings: settingsWithGstin("08ABCDE1234F1Z5"),
      sequence: 1,
      now,
    });
    const reSanitised = sanitizeBill(bill);
    expect(reSanitised?.shop.gstin).toBe("08ABCDE1234F1Z5");
    // Bills saved before this change simply have no GSTIN.
    const legacy = sanitizeBill({ ...bill, shop: { ...bill.shop, gstin: undefined } });
    expect(legacy?.shop.gstin).toBeUndefined();
  });

  it("labels the Indian financial year on the date helper", () => {
    expect(financialYearLabel(new Date("2026-11-28"))).toBe("2026-27");
    expect(financialYearLabel(new Date("2026-04-01"))).toBe("2026-27");
    expect(financialYearLabel(new Date("2026-03-31"))).toBe("2025-26");
    expect(financialYearLabel("not-a-date")).toBe("");
  });
});

describe("receipt printing", () => {
  const now = new Date("2026-11-28T10:30:00.000Z");
  const renderBill = (gstin: string, width: "58mm" | "80mm" | "a4"): Bill => {
    const { draft } = draftWithSugar();
    const bill = createBill({ draft, products, settings: settingsWithGstin(gstin), sequence: 7, now });
    render(<Receipt bill={bill} width={width} />);
    return bill;
  };

  /** The printed date sits in the same row as its label, split across spans. */
  function printedDateRow(): HTMLElement {
    const label = screen.getByText(/Invoice date/i);
    return (label.closest("div") ?? label.closest("p") ?? label) as HTMLElement;
  }

  it("prints the bill date on an 80 mm receipt", () => {
    const bill = renderBill("08ABCDE1234F1Z5", "80mm");
    expect(printedDateRow()).toHaveTextContent(formatDate(bill.createdAt));
    expect(printedDateRow()).toHaveTextContent(formatTime(bill.createdAt));
    expect(screen.getByText("GSTIN: 08ABCDE1234F1Z5")).toBeInTheDocument();
  });

  it("prints the date and GSTIN on a 58 mm receipt", () => {
    const bill = renderBill("08ABCDE1234F1Z5", "58mm");
    expect(printedDateRow()).toHaveTextContent(formatDate(bill.createdAt));
    expect(screen.getByText("GSTIN: 08ABCDE1234F1Z5")).toBeInTheDocument();
  });

  it("prints the date and GSTIN on an A4 invoice", () => {
    const bill = renderBill("08ABCDE1234F1Z5", "a4");
    expect(printedDateRow()).toHaveTextContent(formatDate(bill.createdAt));
    expect(screen.getByText("GSTIN: 08ABCDE1234F1Z5")).toBeInTheDocument();
  });

  it("never prints a partial GSTIN", () => {
    const bill = renderBill("08ABCDE12", "80mm");
    expect(screen.queryByText(/GSTIN/i)).toBeNull();
    expect(printedDateRow()).toHaveTextContent(formatDate(bill.createdAt));
  });

  it("does not print a GSTIN line for an unregistered shop", () => {
    renderBill("", "80mm");
    expect(screen.queryByText(/GSTIN/i)).toBeNull();
  });
});

describe("settings screen", () => {
  afterEach(() => {
    cleanup();
    resetBrowserState();
  });

  it("saves a GSTIN and reprints it on new bills", async () => {
    const { default: SettingsPage } = await import("@/app/settings/page");
    resetBrowserState();
    seedStorage({ settings: testSettings({ shopName: "Sharma Kirana Store" }) });
    render(withProviders(<SettingsPage />));

    const field = await screen.findByLabelText(/gst number/i);
    fireEvent.change(field, { target: { value: "08abcde1234f1z5" } });
    // Typing is normalised and validated as you go.
    expect((field as HTMLInputElement).value).toBe("08ABCDE1234F1Z5");
    expect(screen.getByText(/Valid GSTIN · Rajasthan/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /save details/i }));

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.settings) ?? "{}");
      expect(stored.gstin).toBe("08ABCDE1234F1Z5");
    });
  });

  it("refuses to save a half-typed GSTIN", async () => {
    const { default: SettingsPage } = await import("@/app/settings/page");
    resetBrowserState();
    seedStorage({ settings: testSettings() });
    render(withProviders(<SettingsPage />));

    const field = await screen.findByLabelText(/gst number/i);
    fireEvent.change(field, { target: { value: "08ABCDE" } });
    expect(screen.getByText(/15 characters/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /save details/i }));

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.settings) ?? "{}");
    expect(stored.gstin).toBe("");
  });

  it("leaves the GSTIN empty when the shop is not registered", async () => {
    const { default: SettingsPage } = await import("@/app/settings/page");
    resetBrowserState();
    seedStorage({ settings: testSettings() });
    render(withProviders(<SettingsPage />));

    await screen.findByLabelText(/gst number/i);
    expect(screen.getByText(/Leave empty if you are not GST registered/i)).toBeInTheDocument();
  });
});

describe("bill date on the invoice", () => {
  it("validates the date the shopkeeper types", () => {
    expect(normalizeBillDate("2026-11-28")).toBe("2026-11-28");
    expect(normalizeBillDate("")).toBeNull();
    expect(normalizeBillDate(undefined)).toBeNull();
    expect(normalizeBillDate("28-11-2026")).toBeNull();
    // 31 February does not exist — no silent rollover to 3 March.
    expect(normalizeBillDate("2026-02-31")).toBeNull();
    expect(normalizeBillDate("2026-13-01")).toBeNull();
  });

  it("keeps today's exact time and back-dates older invoices", () => {
    const now = new Date("2026-11-28T10:30:00.000Z");
    expect(billTimestamp("", now)).toBe(now);
    expect(billTimestamp(localDayKey(now), now)).toBe(now);
    const earlier = billTimestamp("2026-11-20", now);
    expect(formatDate(earlier)).toBe(formatDate(new Date(2026, 10, 20)));
    expect(earlier.getHours()).toBe(now.getHours());
  });

  it("prints the chosen date and keeps it on the saved bill", () => {
    const { draft } = draftWithSugar();
    const bill = createBill({
      draft: { ...draft, billDate: "2026-11-20" },
      products,
      settings: settingsWithGstin("08ABCDE1234F1Z5"),
      sequence: 9,
      now: new Date(2026, 10, 28, 15, 45),
    });
    expect(formatDate(bill.createdAt)).toBe(formatDate(new Date(2026, 10, 20)));
    render(<Receipt bill={bill} width="80mm" />);
    expect(screen.getByText(new RegExp(formatDate(bill.createdAt)))).toBeInTheDocument();
  });

  it("falls back to today when the stored draft has no date", () => {
    const stored = sanitizeDraft({ items: [] });
    expect(stored.billDate).toBe("");
  });
});

describe("new bill screen", () => {
  afterEach(() => {
    cleanup();
    resetBrowserState();
  });

  it("shows the bill date, lets it be changed, and prints it with the GSTIN", async () => {
    const { default: NewBillPage } = await import("@/app/new-bill/page");
    resetBrowserState();
    seedStorage({ settings: testSettings({ shopName: "Sharma Kirana Store", gstin: "08ABCDE1234F1Z5" }) });
    render(withProviders(<NewBillPage />));

    await screen.findByText("Quick add");
    const dateField = (await screen.findByLabelText("Bill date")) as HTMLInputElement;
    expect(dateField.value).toBe(localDayKey(new Date()));
    expect(screen.getByText(/Prints on the receipt as/i)).toBeInTheDocument();

    // Back-date the bill, then add an item and review it.
    fireEvent.change(dateField, { target: { value: "2026-11-20" } });
    expect(screen.getByText(/Back-dated/i)).toBeInTheDocument();

    const textarea = await screen.findByLabelText(/or type your bill/i);
    fireEvent.change(textarea, { target: { value: "2 kilo chini" } });
    fireEvent.click(screen.getByRole("button", { name: /add to bill/i }));
    fireEvent.click(screen.getByRole("button", { name: /review & save bill/i }));

    await screen.findByText("Review before saving");
    expect(screen.getByText(/Invoice date:/i)).toBeInTheDocument();
    expect(screen.getByText("08ABCDE1234F1Z5")).toBeInTheDocument();
    const expected = formatDate(new Date(2026, 10, 20));
    expect(screen.getAllByText(new RegExp(expected)).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /^save bill$/i }));
    const receipt = await screen.findByRole("dialog", { name: /receipt vb-0001/i });
    expect(receipt).toHaveTextContent("GSTIN: 08ABCDE1234F1Z5");
    expect(receipt).toHaveTextContent(expected);
  });
});
