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

  it("does not add a product when the shopkeeper only hums into the mic", async () => {
    const speech = installFakeSpeech();
    render(withProviders(<NewBillPage />));
    await waitFor(() => expect(screen.getByText("Quick add")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /start voice input/i }));
    act(() => {
      speech.instances[0]!.onresult?.(speechResultEvent("huu"));
    });

    // A hum is not an error and not a product: the mic just stays open.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.queryByLabelText(/^Quantity of /)).toBeNull();
    expect(storedDraft().items).toHaveLength(0);
    expect(screen.queryByText("No recognizable grocery product found. Please try again.")).toBeNull();
    expect(screen.getByRole("button", { name: /save this list/i })).toBeInTheDocument();
  });

  it("does not create a product from a measured filler word", async () => {
    render(withProviders(<NewBillPage />));
    await waitFor(() => expect(screen.getByText("Quick add")).toBeInTheDocument());

    await addByTyping("3 kg huu");

    expect(
      await screen.findByText("No recognizable grocery product found. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Quantity of /)).toBeNull();
    expect(storedDraft().items).toHaveLength(0);
  });

  it("adds the product when the shopkeeper hums then says an item", async () => {
    const speech = installFakeSpeech();
    render(withProviders(<NewBillPage />));
    await waitFor(() => expect(screen.getByText("Quick add")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /start voice input/i }));
    act(() => {
      speech.instances[0]!.onresult?.(speechResultEvent("umm 3 kg sugar"));
    });

    const qty = (await screen.findByLabelText("Quantity of Sugar", {}, { timeout: 3000 })) as HTMLInputElement;
    expect(qty.value).toBe("3");
    expect(storedDraft().items).toHaveLength(1);
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

describe("continuous voice list", () => {
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

  async function startSpeaking() {
    const speech = installFakeSpeech();
    render(withProviders(<NewBillPage />));
    await waitFor(() => expect(screen.getByText("Quick add")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /start voice input/i }));
    return speech.instances[0]!;
  }

  it("keeps listening after a pause and adds the list once it settles", async () => {
    const recognition = await startSpeaking();

    act(() => {
      recognition.onresult?.(speechResultEvent("3 kilo chini"));
    });
    act(() => {
      recognition.onresult?.(speechResultEvent("aur 2 kilo aata"));
    });

    // Both chunks stay one sentence until the shopkeeper stops speaking.
    const qty = (await screen.findByLabelText("Quantity of Sugar", {}, { timeout: 3000 })) as HTMLInputElement;
    expect(qty.value).toBe("3");
    expect((screen.getByLabelText("Quantity of Wheat Flour (Aata)") as HTMLInputElement).value).toBe("2");
    expect(storedDraft().items).toHaveLength(2);
    // The microphone is still open for the rest of the list.
    expect(screen.getByRole("button", { name: /save this list/i })).toBeInTheDocument();
    expect(recognition.started).toBe(true);
  });

  it("does not add anything when the shopkeeper only hums", async () => {
    const recognition = await startSpeaking();

    act(() => {
      recognition.onerror?.({ error: "no-speech" });
      recognition.onresult?.(speechResultEvent("huh"));
      recognition.onresult?.(speechResultEvent("hmm"));
    });

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(storedDraft().items).toHaveLength(0);
    expect(screen.queryByText("No recognizable grocery product found. Please try again.")).toBeNull();
  });

  it("recovers from a network error and keeps the spoken list", async () => {
    const recognition = await startSpeaking();

    act(() => {
      recognition.onresult?.(speechResultEvent("2 kilo chini"));
      recognition.onerror?.({ error: "network" });
      recognition.onend?.(new Event("end"));
    });

    expect(screen.queryByText(/Voice input lost its connection/i)).toBeNull();

    // The engine comes back on its own; the next item still lands.
    await waitFor(() => expect(recognition.startCount).toBeGreaterThan(1), { timeout: 3000 });
    act(() => {
      recognition.onstart?.(new Event("start"));
      recognition.onresult?.(speechResultEvent("aur 1 kilo namak"));
    });

    await screen.findByLabelText("Quantity of Sugar", {}, { timeout: 3000 });
    await screen.findByLabelText("Quantity of Tata Salt", {}, { timeout: 3000 });
    // Storage is written after the state commit, so allow a tick for it.
    await waitFor(() => expect(storedDraft().items).toHaveLength(2));
  });

  it("clears what was heard without touching the bill", async () => {
    const recognition = await startSpeaking();

    act(() => {
      recognition.onresult?.(speechResultEvent("2 kilo unicorn powder"));
    });
    await screen.findByText("Unicorn Powder", {}, { timeout: 3000 });
    expect(storedDraft().items).toHaveLength(1);

    // "clear" drops only the pending words, never the bill.
    act(() => {
      recognition.onresult?.(speechResultEvent("clear"));
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(storedDraft().items).toHaveLength(1);
    expect((screen.getByLabelText(/your words|or type your bill/i) as HTMLTextAreaElement).value).toBe("");
  });
});
