"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  AudioLines,
  Check,
  CircleStop,
  Info,
  Mic,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { useSpeechRecognition, type SpeechStatus } from "@/hooks/useSpeechRecognition";
import { parseUtterance } from "@/lib/parser";
import { createDraftItemFromParsed } from "@/lib/resolve";
import type { DraftItem, RecognitionLanguage } from "@/lib/types";
import { UNIT_LABEL } from "@/lib/types";
import { formatQuantity } from "@/lib/units";
import { useApp } from "@/store/AppProvider";
import { useToast } from "@/components/ui/Toast";
import { Segmented } from "@/components/ui/Segmented";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { cleanTranscript } from "@/lib/speech";
import { NO_PRODUCT_MESSAGE } from "@/lib/speechMessages";
import {
  appendToList,
  continuesPrevious,
  isClearCommand,
  isHesitationOnly,
} from "@/lib/speechText";

const EXAMPLES: Array<{ label: string; text: string; lang: RecognitionLanguage }> = [
  { label: "3 किलो चीनी, 2 किलो आटा", text: "3 kilo chini aur 2 kilo aata", lang: "hi-IN" },
  { label: "5 packet Maggi", text: "5 packet Maggi", lang: "hi-IN" },
  { label: "1.5 litre tel", text: "1.5 litre tel", lang: "hi-IN" },
  { label: "500 gram sugar", text: "500 gram sugar", lang: "en-IN" },
];

interface LastHeard {
  text: string;
  /** Draft line ids created from this sentence, so the feedback stays in sync. */
  itemIds: string[];
}

