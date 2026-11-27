import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Receipt } from "@/components/receipt/Receipt";
import { ReceiptDialog } from "@/components/receipt/ReceiptDialog";
import { createBill } from "@/lib/billing";
import { createSampleProducts } from "@/lib/sampleData";
import { emptyDraft, type Bill, type Draft } from "@/lib/types";
import { resetBrowserState, testSettings, withProviders } from "./helpers";

const products = createSampleProducts(new Date("2026-01-01T00:00:00Z"));
const settings = testSettings({ thankYouMessage: "Thank you! Visit again." });

function makeBill(overrides: Partial<Draft> = {}): Bill {
  const sugar = products.find((product) => product.name === "Sugar")!;
  const flour = products.find((product) => product.name === "Wheat Flour (Aata)")!;
  const oil = products.find((product) => product.name === "Soybean Oil")!;
  const draft: Draft = {
    ...emptyDraft(),
    customerName: "Ramesh Kumar",
    ...overrides,
    items:
      overrides.items ??
      [
        {
          id: "i1",
          productId: sugar.id,
          name: sugar.name,
          quantity: 3,
          unit: "kg",
          unitPrice: 45,
          source: "voice",
          matchStatus: "matched",
          alternatives: [],
          needsReview: false,
        },
        {
          id: "i2",
          productId: flour.id,
          name: flour.name,
          quantity: 2,
          unit: "kg",
          unitPrice: 40,
          source: "voice",
          matchStatus: "matched",
          alternatives: [],
          needsReview: false,
        },
        {
          id: "i3",
          productId: oil.id,
          name: oil.name,
          quantity: 3,
          unit: "litre",
          unitPrice: 130,
          source: "voice",
          matchStatus: "matched",
          alternatives: [],
          needsReview: false,
        },
      ],
  };
  return createBill({
    draft,
    products,
    settings,
    sequence: 12,
    now: new Date("2026-11-27T10:30:00+05:30"),
  });
}

describe("receipt rendering", () => {
  it("prints shop details, items, quantity, rates and total", () => {
    const bill = makeBill();
    render(<Receipt bill={bill} width="80mm" />);

    expect(screen.getByText("Test Kirana Store")).toBeInTheDocument();
    expect(screen.getByText("12 Main Market, Jaipur")).toBeInTheDocument();
    expect(screen.getByText("Ph: 9876543210")).toBeInTheDocument();
    expect(screen.getByText("VB-0012")).toBeInTheDocument();
    expect(screen.getByText("Ramesh Kumar")).toBeInTheDocument();
    expect(screen.getByText("Sugar")).toBeInTheDocument();
    expect(screen.getByText("3 kg × ₹45.00")).toBeInTheDocument();
    expect(screen.getAllByText("₹135.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("₹605.00").length).toBeGreaterThan(0);
    expect(screen.getByText("Thank you! Visit again.")).toBeInTheDocument();
    expect(screen.getByText("Powered by VoiceBill")).toBeInTheDocument();
  });

  it("shows the discount and final amount", () => {
    const bill = makeBill({ discountType: "percent", discountValue: 10 });
    render(<Receipt bill={bill} width="80mm" />);
    expect(screen.getByText("Discount (10%)")).toBeInTheDocument();
    expect(screen.getByText("− ₹60.50")).toBeInTheDocument();
    expect(screen.getByText("₹544.50")).toBeInTheDocument();
  });

  it("uses the 58 mm and A4 layouts with the right paper width", () => {
    const bill = makeBill();
    const { container, rerender } = render(<Receipt bill={bill} width="58mm" />);
    const sheet = container.querySelector(".receipt-sheet");
    expect(sheet).toHaveAttribute("data-format", "58mm");
    expect(screen.getByLabelText(`Receipt for bill ${bill.number}`)).toBeInTheDocument();

    rerender(<Receipt bill={bill} width="a4" />);
    expect(container.querySelector(".receipt-sheet")).toHaveAttribute("data-format", "a4");
    expect(screen.getByText("Invoice")).toBeInTheDocument();
    expect(screen.getAllByText("Item").length).toBeGreaterThan(0);
  });

  it("falls back to a walk-in customer when no name is given", () => {
    const bill = makeBill({ customerName: "" });
    render(<Receipt bill={bill} width="a4" />);
    expect(screen.getByText("Walk-in customer")).toBeInTheDocument();
  });
});

describe("receipt dialog", () => {
  const printMock = vi.fn();

  beforeEach(() => {
    resetBrowserState();
    printMock.mockReset();
    Object.defineProperty(window, "print", { value: printMock, writable: true, configurable: true });
  });

  afterEach(() => {
    cleanup();
    document.title = "VoiceBill";
  });

  it("isolates the receipt for printing and calls the browser print dialog", () => {
    const bill = makeBill();
    const { container } = render(withProviders(<ReceiptDialog open bill={bill} onClose={() => {}} />));

    expect(container.ownerDocument.querySelector(".print-area")).not.toBeNull();
    expect(screen.getByRole("dialog", { name: `Receipt ${bill.number}` })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /print bill/i }));
    expect(printMock).toHaveBeenCalledTimes(1);
    expect(document.title).toBe(`VoiceBill-${bill.number}`);
  });

  it("offers Save as PDF through the same print dialog", () => {
    const bill = makeBill();
    render(withProviders(<ReceiptDialog open bill={bill} onClose={() => {}} />));
    fireEvent.click(screen.getByRole("button", { name: /save as pdf/i }));
    expect(printMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/choose .*save as pdf/i)).toBeInTheDocument();
  });

  it("switches the preview paper size", () => {
    const bill = makeBill();
    const { container } = render(withProviders(<ReceiptDialog open bill={bill} onClose={() => {}} />));
    expect(container.ownerDocument.querySelector(".receipt-sheet")).toHaveAttribute("data-format", "80mm");
    fireEvent.click(screen.getByRole("button", { name: "A4" }));
    expect(container.ownerDocument.querySelector(".receipt-sheet")).toHaveAttribute("data-format", "a4");
  });

  it("injects the real @page size and margins for each paper width", () => {
    const bill = makeBill();
    render(withProviders(<ReceiptDialog open bill={bill} onClose={() => {}} />));
    const pageStyle = () =>
      [...document.querySelectorAll("style")]
        .map((node) => node.textContent ?? "")
        .find((text) => text.includes("@page")) ?? "";
    expect(pageStyle()).toContain("size: 80mm auto");
    expect(pageStyle()).toContain("margin: 2mm");
    fireEvent.click(screen.getByRole("button", { name: "58 mm" }));
    expect(pageStyle()).toContain("size: 58mm auto");
    fireEvent.click(screen.getByRole("button", { name: "A4" }));
    expect(pageStyle()).toContain("size: A4");
    expect(pageStyle()).toContain("margin: 12mm");
  });
});
