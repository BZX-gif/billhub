"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cleanTranscript,
  getSpeechRecognizer,
  isSpeechSupported,
  speechErrorMessage,
  type SpeechErrorEvent,
  type SpeechRecognizer,
  type SpeechResultEvent,
} from "@/lib/speech";
import type { RecognitionLanguage } from "@/lib/types";

interface UseSpeechRecognitionOptions {
  language: RecognitionLanguage;
  /** Called once per final result — never for interim text. */
  onFinalTranscript: (text: string) => void;
  onError?: (message: string) => void;
}

interface UseSpeechRecognitionReturn {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  clearError: () => void;
}

const RESTART_DELAY_MS = 350;
const MAX_RESTARTS = 60;
const DUPLICATE_WINDOW_MS = 4000;

/**
 * Thin, defensive wrapper around the browser SpeechRecognition API.
 *
 * - feature-detected (Firefox / older webviews fall back to typing)
 * - only final results reach the caller
 * - repeated finals and auto-restart loops are de-duplicated
 * - mobile Chrome ends recognition on silence, so it restarts while the
 *   shopkeeper is still in "listening" mode
 */
export function useSpeechRecognition({
  language,
  onFinalTranscript,
  onError,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const wantListeningRef = useRef(false);
  const restartCountRef = useRef(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFinalRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const languageRef = useRef(language);
  const onFinalRef = useRef(onFinalTranscript);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onFinalRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    setSupported(isSpeechSupported());
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    clearRestartTimer();
    setInterim("");
    setListening(false);
    const recognizer = recognizerRef.current;
    if (recognizer) {
      try {
        recognizer.stop();
      } catch {
        try {
          recognizer.abort();
        } catch {
          // ignore
        }
      }
    }
  }, [clearRestartTimer]);

  const start = useCallback(() => {
    const Recognizer = getSpeechRecognizer();
    if (!Recognizer) {
      const message = "Speech recognition is not supported in this browser. Please type the items.";
      setError(message);
      onErrorRef.current?.(message);
      return;
    }
    if (wantListeningRef.current) return;

    clearRestartTimer();
    setError(null);
    setInterim("");
    restartCountRef.current = 0;
    wantListeningRef.current = true;

    const recognizer = new Recognizer();
    recognizer.lang = languageRef.current;
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.maxAlternatives = 1;

    recognizer.onstart = () => {
      if (wantListeningRef.current) setListening(true);
    };

    recognizer.onresult = (event: SpeechResultEvent) => {
      let interimText = "";
      const finals: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        const transcript = cleanTranscript(result[0]?.transcript ?? "");
        if (!transcript) continue;
        if (result.isFinal) finals.push(transcript);
        else interimText = `${interimText} ${transcript}`.trim();
      }
      setInterim(interimText);

      for (const finalText of finals) {
        const now = Date.now();
        const last = lastFinalRef.current;
        const isDuplicate = last.text === finalText.toLowerCase() && now - last.at < DUPLICATE_WINDOW_MS;
        if (isDuplicate) continue;
        lastFinalRef.current = { text: finalText.toLowerCase(), at: now };
        onFinalRef.current(finalText);
      }
    };

    recognizer.onerror = (event: SpeechErrorEvent) => {
      const code = event.error;
      if (code === "aborted") return;
      const message = speechErrorMessage(code);
      setError(message);
      onErrorRef.current?.(message);
      if (
        code === "not-allowed" ||
        code === "service-not-allowed" ||
        code === "audio-capture" ||
        code === "language-not-supported"
      ) {
        wantListeningRef.current = false;
        setListening(false);
      }
      if (code === "network") {
        wantListeningRef.current = false;
        setListening(false);
      }
    };

    recognizer.onend = () => {
      setInterim("");
      if (!wantListeningRef.current) {
        setListening(false);
        return;
      }
      // Browser ended the session (common after a pause on mobile). Restart
      // while the shopkeeper is still in listening mode.
      if (restartCountRef.current >= MAX_RESTARTS) {
        wantListeningRef.current = false;
        setListening(false);
        setError("Listening paused. Tap the mic to continue.");
        return;
      }
      restartCountRef.current += 1;
      restartTimerRef.current = setTimeout(() => {
        if (!wantListeningRef.current) return;
        try {
          recognizer.start();
        } catch {
          // A new session may still be starting; retry once shortly.
          restartTimerRef.current = setTimeout(() => {
            if (!wantListeningRef.current) return;
            try {
              recognizer.start();
            } catch {
              wantListeningRef.current = false;
              setListening(false);
            }
          }, 500);
        }
      }, RESTART_DELAY_MS);
    };

    recognizerRef.current = recognizer;
    try {
      recognizer.start();
      setListening(true);
    } catch {
      // Calling start() twice throws; treat as already listening.
      wantListeningRef.current = false;
      setListening(false);
      setError("Could not start listening. Please try again.");
    }
  }, [clearRestartTimer]);

  const toggle = useCallback(() => {
    if (wantListeningRef.current) stop();
    else start();
  }, [start, stop]);

  const clearError = useCallback(() => setError(null), []);

  // Keep the recogniser language in sync, restarting if needed.
  useEffect(() => {
    languageRef.current = language;
    const recognizer = recognizerRef.current;
    if (!recognizer) return;
    if (recognizer.lang === language) return;
    recognizer.lang = language;
    if (wantListeningRef.current) {
      restartCountRef.current = 0;
    }
  }, [language]);

  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      clearRestartTimer();
      const recognizer = recognizerRef.current;
      if (recognizer) {
        try {
          recognizer.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [clearRestartTimer]);

  return { supported, listening, interim, error, start, stop, toggle, clearError };
}
