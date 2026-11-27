"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, Mic, ReceiptText, Search, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ReceiptDialog } from "@/components/receipt/ReceiptDialog";
import { useApp } from "@/store/AppProvider";
import { formatMoney, formatMoneyShort } from "@/lib/units";
import { dayKeyRange, formatTime, isDayKeyInRange, localDayKey, relativeDayLabel } from "@/lib/format";
import { normalizeText } from "@/lib/text";
import type { Bill } from "@/lib/types";
import { cn } from "@/lib/cn";

type Preset = "all" | "today" | "7d" | "custom";

const PRESETS: Array<{ value: Preset; label: string }> = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "custom", label: "Custom" },
];

export default function HistoryPage() {
  const { bills, settings, deleteBill } = useApp();
  const { notify } = useToast();
  const [query, setQuery] = useState("");
  const [preset, setPreset] = useState<Preset>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [receiptBill, setReceiptBill] = useState<Bill | null>(null);
  const [deleting, setDeleting] = useState<Bill | null>(null);
  const symbol = settings.currencySymbol;

  const range = useMemo(() => {
    if (preset === "all") return { from: "", to: "" };
    if (preset === "custom") return { from, to };
    return dayKeyRange(preset);
  }, [preset, from, to]);

  const filtered = useMemo(() => {
    const normalized = normalizeText(query);
    return bills.filter((bill) => {
      if (range.from || range.to) {
        if (!isDayKeyInRange(bill.createdAt, range.from, range.to)) return false;
      }
      if (!normalized) return true;
      const haystack = normalizeText(
        [
          bill.number,
          bill.customerName ?? "",
          ...bill.items.map((item) => item.name),
        ].join(" "),
      );
      return haystack.includes(normalized) || bill.number.toLowerCase().includes(query.toLowerCase());
    });
  }, [bills, query, range]);

  const filteredTotal = filtered.reduce((sum, bill) => sum + bill.total, 0);

  const groups = useMemo(() => {
    const map = new Map<string, Bill[]>();
    for (const bill of filtered) {
      const key = localDayKey(bill.createdAt);
      const list = map.get(key) ?? [];
      list.push(bill);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const hasFilters = preset !== "all" || Boolean(query) || Boolean(from) || Boolean(to);

  const resetFilters = () => {
    setQuery("");
    setPreset("all");
    setFrom("");
    setTo("");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Saved on this device"
        title="Bill history"
        description="Every saved bill is here — search it, open the receipt and reprint it. Bills are stored in this browser."
        actions={
          <Link href="/new-bill">
            <Button leadingIcon={<Mic className="h-4 w-4" aria-hidden="true" />}>New bill</Button>
          </Link>
        }
      />

      <section className="vb-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
                aria-hidden="true"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search bill no., customer or item…"
                aria-label="Search bills"
                className="vb-input h-10 pl-9 pr-9"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-faint hover:bg-canvas hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <div
              role="group"
              aria-label="Filter by date"
              className="inline-flex w-full items-center gap-0.5 rounded-full border border-line bg-surface p-0.5 sm:w-auto"
            >
              {PRESETS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={preset === option.value}
                  onClick={() => setPreset(option.value)}
                  className={cn(
                    "h-8 flex-1 rounded-full px-3 text-[11.5px] font-semibold transition-colors sm:flex-none",
                    preset === option.value
                      ? "bg-brand text-white"
                      : "text-ink-soft hover:bg-surface-soft hover:text-ink",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {preset === "custom" ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-faint">From</span>
                <input
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  max={to || undefined}
                  className="vb-input h-9 w-[150px] py-0 text-[12.5px]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-faint">To</span>
                <input
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  min={from || undefined}
                  className="vb-input h-9 w-[150px] py-0 text-[12.5px]"
                />
              </label>
              {from || to ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFrom("");
                    setTo("");
                  }}
                >
                  Clear dates
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-soft/70 px-4 py-2.5 text-[11.5px] sm:px-5">
          <p className="font-medium text-ink-soft">
            <span className="font-semibold text-ink">{filtered.length}</span> bill
            {filtered.length === 1 ? "" : "s"} · {formatMoney(filteredTotal, symbol)}
          </p>
          {hasFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="font-semibold text-brand-strong hover:underline"
            >
              Clear filters
            </button>
          ) : (
            <p className="text-ink-faint">Showing all saved bills</p>
          )}
        </div>

        {bills.length === 0 ? (
          <div className="p-3 sm:p-4">
            <EmptyState
              icon={<ReceiptText className="h-5 w-5" aria-hidden="true" />}
              title="No saved bills yet"
              description="Save your first bill and it will appear here with a printable receipt you can reopen anytime."
              action={
                <Link href="/new-bill">
                  <Button leadingIcon={<Mic className="h-4 w-4" aria-hidden="true" />}>Create a bill</Button>
                </Link>
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-3 sm:p-4">
            <EmptyState
              compact
              icon={<Search className="h-5 w-5" aria-hidden="true" />}
              title="No bills match these filters"
              description="Try a different date range or search term."
              action={
                <Button variant="secondary" size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              }
            />
          </div>
        ) : (
          <div>
            {groups.map(([dayKey, dayBills]) => (
              <div key={dayKey}>
                <div className="flex items-center justify-between gap-2 border-b border-line bg-canvas/60 px-4 py-2 sm:px-5">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-faint">
                    <CalendarDays className="h-3 w-3" aria-hidden="true" />
                    {relativeDayLabel(dayBills[0]!.createdAt)}
                  </p>
                  <p className="text-[11px] font-semibold tabular-nums text-ink-soft">
                    {formatMoneyShort(
                      dayBills.reduce((sum, bill) => sum + bill.total, 0),
                      symbol,
                    )}
                  </p>
                </div>
                <ul className="divide-y divide-line">
                  {dayBills.map((bill) => (
                    <li key={bill.id} className="flex items-center">
                      <button
                        type="button"
                        onClick={() => setReceiptBill(bill)}
                        className="group flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-soft sm:px-5"
                        aria-label={`Open receipt ${bill.number}`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                          <ReceiptText className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="text-[13.5px] font-semibold text-ink">{bill.number}</span>
                            <span className="text-[11px] text-ink-faint">{formatTime(bill.createdAt)}</span>
                            {bill.customerName ? (
                              <span className="truncate text-[11px] font-medium text-ink-soft">
                                · {bill.customerName}
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block truncate text-[11.5px] text-ink-faint">
                            {bill.itemCount} item{bill.itemCount === 1 ? "" : "s"} ·{" "}
                            {bill.items.map((item) => item.name).join(", ")}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-[13.5px] font-semibold tabular-nums text-ink">
                            {formatMoneyShort(bill.total, symbol)}
                          </span>
                          <span className="block text-[10px] text-ink-faint">
                            {bill.discountAmount > 0 ? `−${formatMoneyShort(bill.discountAmount, symbol)}` : "View"}
                          </span>
                        </span>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(bill)}
                        aria-label={`Delete bill ${bill.number}`}
                        className="mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger sm:mr-4"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-center text-[11px] leading-relaxed text-ink-faint">
        Bill numbers are never reused. Deleting a bill removes it from this device only.
      </p>

      <ReceiptDialog open={Boolean(receiptBill)} bill={receiptBill} onClose={() => setReceiptBill(null)} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          deleteBill(deleting.id);
          notify({ tone: "info", message: `Bill ${deleting.number} deleted.` });
        }}
        title={`Delete bill ${deleting?.number ?? ""}?`}
        description="This permanently removes the bill and its receipt from this browser. It cannot be undone."
        confirmLabel="Delete bill"
        destructive
      />
    </div>
  );
}
