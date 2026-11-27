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
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
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

    const parsed = parseUtterance(text);
    if (parsed.items.length === 0) {
      setTranscript(text);
      setLocalError(
        "I couldn’t find a product in that. Try “3 kilo chini” or “2 packet Maggi”.",
      );
      return;
    }

    const draftItems: DraftItem[] = parsed.items.map((item) =>
      createDraftItemFromParsed(item, productsRef.current),
    );
    addDraftItemsRef.current(draftItems);
    setTranscript("");

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
  }, []);

  const handleFinal = useCallback(
    (text: string) => {
      const cleaned = cleanTranscript(text);
      if (!cleaned) return;
      setLocalError(null);
      setLastHeard(null);
      if (!autoAddRef.current) {
        setTranscript((current) => (current ? `${current} ${cleaned}` : cleaned));
        return;
      }
      setProcessing(true);
      if (processingTimer.current) clearTimeout(processingTimer.current);
      processingTimer.current = setTimeout(() => {
        commitText(cleaned);
        setProcessing(false);
      }, 280);
    },
    [commitText],
  );

  const handleSpeechError = useCallback((message: string) => {
    setLocalError(message);
  }, []);

  const { supported, listening, interim, error, toggle, stop, clearError } = useSpeechRecognition({
    language,
    onFinalTranscript: handleFinal,
    onError: handleSpeechError,
  });

  const preview = useMemo(() => {
    const text = cleanTranscript(transcript);
    if (!text) return null;
    const parsed = parseUtterance(text);
    if (parsed.items.length === 0) return { empty: true as const };
    const items = parsed.items.map((item) => createDraftItemFromParsed(item, products));
    return {
      empty: false as const,
      items,
      ignored: parsed.ignored,
    };
  }, [transcript, products]);

  const handleAddManual = () => {
    if (!transcript.trim()) return;
    commitText(transcript);
  };

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
                  <span className="text-[14px] font-semibold">Listening…</span>
                </div>
                <p className="text-[12.5px] text-ink-faint">Speak the items, then tap stop. Tap again to add more.</p>
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

          {listening ? (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={stop}
              leadingIcon={<CircleStop className="h-4 w-4" aria-hidden="true" />}
            >
              Stop listening
            </Button>
          ) : null}
        </div>

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
              Add a quantity (like “2 kilo”) and a product name.
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
