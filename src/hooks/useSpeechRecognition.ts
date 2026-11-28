"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cleanTranscript,
  getSpeechRecognizer,
  isFatalSpeechError,
  isSpeechSupported,
  isTransientSpeechError,
  speechErrorMessage,
  type SpeechErrorEvent,
  type SpeechRecognizer,
  type SpeechRecognizerConstructor,
  type SpeechResultEvent,
} from "@/lib/speech";
import type { RecognitionLanguage } from "@/lib/types";

/**
 * Resilient, always-on voice session.
 *
 * Shop reality: someone lists items, stops to think, coughs, walks to a shelf,
 * then carries on. The browser's SpeechRecognition ends on every pause and
 * throws `no-speech` / `network` errors that have nothing to do with the shop.
 * This hook keeps one logical "listening" session alive across all of that:
 *
 * - auto-restarts after silence, network blips and browser-side stops;
 * - backs off gently (250 ms → 2 s) instead of giving up;
 * - only stops for errors that can never recover (permission, no mic);
 * - de-duplicates repeated finals, including the tail of a previous session;
 * - never sends interim text, so half-heard words can't become products.
 */

export type SpeechStatus =
  /** Microphone off. */
  | "idle"
  /** Recogniser is starting or restarting after a pause. */
  | "connecting"
  /** Actively hearing audio. */
  | "listening"
  /** Connection/engine hiccup, retrying automatically. */
  | "recovering"
  /** Stopped for a reason the shopkeeper must fix (permission, no mic). */
  | "blocked";

export interface SpeechSessionState {
  supported: boolean;
  status: SpeechStatus;
  listening: boolean;
  interim: string;
  error: string | null;
  /** Non-blocking notice (e.g. "Reconnecting…"), already translated. */
  notice: string | null;
  /** Consecutive automatic restarts in the current session. */
  restarts: number;
}

interface UseSpeechRecognitionOptions {
  language: RecognitionLanguage;
  /** Called once per final result — never for interim text. */
  onFinalTranscript: (text: string) => void;
  onError?: (message: string) => void;
  /** Called when the session starts, restarts or stops, for UI feedback. */
  onStatusChange?: (status: SpeechStatus) => void;
  /**
   * Keep the microphone open until explicitly stopped. Guests pausing to think
   * never lose their list.
   */
  keepAlive?: boolean;
}

interface UseSpeechRecognitionReturn extends SpeechSessionState {
  start: () => void;
  stop: () => void;
  toggle: () => void;
  clearError: () => void;
}

/** Restart delays: quick after a natural pause, slower after real trouble. */
const RESTART_DELAY_MS = 180;
const RECOVERY_DELAY_MS = 700;
const MAX_RECOVERY_DELAY_MS = 4000;
/** A session that ran this long resets the restart counter (it was healthy). */
const HEALTHY_SESSION_MS = 8000;
const DUPLICATE_WINDOW_MS = 5000;

