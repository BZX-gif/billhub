/**
 * Minimal typings and feature detection for the Web Speech API.
 * Nothing is uploaded by VoiceBill: recognition is performed by the browser.
 */

export interface SpeechAlternative {
  transcript: string;
  confidence: number;
}

export interface SpeechResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechAlternative;
}

export interface SpeechResultList {
  length: number;
  [index: number]: SpeechResult;
}

export interface SpeechResultEvent extends Event {
  resultIndex: number;
  results: SpeechResultList;
}

export interface SpeechErrorEvent extends Event {
  error: string;
  message?: string;
}

export interface SpeechRecognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((event: Event) => void) | null;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: ((event: Event) => void) | null;
}

export type SpeechRecognizerConstructor = new () => SpeechRecognizer;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognizerConstructor;
  webkitSpeechRecognition?: SpeechRecognizerConstructor;
};

export function isSpeechSupported(): boolean {
  if (typeof window === "undefined") return false;
  const speechWindow = window as SpeechWindow;
  return typeof (speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition) === "function";
}

export function getSpeechRecognizer(): SpeechRecognizerConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function speechErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow the microphone in your browser settings, or type the items instead.";
    case "audio-capture":
      return "No microphone was found. You can still type the items.";
    case "network":
      return "Speech recognition needs an internet connection in this browser. You can type the items instead.";
    case "no-speech":
      return "I didn’t catch anything. Tap the mic and speak a little closer.";
    case "aborted":
      return "Listening stopped.";
    case "language-not-supported":
      return "This browser does not support the selected language. Try the other language or type the items.";
    default:
      return "Speech recognition failed. You can type the items instead.";
  }
}

/** Trim and clean a final transcript chunk. */
export function cleanTranscript(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
