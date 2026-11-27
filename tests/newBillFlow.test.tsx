import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import NewBillPage from "@/app/new-bill/page";
import { STORAGE_KEYS } from "@/lib/storage";
import type { Bill, Draft } from "@/lib/types";
import { emptyDraft } from "@/lib/types";
import {
  installFakeSpeech,
  removeFakeSpeech,
  resetBrowserState,
  seedStorage,
  speechResultEvent,
  testSettings,
  withProviders,
} from "./helpers";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string | { pathname?: string };
    children: React.ReactNode;
  }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}));

function storedBills(): Bill[] {
  const raw = window.localStorage.getItem(STORAGE_KEYS.bills);
  return raw ? (JSON.parse(raw) as Bill[]) : [];
}

function storedDraft(): Draft {
  const raw = window.localStorage.getItem(STORAGE_KEYS.draft);
  return raw ? (JSON.parse(raw) as Draft) : emptyDraft();
}

async function addByTyping(text: string) {
  const textarea = await screen.findByLabelText(/or type your bill/i);
  fireEvent.change(textarea, { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: /add to bill/i }));
}

describe("new bill workspace", () => {
  beforeEach(() => {
    resetBrowserState();
    seedStorage();
  });

  afterEach(() => {
    cleanup();
    resetBrowserState();
    removeFakeSpeech();
    vi.restoreAllMocks();
  });

  it("adds a typed item, prices it from the catalogue and saves a bill", async () => {
    render(withProviders(<NewBillPage />));

    await waitFor(() => expect(screen.getByText("Quick add")).toBeInTheDocument());
    await addByTyping("2 kilo chini");

    const quantity = (await screen.findByLabelText("Quantity of Sugar")) as HTMLInputElement;
    expect(quantity.value).toBe("2");
    expect(screen.getAllByText("₹90.00").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /review & save bill/i }));
    await screen.findByText("Review before saving");
    fireEvent.click(screen.getByRole("button", { name: /^save bill$/i }));

    await screen.findByRole("dialog", { name: /receipt vb-0001/i });
    const bills = storedBills();
    expect(bills).toHaveLength(1);
    expect(bills[0].number).toBe("VB-0001");
    expect(bills[0].items[0]).toMatchObject({ name: "Sugar", quantity: 2, unitPrice: 45, amount: 90 });
    expect(bills[0].total).toBe(90);
    expect(storedDraft().items).toHaveLength(0);
  });

  it("adds several products from one spoken sentence", async () => {
    const speech = installFakeSpeech();
    render(withProviders(<NewBillPage />));
    await waitFor(() => expect(screen.getByText("Quick add")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /start voice input/i }));
    expect(speech.instances).toHaveLength(1);

    act(() => {
      speech.instances[0]!.onresult?.(speechResultEvent("3 kilo chini aur 2 kilo aata"));
    });

    const sugarQty = (await screen.findByLabelText("Quantity of Sugar", {}, { timeout: 3000 })) as HTMLInputElement;
    expect(sugarQty.value).toBe("3");
    const flourQty = screen.getByLabelText("Quantity of Wheat Flour (Aata)") as HTMLInputElement;
    expect(flourQty.value).toBe("2");
    expect(screen.getAllByText("₹215.00").length).toBeGreaterThan(0);
    expect(storedDraft().items).toHaveLength(2);
  });

  it("does not add the same recognition result twice", async () => {
    const speech = installFakeSpeech();
    render(withProviders(<NewBillPage />));
    await waitFor(() => expect(screen.getByText("Quick add")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /start voice input/i }));
    const recognition = speech.instances[0]!;
    act(() => {
      recognition.onresult?.(speechResultEvent("2 kilo chini"));
    });
    await screen.findByLabelText("Quantity of Sugar");
    act(() => {
      recognition.onresult?.(speechResultEvent("2 kilo chini"));
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(screen.getAllByLabelText("Quantity of Sugar")).toHaveLength(1);
    const qty = screen.getByLabelText("Quantity of Sugar") as HTMLInputElement;
    expect(qty.value).toBe("2");
  });

  it("keeps unmatched products out of the final bill", async () => {
    render(withProviders(<NewBillPage />));
    await waitFor(() => expect(screen.getByText("Quick add")).toBeInTheDocument());

    await addByTyping("2 kilo unicorn powder");
    await screen.findByText("Unicorn Powder");
    expect(screen.getByText("No match")).toBeInTheDocument();

    const review = screen.getByRole("button", { name: /review & save bill/i }) as HTMLButtonElement;
    expect(review).toBeDisabled();
    expect(screen.getByText(/thing(s)? to check/i)).toBeInTheDocument();
    expect(storedBills()).toHaveLength(0);
  });

  it("keeps the current draft when the microphone permission is denied", async () => {
    const sugar = {
      id: "sample-sugar",
      productId: "sample-sugar",
      name: "Sugar",
      quantity: 1,
      unit: "kg" as const,
      unitPrice: 45,
      source: "manual" as const,
      matchStatus: "matched" as const,
      alternatives: [],
      needsReview: false,
    };
    seedStorage({ draft: { ...emptyDraft(), items: [sugar] } });
    const speech = installFakeSpeech();

    render(withProviders(<NewBillPage />));
    await waitFor(() => expect(screen.getByText("Draft restored from this device — continue where you left off.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /start voice input/i }));
    act(() => {
      speech.instances[0]!.onerror?.({ error: "not-allowed" });
    });

    expect(await screen.findByText(/microphone access is blocked/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Quantity of Sugar")).toBeInTheDocument();
    expect(storedDraft().items).toHaveLength(1);
  });

  it("falls back to typing when speech recognition is unsupported", async () => {
    removeFakeSpeech();
    render(withProviders(<NewBillPage />));

    expect(await screen.findByText(/voice input isn’t available in this browser/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start voice input/i })).toBeInTheDocument();

    await addByTyping("1 kilo chawal");
    const qty = (await screen.findByLabelText("Quantity of Rice")) as HTMLInputElement;
    expect(qty.value).toBe("1");
    expect(screen.getAllByText("₹55.00").length).toBeGreaterThan(0);
  });
});

describe("draft persistence", () => {
  beforeEach(() => {
    resetBrowserState();
    seedStorage({ settings: testSettings({ autoAddVoice: false }) });
  });

  afterEach(() => {
    cleanup();
    resetBrowserState();
    vi.restoreAllMocks();
  });

  it("restores an unfinished bill after a refresh", async () => {
    const first = render(withProviders(<NewBillPage />));
    await waitFor(() => expect(screen.getByText("Quick add")).toBeInTheDocument());
    await addByTyping("3 kilo chini");
    await screen.findByLabelText("Quantity of Sugar");
    first.unmount();

    render(withProviders(<NewBillPage />));
    expect(
      await screen.findByText("Draft restored from this device — continue where you left off."),
    ).toBeInTheDocument();
    const qty = (await screen.findByLabelText("Quantity of Sugar")) as HTMLInputElement;
    expect(qty.value).toBe("3");
  });
});