function normaliseForKey(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

export function useSpeechRecognition({
  language,
  onFinalTranscript,
  onError,
  onStatusChange,
  keepAlive = true,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const [state, setState] = useState<SpeechSessionState>({
    supported: false,
    status: "idle",
    listening: false,
    interim: "",
    error: null,
    notice: null,
    restarts: 0,
  });

  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const wantListeningRef = useRef(false);
  const statusRef = useRef<SpeechStatus>("idle");
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartCountRef = useRef(0);
  const failureCountRef = useRef(0);
  const sessionStartRef = useRef(0);
  const lastFinalRef = useRef<{ key: string; at: number }>({ key: "", at: 0 });
  const lastHeardRef = useRef(0);
  const languageRef = useRef(language);
  const onFinalRef = useRef(onFinalTranscript);
  const onErrorRef = useRef(onError);
  const onStatusRef = useRef(onStatusChange);
  const keepAliveRef = useRef(keepAlive);

  useEffect(() => {
    onFinalRef.current = onFinalTranscript;
  }, [onFinalTranscript]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    onStatusRef.current = onStatusChange;
  }, [onStatusChange]);
  useEffect(() => {
    keepAliveRef.current = keepAlive;
  }, [keepAlive]);

  useEffect(() => {
    setState((prev) => ({ ...prev, supported: isSpeechSupported() }));
  }, []);

  const publish = useCallback((patch: Partial<SpeechSessionState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      if (next.status !== prev.status) {
        statusRef.current = next.status;
      }
      return next;
    });
  }, []);

  const setStatus = useCallback(
    (status: SpeechStatus, extra: Partial<SpeechSessionState> = {}) => {
      const wasListening = statusRef.current;
      statusRef.current = status;
      publish({ status, listening: status === "listening", ...extra });
      if (wasListening !== status) onStatusRef.current?.(status);
    },
    [publish],
  );

  const clearTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  /** Keep the screen (and the mic) alive on a phone that auto-locks. */
  const releaseWakeLockRef = useRef<(() => void) | null>(null);
  const requestWakeLock = useCallback(() => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    if (releaseWakeLockRef.current) return;
    const wakeLock = (navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release?: () => Promise<void> }> };
    }).wakeLock;
    if (!wakeLock) return;
    wakeLock
      .request("screen")
      .then((sentinel) => {
        releaseWakeLockRef.current = () => {
          void sentinel.release?.().catch(() => undefined);
        };
      })
      .catch(() => {
        // Wake lock is a nicety; the session works without it.
      });
  }, []);
  const releaseWakeLock = useCallback(() => {
    releaseWakeLockRef.current?.();
    releaseWakeLockRef.current = null;
  }, []);

  const isDuplicateFinal = useCallback((text: string): boolean => {
    const key = normaliseForKey(text);
    if (!key) return true;
    const now = Date.now();
    const last = lastFinalRef.current;
    if (last.key === key && now - last.at < DUPLICATE_WINDOW_MS) return true;
    // A session restart often repeats the tail of the previous phrase
    // ("aata" after "2 kilo aata"): treat it as the same words.
    if (last.key && last.key.endsWith(key) && now - last.at < DUPLICATE_WINDOW_MS) return true;
    lastFinalRef.current = { key, at: now };
    return false;
  }, []);

  const scheduleRestart = useCallback(
    (reason: "pause" | "recover") => {
      if (!wantListeningRef.current) return;
      if (restartTimerRef.current) return;
      if (!keepAliveRef.current) {
        wantListeningRef.current = false;
        setStatus("idle", { interim: "", notice: null });
        return;
      }

      const now = Date.now();
      const sessionLength = now - sessionStartRef.current;
      if (sessionLength > HEALTHY_SESSION_MS) {
        // The previous session worked for a while: it was not a failure loop.
        restartCountRef.current = 0;
        failureCountRef.current = 0;
        sessionStartRef.current = now;
      }
      restartCountRef.current += 1;

      const delay =
        reason === "pause"
          ? RESTART_DELAY_MS
          : Math.min(
              RECOVERY_DELAY_MS * 2 ** Math.min(failureCountRef.current, 3),
              MAX_RECOVERY_DELAY_MS,
            );
      if (reason === "recover") failureCountRef.current += 1;

      setStatus(reason === "pause" ? "connecting" : "recovering", {
        interim: "",
        notice:
          reason === "pause"
            ? null
            : "Reconnecting the microphone — keep speaking, your list is safe.",
        restarts: restartCountRef.current,
      });

      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        if (!wantListeningRef.current) return;
        const recognizer = recognizerRef.current;
        if (!recognizer) return;
        try {
          recognizer.start();
        } catch {
          // Already starting: try once more shortly instead of giving up.
          scheduleRestart("recover");
        }
      }, delay);
    },
    [setStatus],
  );

  const startRecognizer = useCallback(
    (Recognizer: SpeechRecognizerConstructor) => {
      const recognizer = new Recognizer();
      recognizer.lang = languageRef.current;
      recognizer.continuous = true;
      recognizer.interimResults = true;
      recognizer.maxAlternatives = 3;

      recognizer.onstart = () => {
        if (!wantListeningRef.current) {
          try {
            recognizer.abort();
          } catch {
            // ignore
          }
          return;
        }
        sessionStartRef.current = Date.now();
        failureCountRef.current = 0;
        setStatus("listening", { error: null, notice: null, interim: "" });
        requestWakeLock();
      };

      recognizer.onresult = (event: SpeechResultEvent) => {
        let interimText = "";
        const finals: string[] = [];
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result) continue;
          // Take the alternative the engine is most sure about (deterministic
          // tie-break on the first one), instead of blindly trusting index 0.
          let best = result[0]?.transcript ?? "";
          let bestConfidence = result[0]?.confidence ?? 0;
          for (let a = 1; a < result.length; a++) {
            const alternative = result[a];
            if (!alternative) continue;
            const confidence = alternative.confidence ?? 0;
            if (confidence > bestConfidence) {
              best = alternative.transcript;
              bestConfidence = confidence;
            }
          }
          const transcript = cleanTranscript(best);
          if (!transcript) continue;
          if (result.isFinal) finals.push(transcript);
          else interimText = `${interimText} ${transcript}`.trim();
        }

        lastHeardRef.current = Date.now();
        publish({ interim: interimText });
        if (statusRef.current !== "listening" && wantListeningRef.current) {
          // First words of a restarted session: it is healthy again.
          setStatus("listening", { interim: interimText, notice: null, error: null });
        }

        for (const finalText of finals) {
          if (isDuplicateFinal(finalText)) continue;
          failureCountRef.current = 0;
          onFinalRef.current(finalText);
        }
      };

      recognizer.onerror = (event: SpeechErrorEvent) => {
        const code = event.error;
        if (!wantListeningRef.current) return;

        if (code === "aborted") {
          // Caused by us (stop / language switch): let onend decide.
          return;
        }
        if (code === "no-speech") {
          // Perfectly normal: someone is thinking. Never surfaced as an error.
          setStatus("connecting", { interim: "" });
          return;
        }
        if (isTransientSpeechError(code)) {
          failureCountRef.current += 1;
          scheduleRestart("recover");
          return;
        }
        if (isFatalSpeechError(code)) {
          wantListeningRef.current = false;
          clearTimer();
          releaseWakeLock();
          const message = speechErrorMessage(code);
          setStatus("blocked", { interim: "", error: message, notice: null });
          onErrorRef.current?.(message);
          return;
        }
        // Unknown code: retry a couple of times, then surface it.
        if (failureCountRef.current < 2) {
          scheduleRestart("recover");
        } else {
          const message = speechErrorMessage(code);
          setStatus("idle", { interim: "", error: message, notice: null });
          wantListeningRef.current = false;
          onErrorRef.current?.(message);
        }
      };

      recognizer.onend = () => {
        publish({ interim: "" });
        if (!wantListeningRef.current) {
          releaseWakeLock();
          setStatus("idle", { interim: "", notice: null });
          return;
        }
        // The engine stops after every pause (especially on mobile). Keep the
        // session alive so the shopkeeper can simply carry on speaking.
        scheduleRestart("pause");
      };

      recognizerRef.current = recognizer;
      return recognizer;
    },
    [
      clearTimer,
      isDuplicateFinal,
      publish,
      releaseWakeLock,
      requestWakeLock,
      scheduleRestart,
      setStatus,
    ],
  );

  const start = useCallback(() => {
    const Recognizer = getSpeechRecognizer();
    if (!Recognizer) {
      const message = "Speech recognition is not supported in this browser. Please type the items.";
      setStatus("blocked", { error: message });
      onErrorRef.current?.(message);
      return;
    }
    if (wantListeningRef.current) return;

    clearTimer();
    wantListeningRef.current = true;
    restartCountRef.current = 0;
    failureCountRef.current = 0;
    sessionStartRef.current = Date.now();
    lastFinalRef.current = { key: lastFinalRef.current.key, at: 0 };
    setStatus("connecting", { error: null, notice: null, interim: "", restarts: 0 });

    const recognizer = recognizerRef.current ?? startRecognizer(Recognizer);
    try {
      recognizer.start();
    } catch {
      // A recogniser that is still shutting down refuses start(); retry shortly.
      scheduleRestart("recover");
    }
  }, [clearTimer, scheduleRestart, setStatus, startRecognizer]);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    clearTimer();
    releaseWakeLock();
    setStatus("idle", { interim: "", notice: null });
    const recognizer = recognizerRef.current;
    if (!recognizer) return;
    try {
      recognizer.stop();
    } catch {
      try {
        recognizer.abort();
      } catch {
        // ignore
      }
    }
  }, [clearTimer, releaseWakeLock, setStatus]);

  const toggle = useCallback(() => {
    if (wantListeningRef.current) stop();
    else start();
  }, [start, stop]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Language switch: restart with the new engine while staying in the session.
  useEffect(() => {
    languageRef.current = language;
    const recognizer = recognizerRef.current;
    if (!recognizer || recognizer.lang === language) return;
    recognizer.lang = language;
    if (!wantListeningRef.current) return;
    // Abort and re-create: changing lang on a live session is ignored by some
    // engines, which then keep transcribing in the old language.
    try {
      recognizer.abort();
    } catch {
      // ignore
    }
    recognizerRef.current = null;
    const Recognizer = getSpeechRecognizer();
    if (!Recognizer) return;
    const next = startRecognizer(Recognizer);
    try {
      next.start();
    } catch {
      scheduleRestart("recover");
    }
  }, [language, scheduleRestart, startRecognizer]);

  // Browsers suspend recognition when the tab is hidden. Resume on return so a
  // shopkeeper switching apps does not come back to a dead microphone.
  useEffect(() => {
    const onVisibility = () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return;
      if (!wantListeningRef.current) return;
      if (statusRef.current === "listening" || statusRef.current === "blocked") return;
      scheduleRestart("pause");
    };
    document.addEventListener("visibilitychange", onVisibility);
    const onOnline = () => {
      if (!wantListeningRef.current) return;
      if (statusRef.current === "recovering" || statusRef.current === "connecting") {
        scheduleRestart("recover");
      }
    };
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [scheduleRestart]);

  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      clearTimer();
      releaseWakeLock();
      const recognizer = recognizerRef.current;
      if (!recognizer) return;
      try {
        recognizer.abort();
      } catch {
        // ignore
      }
    };
  }, [clearTimer, releaseWakeLock]);

  // Give the UI a truthful "still hearing you" signal after long silences.
  useEffect(() => {
    const timer = setInterval(() => {
      if (statusRef.current !== "listening") return;
      const silentFor = Date.now() - lastHeardRef.current;
      if (silentFor > 20000) {
        setState((prev) => (prev.notice ? prev : { ...prev, notice: "Still listening — speak whenever you’re ready." }));
      }
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  return {
    ...state,
    start,
    stop,
    toggle,
    clearError,
  };
}
