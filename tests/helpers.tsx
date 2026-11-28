import type { ReactElement } from "react";
import { AppProvider } from "@/store/AppProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { DEFAULT_SETTINGS, emptyDraft, type Bill, type Draft, type Product, type Settings } from "@/lib/types";
import { STORAGE_KEYS } from "@/lib/storage";
import { createSampleProducts } from "@/lib/sampleData";

export function testSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    ...DEFAULT_SETTINGS,
    shopName: "Test Kirana Store",
    address: "12 Main Market, Jaipur",
    phone: "9876543210",
    setupComplete: true,
    autoAddVoice: true,
    ...overrides,
  };
}

export function seedStorage({
  products = createSampleProducts(),
  bills = [],
  settings = testSettings(),
  draft = emptyDraft(),
}: {
  products?: Product[];
  bills?: Bill[];
  settings?: Settings;
  draft?: Draft;
} = {}) {
  window.localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(products));
  window.localStorage.setItem(STORAGE_KEYS.bills, JSON.stringify(bills));
  window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  window.localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(draft));
}

export function withProviders(ui: ReactElement) {
  return (
    <AppProvider>
      <ToastProvider>{ui}</ToastProvider>
    </AppProvider>
  );
}

export function resetBrowserState() {
  window.localStorage.clear();
  document.body.innerHTML = "";
}

export interface FakeSpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; length: number; 0: { transcript: string; confidence: number } }>;
}

export function speechResultEvent(transcript: string, isFinal = true): FakeSpeechResultEvent {
  const alternatives = { transcript, confidence: 0.92 };
  const result = { isFinal, length: 1, 0: alternatives };
  return {
    resultIndex: 0,
    results: Object.assign([result], { length: 1 }),
  };
}

type Handler<T> = ((event: T) => void) | null;

export class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  started = false;
  startCount = 0;
  onstart: Handler<Event> = null;
  onresult: Handler<FakeSpeechResultEvent> = null;
  onerror: Handler<{ error: string; message?: string }> = null;
  onend: Handler<Event> = null;

  constructor() {
    FakeRecognition.instances.push(this);
  }

  start() {
    this.started = true;
    this.startCount += 1;
    this.onstart?.(new Event("start"));
  }

  stop() {
    this.started = false;
    this.onend?.(new Event("end"));
  }

  abort() {
    this.started = false;
  }

  latest(): FakeRecognition {
    return FakeRecognition.instances[FakeRecognition.instances.length - 1]!;
  }
}

export function installFakeSpeech() {
  FakeRecognition.instances = [];
  (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition =
    FakeRecognition;
  delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  return FakeRecognition;
}

export function removeFakeSpeech() {
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
}