export function VoiceCapture() {
  const { products, draft, addDraftItems, removeDraftItem, settings, updateSettings } = useApp();
  const { notify, notifyUndo } = useToast();
  const [language, setLanguage] = useState<RecognitionLanguage>(settings.language);
  const [transcript, setTranscript] = useState("");
  const [processing, setProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [lastHeard, setLastHeard] = useState<LastHeard | null>(null);
  const [autoAdd, setAutoAdd] = useState(settings.autoAddVoice);
  /**
   * The running spoken list. Consecutive speech chunks accumulate here so a
   * shopkeeper who pauses mid-list can simply carry on — "…3 kilo chini",
   * pause, "aur 2 kilo aata" lands as one sentence, not two guesses.
   */
  const [sessionLine, setSessionLine] = useState<string | null>(null);
  /** A commit is queued: wait for the rest of the pause before parsing. */
  const [settling, setSettling] = useState(false);

  const productsRef = useRef(products);
  productsRef.current = products;
  const autoAddRef = useRef(autoAdd);
  autoAddRef.current = autoAdd;
  const addDraftItemsRef = useRef(addDraftItems);
  addDraftItemsRef.current = addDraftItems;
  const removeDraftItemRef = useRef(removeDraftItem);
  removeDraftItemRef.current = removeDraftItem;
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const notifyUndoRef = useRef(notifyUndo);
  notifyUndoRef.current = notifyUndo;
  const lastCommitRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const processingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionLineRef = useRef<string | null>(null);
  sessionLineRef.current = sessionLine;
  const statusRef = useRef<SpeechStatus>("idle");

  useEffect(() => {
    setLanguage(settings.language);
  }, [settings.language]);

  useEffect(() => {
    setAutoAdd(settings.autoAddVoice);
  }, [settings.autoAddVoice]);

  useEffect(() => {
    return () => {
      if (processingTimer.current) clearTimeout(processingTimer.current);
    };
  }, []);

  /** Drop the pending buffer without touching the bill. */
  const resetSessionLine = useCallback(() => {
    sessionLineRef.current = null;
    setSessionLine(null);
  }, []);

  const handleClear = useCallback(() => {
    resetSessionLine();
    setTranscript("");
    setLocalError(null);
    notifyRef.current({ tone: "success", message: "Cleared what I was holding. Your bill is unchanged." });
  }, [resetSessionLine]);


  const commitText = useCallback((rawText: string) => {
    const text = cleanTranscript(rawText);
    if (!text) return;
    setLocalError(null);
    const now = Date.now();
    if (
      lastCommitRef.current.text === text.toLowerCase() &&
      now - lastCommitRef.current.at < 2500
    ) {
      return;
    }
    lastCommitRef.current = { text: text.toLowerCase(), at: now };

    // "clear" / "naya bill" resets only the pending words, never the bill.
    if (isClearCommand(text)) {
      resetSessionLine();
      setTranscript("");
      notifyRef.current({ tone: "success", message: "Cleared what I was holding. Your bill is unchanged." });
      return;
    }

    const parsed = parseUtterance(text, productsRef.current);
    if (parsed.items.length === 0) {
      // Wrong words, filler or noise: keep what was said so it can be edited,
      // but never invent a product from it.
      setTranscript(text);
      setLastHeard(null);
      setLocalError(NO_PRODUCT_MESSAGE);
      return;
    }

    const draftItems: DraftItem[] = parsed.items.map((item) =>
      createDraftItemFromParsed(item, productsRef.current),
    );
    addDraftItemsRef.current(draftItems);
    setTranscript("");
    resetSessionLine();

    const reviewCount = draftItems.filter((item) => item.needsReview).length;
    setLastHeard({ text, itemIds: draftItems.map((item) => item.id) });

    const summary =
      draftItems.length === 1
        ? `1 item added${reviewCount ? " — needs your review" : ""}`
        : `${draftItems.length} items added${reviewCount ? ` — ${reviewCount} need review` : ""}`;

    notifyUndoRef.current(summary, () => {
      draftItems.forEach((item) => removeDraftItemRef.current(item.id));
      setLastHeard(null);
    });

    if (parsed.ignored.length > 0) {
      notifyRef.current({
        tone: "warning",
        message: `Skipped “${parsed.ignored[0]}” — no product found. Add it manually if needed.`,
        duration: 5000,
      });
    }
  }, [resetSessionLine]);

  /** Wait this long after the last heard words before parsing the list. */
  const SETTLE_MS = 1000;

  /** (Re)arm the single pending commit for the running list. */
  const armCommit = useCallback(
    (line: string) => {
      if (processingTimer.current) clearTimeout(processingTimer.current);
      setProcessing(true);
      setSettling(true);
      processingTimer.current = setTimeout(() => {
        setSettling(false);
        setProcessing(false);
        commitText(line);
      }, SETTLE_MS);
    },
    [commitText],
  );

  /** Finalise the running list, whether or not it contained a product. */
  const finishList = useCallback(
    (line: string) => {
      setSettling(false);
      setProcessing(false);
      sessionLineRef.current = null;
      setSessionLine(null);
      if (autoAddRef.current && line.trim()) commitText(line);
    },
    [commitText],
  );

  /**
   * Append one heard chunk to the running list.
   *
   * The settle timer is the "did they stop talking?" signal: every chunk and
   * every interim word re-arms it, so a list spoken with pauses is parsed as
   * one sentence instead of being cut into fragments and guessed twice.
   */
  const queueChunk = useCallback(
    (chunk: string) => {
      const cleaned = cleanTranscript(chunk);
      if (!cleaned) return;
      setLocalError(null);
      setLastHeard(null);

      // A hum, cough or "uh" is not a list: keep listening. If the shopkeeper
      // only hummed, the list ends quietly on "Done" (or once they speak).
      if (isHesitationOnly(cleaned)) {
        if (sessionLineRef.current) armCommit(sessionLineRef.current);
        return;
      }

      const previous = sessionLineRef.current;
      if (!previous && isClearCommand(cleaned)) {
        handleClear();
        return;
      }

      const continuing = Boolean(previous && continuesPrevious(previous, cleaned));
      const merged = previous ? appendToList([previous], cleaned)[0]! : cleaned;
      sessionLineRef.current = merged;
      setSessionLine(merged);
      setTranscript(merged);

      if (!autoAddRef.current) {
        // Manual mode: nothing is parsed until "Add to bill" is pressed.
        setSettling(false);
        setProcessing(false);
        return;
      }

      armCommit(merged);
      if (continuing) {
        notifyRef.current({
          tone: "info",
          message: "Picked up where you paused — adding the rest of the list.",
          duration: 2400,
        });
      }
    },
    [armCommit, handleClear],
  );

  const handleFinal = useCallback(
    (text: string) => {
      queueChunk(text);
    },
    [queueChunk],
  );

  const handleStatusChange = useCallback(
    (next: SpeechStatus) => {
      statusRef.current = next;
      // Microphone off: whatever is pending is final — commit it now so a
      // half-finished list is never lost.
      if (next !== "idle") return;
      const pending = sessionLineRef.current;
      if (!pending) return;
      if (processingTimer.current) clearTimeout(processingTimer.current);
      processingTimer.current = null;
      finishList(pending);
    },
    [finishList],
  );

  const handleSpeechError = useCallback((message: string) => {
    setLocalError(message);
  }, []);

  const {
    supported,
    status,
    listening,
    interim,
    error,
    notice,
    restarts,
    toggle,
    stop,
    clearError,
  } = useSpeechRecognition({
    language,
    onFinalTranscript: handleFinal,
    onError: handleSpeechError,
    onStatusChange: handleStatusChange,
    keepAlive: true,
  });

  statusRef.current = status;
  const sessionLive = status === "listening" || status === "connecting" || status === "recovering";

  // Interim words are a "still talking" signal: keep the list open so a pause
  // between two items does not split them into separate, guessed batches.
  useEffect(() => {
    if (!interim || !autoAdd) return;
    const pending = sessionLineRef.current;
    if (!pending) return;
    if (processingTimer.current) clearTimeout(processingTimer.current);
    processingTimer.current = setTimeout(() => {
      const line = sessionLineRef.current;
      if (!line) return;
      finishList(line);
    }, SETTLE_MS);
  }, [interim, autoAdd, finishList]);

  const preview = useMemo(() => {
    const text = cleanTranscript(transcript);
    if (!text) return null;
    const parsed = parseUtterance(text, products);
    if (parsed.items.length === 0) return { empty: true as const, noise: parsed.noise, ignored: parsed.ignored };
    const items = parsed.items.map((item) => createDraftItemFromParsed(item, products));
    return {
      empty: false as const,
      items,
      ignored: parsed.ignored,
      noise: parsed.noise,
    };
  }, [transcript, products]);

  const handleAddManual = () => {
    if (!transcript.trim()) return;
    commitText(transcript);
  };

  /**
   * "Done" — stop listening but never lose the list. Whatever is pending is
   * parsed immediately; noise-only input produces no line at all.
   */
  const handleDone = useCallback(() => {
    if (processingTimer.current) clearTimeout(processingTimer.current);
    processingTimer.current = null;
    finishList(sessionLineRef.current ?? "");
    stop();
  }, [finishList, stop]);

  const handleLanguage = (next: RecognitionLanguage) => {
    setLanguage(next);
    updateSettings({ language: next });
    clearError();
  };

  const handleAutoAdd = () => {
    const next = !autoAdd;
    setAutoAdd(next);
    updateSettings({ autoAddVoice: next });
  };

  const showUnsupported = !supported;
  const activeError = localError ?? error;
  const heardItems = lastHeard
    ? lastHeard.itemIds
        .map((id) => draft.items.find((item) => item.id === id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];

  return (
    <section className="vb-card min-w-0 overflow-hidden" aria-labelledby="voice-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-gradient-to-b from-brand-tint/80 to-surface px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand">
            <AudioLines className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="vb-caps text-brand">Voice billing</p>
            <h2 id="voice-heading" className="font-display text-[19px] leading-tight tracking-[-0.01em]">
              Speak your bill
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            ariaLabel="Recognition language"
            value={language}
            onChange={handleLanguage}
            options={[
              { value: "hi-IN", label: "हिंदी" },
              { value: "en-IN", label: "English" },
            ]}
          />
          <button
            type="button"
            onClick={handleAutoAdd}
            aria-pressed={autoAdd}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-full border px-2.5 text-[11px] font-semibold transition-colors",
              autoAdd
                ? "border-brand/20 bg-brand-soft text-brand-strong"
                : "border-line bg-surface text-ink-faint",
            )}
            title="Add spoken items to the bill automatically"
          >
            <span
              className={cn(
                "relative h-3.5 w-6 rounded-full transition-colors",
                autoAdd ? "bg-brand" : "bg-line-strong",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all",
                  autoAdd ? "left-3" : "left-0.5",
                )}
              />
            </span>
            Auto-add
          </button>
        </div>
      </div>

      <div className="px-4 pb-5 pt-6 sm:px-6 sm:pb-6">
        <p className="mb-4 flex items-start gap-1.5 rounded-xl border border-line bg-surface-soft/60 px-3 py-2 text-left text-[11.5px] leading-relaxed text-ink-faint">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Hums, “huh”, “umm” and shop chatter are ignored — only grocery items are added. Pause as long as you
            like; the mic stays open until you tap <span className="font-semibold text-ink-soft">Done</span>.
          </span>
        </p>
        <div className="flex flex-col items-center text-center">
          <div className="relative flex h-[128px] w-[128px] items-center justify-center sm:h-[140px] sm:w-[140px]">
            {listening ? (
              <>
                <span className="pulse-ring absolute inset-0 rounded-full bg-brand/12" aria-hidden="true" />
                <span
                  className="pulse-ring absolute inset-2 rounded-full bg-brand/10"
                  style={{ animationDelay: "700ms" }}
                  aria-hidden="true"
                />
              </>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (showUnsupported) {
                  notify({
                    tone: "warning",
                    message:
                      "This browser doesn’t support voice input. Type the items below — everything else works.",
                  });
                  return;
                }
                toggle();
              }}
              aria-pressed={listening}
              aria-label={listening ? "Stop listening" : "Start voice input"}
              className={cn(
                "relative z-10 flex h-[104px] w-[104px] items-center justify-center rounded-full text-white transition-all duration-200 sm:h-[116px] sm:w-[116px]",
                listening
                  ? "bg-brand-strong shadow-[0_18px_40px_-14px_rgba(18,80,58,0.7)] ring-[6px] ring-brand/15"
                  : "bg-brand shadow-[var(--shadow-mic)] hover:scale-[1.02] hover:bg-brand-strong active:scale-[0.98]",
                showUnsupported && "cursor-not-allowed bg-line-strong text-ink-faint shadow-none hover:scale-100 hover:bg-line-strong",
              )}
            >
              {listening ? (
                <CircleStop className="h-10 w-10" aria-hidden="true" />
              ) : (
                <Mic className="h-11 w-11" aria-hidden="true" />
              )}
            </button>
          </div>

          <div className="mt-4 min-h-[44px]" aria-live="polite">
            {showUnsupported ? (
              <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-ink-soft">
                Voice input isn’t available in this browser.{" "}
                <span className="font-semibold text-ink">Type your items below</span> — matching, totals and
                printing all work the same.
              </p>
            ) : listening ? (
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-2 text-brand-strong">
                  <span className="flex items-end gap-[3px]" aria-hidden="true">
                    {[0, 1, 2, 3].map((bar) => (
                      <span
                        key={bar}
                        className="sound-bar block w-[3px] rounded-full bg-brand"
                        style={{ height: 12 + (bar % 2) * 7, animationDelay: `${bar * 120}ms` }}
                      />
                    ))}
                  </span>
                  <span className="text-[14px] font-semibold">Listening — the mic stays open</span>
                </div>
                <p className="text-[12.5px] text-ink-faint">
                  Speak the list, pause to think, then carry on. Everything except groceries is ignored.
                </p>
              </div>
            ) : sessionLive ? (
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-2 text-amber">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-amber" aria-hidden="true" />
                  <span className="text-[14px] font-semibold">
                    {status === "recovering" ? "Reconnecting…" : "Still listening — one moment"}
                  </span>
                </div>
                <p className="text-[12.5px] text-ink-faint">
                  Keep talking; your words are kept and added when the mic is back.
                </p>
              </div>
            ) : settling ? (
              <div className="flex items-center justify-center gap-2 text-[13.5px] font-medium text-ink-soft">
                <Sparkles className="h-4 w-4 animate-pulse text-brand" aria-hidden="true" />
                Wait — reading your list…
              </div>
            ) : processing ? (
              <div className="flex items-center justify-center gap-2 text-[13.5px] font-medium text-ink-soft">
                <Sparkles className="h-4 w-4 animate-pulse text-brand" aria-hidden="true" />
                Reading your items…
              </div>
            ) : (
              <div>
                <p className="text-[13.5px] font-medium text-ink-soft">
                  Tap the mic and speak naturally
                </p>
                <p className="mt-0.5 text-[12px] text-ink-faint">
                  “3 kilo chini aur 2 kilo aata” · “5 packet Maggi”
                </p>
              </div>
            )}
          </div>

          {interim ? (
            <div className="mt-3 w-full rounded-xl border border-dashed border-brand/25 bg-brand-tint/70 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">Hearing</p>
              <p className="mt-0.5 text-[14px] leading-snug text-ink" aria-live="polite">
                {interim}
              </p>
            </div>
          ) : null}

          {listening || sessionLive ? (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={handleDone}
              leadingIcon={<CircleStop className="h-4 w-4" aria-hidden="true" />}
            >
              Done — save this list
            </Button>
          ) : null}
        </div>

        {notice && !activeError ? (
          <div
            role="status"
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-brand/20 bg-brand-tint px-3 py-2.5 text-left text-[12.5px] leading-relaxed text-brand-strong"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="flex-1">{notice}</p>
          </div>
        ) : null}

        {activeError ? (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber/30 bg-amber-soft px-3 py-2.5 text-left text-[12.5px] leading-relaxed text-amber"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="flex-1">{activeError}</p>
            <button
              type="button"
              onClick={() => {
                setLocalError(null);
                clearError();
              }}
              className="shrink-0 rounded px-1 text-[11px] font-semibold underline decoration-amber/40 underline-offset-2"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {sessionLine && sessionLive && settling ? (
          <div className="mt-4 rounded-xl border border-brand/15 bg-brand-tint px-3 py-2.5 text-left">
            <div className="flex items-center gap-1.5">
              <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-brand" aria-hidden="true" />
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-strong">
                Your list so far
              </p>
              <p className="truncate text-[11.5px] text-ink-faint">
                {restarts > 0 ? "resumed after a pause" : "say “clear” to start this list again"}
              </p>
            </div>
            <p className="mt-1 text-[13px] leading-snug text-ink">{sessionLine}</p>
          </div>
        ) : null}

        {lastHeard && heardItems.length > 0 ? (
          <div className="mt-4 rounded-xl border border-brand/15 bg-brand-tint px-3 py-2.5 text-left">
            <div className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-strong">
                Heard
              </p>
              <p className="truncate text-[11.5px] text-ink-faint">“{lastHeard.text}”</p>
            </div>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {heardItems.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11.5px] font-medium",
                    item.needsReview
                      ? "border-amber/25 bg-amber-soft text-amber"
                      : "border-brand/15 bg-white text-brand-strong",
                  )}
                >
                  {item.name} · {formatQuantity(item.quantity)} {UNIT_LABEL[item.unit]}
                  {item.needsReview ? " · check" : ""}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] text-ink-faint">
              Added to the bill below. Edit any line there.
            </p>
          </div>
        ) : null}

        <div className="mt-5 rounded-2xl border border-line bg-surface-soft/70 p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <label htmlFor="bill-text" className="vb-label mb-0">
              {transcript ? "Your words — edit before adding" : "Or type your bill"}
            </label>
            {transcript ? (
              <button
                type="button"
                onClick={() => setTranscript("")}
                className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-ink-faint hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Clear
              </button>
            ) : null}
          </div>
          <textarea
            id="bill-text"
            value={transcript}
            onChange={(event) => {
              setTranscript(event.target.value);
              setLocalError(null);
            }}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                handleAddManual();
              }
            }}
            rows={2}
            placeholder="e.g. 3 kilo chini aur 2 kilo aata"
            className="vb-input min-h-[64px] resize-none bg-white text-[15px] leading-relaxed"
          />

          {preview && !preview.empty ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-faint">
                <Wand2 className="h-3 w-3" aria-hidden="true" />
                Will add
              </span>
              {preview.items.map((item) => (
                <span
                  key={item.id}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11.5px] font-medium",
                    item.needsReview
                      ? "border-amber/25 bg-amber-soft text-amber"
                      : "border-brand/15 bg-brand-soft text-brand-strong",
                  )}
                >
                  {item.name} · {formatQuantity(item.quantity)} {UNIT_LABEL[item.unit]}
                </span>
              ))}
            </div>
          ) : null}

          {preview && preview.empty ? (
            <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-ink-faint">
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
              {preview.noise.length > 0 && preview.ignored.length === 0
                ? "That sounded like filler words — say a product name, like “2 kilo chini”."
                : "Add a quantity (like “2 kilo”) and a product name."}
            </p>
          ) : null}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.slice(0, language === "hi-IN" ? 3 : 4).map((example) => (
                <button
                  key={example.text}
                  type="button"
                  onClick={() => {
                    setTranscript(example.text);
                    setLocalError(null);
                  }}
                  className="max-w-full truncate rounded-full border border-line bg-white px-2.5 py-1 text-[11.5px] font-medium text-ink-soft transition-colors hover:border-brand/30 hover:text-brand-strong"
                  lang={example.lang === "hi-IN" ? "hi" : "en"}
                >
                  {example.label}
                </button>
              ))}
            </div>
            <Button
              onClick={handleAddManual}
              disabled={!transcript.trim() || listening || processing}
              leadingIcon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
              className="shrink-0"
            >
              Add to bill
            </Button>
          </div>
        </div>

        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-faint">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Speech recognition is done by your browser. Hinglish is not perfect — check the items before billing.
          Nothing is uploaded by VoiceBill.
        </p>
      </div>
    </section>
  );
}
