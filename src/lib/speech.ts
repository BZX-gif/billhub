/**
 * Minimal typings and feature detection for the Web Speech API, plus the
 * error taxonomy the resilient session uses.
 * Nothing is uploaded by VoiceBill: recognition is performed by the browser.
 */
import type { RecognitionLanguage } from "./types";

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

export type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognizerConstructor;
  webkitSpeechRecognition?: SpeechRecognizerConstructor;
};

export const SPEECH_LANGUAGES: Record<RecognitionLanguage, { label: string; native: string }> = {
  "hi-IN": { label: "Hindi / Hinglish", native: "हिंदी" },
  "en-IN": { label: "Indian English", native: "English" },
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

/**
 * Errors that will never fix themselves while the mic keeps running
 * (no permission, no microphone, unsupported language). Listening must stop.
 */
export function isFatalSpeechError(code: string): boolean {
  return (
    code === "not-allowed" ||
    code === "service-not-allowed" ||
    code === "audio-capture" ||
    code === "language-not-supported" ||
    code === "bad-grammar"
  );
}

/**
 * Errors that are normal in a shop: silence, a cough, a dropped connection.
 * These must never end the session or show a scary message.
 */
export function isTransientSpeechError(code: string): boolean {
  return (
    code === "no-speech" ||
    code === "network" ||
    code === "aborted" ||
    code === "audio-busy" ||
    code === "interrupted"
  );
}

export function speechErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow the microphone in your browser settings, or type the items instead.";
    case "audio-capture":
      return "No microphone was found. You can still type the items.";
    case "network":
      return "Voice input lost its connection. It will reconnect by itself — you can also type the items.";
    case "no-speech":
      return "I didn’t catch anything. Keep speaking — I’m still listening.";
    case "aborted":
      return "Listening stopped.";
    case "language-not-supported":
      return "This browser does not support the selected language. Try the other language or type the items.";
    default:
      return "Speech recognition hiccupped. Still listening — please repeat that item.";
  }
}

/** Trim and clean a final transcript chunk. */
export function cleanTranscript(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
