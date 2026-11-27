import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import HistoryPage from "@/app/history/page";
import { createBill } from "@/lib/billing";
import { createSampleProducts } from "@/lib/sampleData";
import { STORAGE_KEYS } from "@/lib/storage";
import { emptyDraft, type Bill, type Draft } from "@/lib/types";
import { resetBrowserState, seedStorage, testSettings, withProviders } from "./helpers";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const products = createSampleProducts(new Date("2026-01-01T00:00:00Z"));
const settings = testSettings();

function billFor(
  number: number,
  productName: string,
  quantity: number,
  when: Date,
  customer = "",
): Bill {
  const product = products.find((candidate) => candidate.name === productName)!;
  const draft: Draft = {
    ...emptyDraft(),
    customerName: customer,
    items: [
      {
        id: `item-${number}`,
        productId: product.id,
        name: product.name,
        quantity,
        unit: product.unit,
        unitPrice: product.price,
        source: "voice",
        matchStatus: "matched",
        alternatives: [],
        needsReview: false,
      },
    ],
  };
  return createBill({ draft, products, settings, sequence: number, now: when });
}

const today = new Date();
const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
const bills: Bill[] = [
  billFor(1, "Sugar", 2, today, "Ramesh"),
  billFor(2, "Maggi Noodles", 3, today),
  billFor(3, "Sugar", 1, yesterday),
];

function renderHistory() {
  return render(withProviders(<HistoryPage />));
}

describe("bill history", () => {
  beforeEach(() => {
    resetBrowserState();
    seedStorage({ products, bills, settings });
  });

  afterEach(() => {
    cleanup();
  });

  it("lists saved bills newest first with their totals", async () => {
    renderHistory();
    expect(await screen.findByText("VB-0001")).toBeInTheDocument();
    expect(screen.getByText("VB-0002")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Open receipt VB-/ })).toHaveLength(3);
    expect(screen.getByText(/Ramesh/)).toBeInTheDocument();
  });

  it("searches by item name and shows an empty state when nothing matches", async () => {
    renderHistory();
    await screen.findByText("VB-0001");
    fireEvent.change(screen.getByLabelText("Search bills"), { target: { value: "maggi" } });
    await waitFor(() => expect(screen.queryByText("VB-0001")).not.toBeInTheDocument());
    expect(screen.getByText("VB-0002")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search bills"), { target: { value: "not-a-product" } });
    expect(await screen.findByText("No bills match these filters")).toBeInTheDocument();
  });

  it("filters by date range and clears the filters", async () => {
    renderHistory();
    await screen.findByText("VB-0001");
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    await waitFor(() => expect(screen.queryByText("VB-0003")).not.toBeInTheDocument());
    expect(screen.getByText("VB-0001")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "7 days" }));
    expect(await screen.findByText("VB-0003")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(await screen.findByText("Showing all saved bills")).toBeInTheDocument();
  });

  it("reopens the saved receipt", async () => {
    renderHistory();
    await screen.findByText("VB-0001");
    fireEvent.click(screen.getByRole("button", { name: "Open receipt VB-0001" }));
    const dialog = await screen.findByRole("dialog", { name: "Receipt VB-0001" });
    expect(within(dialog).getByText("Test Kirana Store")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close receipt" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Receipt VB-0001" })).not.toBeInTheDocument());
  });

  it("deletes a bill only after confirmation", async () => {
    renderHistory();
    await screen.findByText("VB-0001");
    fireEvent.click(screen.getByRole("button", { name: "Delete bill VB-0001" }));
    expect(await screen.findByText("Delete bill VB-0001?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete bill" }));
    await waitFor(() => expect(screen.queryByText("VB-0001")).not.toBeInTheDocument());
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.bills) ?? "[]") as Bill[];
    expect(stored.map((bill) => bill.number)).not.toContain("VB-0001");
  });
});
