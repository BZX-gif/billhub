"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Info, ShieldCheck, Trash2 } from "lucide-react";
import { useApp } from "@/store/AppProvider";
import { formatMoney } from "@/lib/units";
import { Segmented } from "@/components/ui/Segmented";
import { Button } from "@/components/ui/Button";
import type { DiscountType } from "@/lib/types";
import { cn } from "@/lib/cn";
import { formatDate, localDayKey } from "@/lib/format";
import { billTimestamp } from "@/lib/gst";

export function BillSummary({
  onReview,
  onClear,
}: {
  onReview: () => void;
  onClear: () => void;
}) {
  const {
    draft,
    draftTotals,
    draftValidation,
    settings,
    setDraftDiscount,
    setDraftCustomer,
    setDraftBillDate,
  } = useApp();
  const symbol = settings.currencySymbol;
  const [discountText, setDiscountText] = useState(
    draft.discountValue > 0 ? String(draft.discountValue) : "",
  );
  const [discountFocused, setDiscountFocused] = useState(false);

  useEffect(() => {
    if (!discountFocused) {
      setDiscountText(draft.discountValue > 0 ? String(draft.discountValue) : "");
    }
  }, [draft.discountValue, discountFocused]);

  const itemCount = draft.items.length;
  const todayKey = localDayKey(new Date());
  const billDateValue = draft.billDate || todayKey;
  // Mirrors exactly what will be printed on the invoice.
  const printedDate = formatDate(billTimestamp(draft.billDate));
  const backDated = Boolean(draft.billDate) && draft.billDate !== todayKey;
  const issues = draftValidation.issues;
  const uniqueIssues = [...new Set(issues.map((issue) => issue.message))].slice(0, 2);

  return (
    <aside className="vb-card min-w-0 p-4 sm:p-5 lg:sticky lg:top-6" aria-labelledby="summary-heading">
      <div className="flex items-center justify-between gap-2">
        <h2 id="summary-heading" className="font-display text-[20px] leading-none tracking-[-0.01em]">
          Bill summary
        </h2>
        <span className="rounded-full border border-line bg-canvas px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
      </div>

      <dl className="mt-4 space-y-2">
        <div className="flex items-baseline justify-between text-[13.5px]">
          <dt className="text-ink-soft">Subtotal</dt>
          <dd className="font-semibold tabular-nums text-ink">{formatMoney(draftTotals.subtotal, symbol)}</dd>
        </div>
        {draftTotals.discountAmount > 0 ? (
          <div className="flex items-baseline justify-between text-[13.5px]">
            <dt className="text-ink-soft">
              Discount{draft.discountType === "percent" ? ` (${draft.discountValue}%)` : ""}
            </dt>
            <dd className="font-semibold tabular-nums text-brand-strong">
              − {formatMoney(draftTotals.discountAmount, symbol)}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-3 flex items-end justify-between border-t border-dashed border-line pt-3">
        <span className="vb-caps">To pay</span>
        <span className="font-display text-[30px] font-semibold leading-none tabular-nums text-ink">
          {formatMoney(draftTotals.total, symbol)}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="discount" className="vb-label mb-0">
              Discount
            </label>
            <Segmented
              size="sm"
              ariaLabel="Discount type"
              value={draft.discountType}
              onChange={(type: DiscountType) => setDraftDiscount(type, draft.discountValue)}
              options={[
                { value: "amount", label: symbol.trim() || "₹" },
                { value: "percent", label: "%" },
              ]}
            />
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-medium text-ink-faint">
              {draft.discountType === "percent" ? "%" : symbol}
            </span>
            <input
              id="discount"
              inputMode="decimal"
              value={discountText}
              placeholder="0"
              onChange={(event) => {
                const cleaned = event.target.value.replace(/[^0-9.]/g, "");
                setDiscountText(cleaned);
                const parsed = Number.parseFloat(cleaned);
                setDraftDiscount(draft.discountType, Number.isFinite(parsed) ? parsed : 0);
              }}
              onFocus={() => setDiscountFocused(true)}
              onBlur={() => setDiscountFocused(false)}
              className="vb-input h-10 pl-8 tabular-nums"
            />
          </div>
        </div>

        <div>
          <label htmlFor="customer" className="vb-label">
            Customer name <span className="font-normal normal-case tracking-normal">(optional)</span>
          </label>
          <input
            id="customer"
            value={draft.customerName}
            onChange={(event) => setDraftCustomer(event.target.value)}
            placeholder="Walk-in customer"
            maxLength={80}
            className="vb-input h-10"
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="bill-date" className="vb-label">
            Bill date
          </label>
          <input
            id="bill-date"
            type="date"
            value={billDateValue}
            max={todayKey}
            onChange={(event) => setDraftBillDate(event.target.value)}
            className="vb-input h-10 tabular-nums"
          />
          <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
            {backDated ? (
              <span className="font-medium text-amber">
                Back-dated — the printed invoice will say {printedDate}.
              </span>
            ) : (
              <>Prints on the receipt as {printedDate}.</>
            )}
          </p>
        </div>
      </div>

      {uniqueIssues.length > 0 && itemCount > 0 ? (
        <div className="mt-4 rounded-xl border border-amber/25 bg-amber-soft px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-amber">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            {issues.length} thing{issues.length === 1 ? "" : "s"} to check
          </p>
          <ul className="mt-1 space-y-0.5 text-[12px] leading-relaxed text-amber">
            {uniqueIssues.map((issue) => (
              <li key={issue}>· {issue}</li>
            ))}
            {issues.length > uniqueIssues.length ? <li>· and more…</li> : null}
          </ul>
        </div>
      ) : null}

      {itemCount === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line-strong bg-surface-soft px-3 py-2.5 text-center text-[12px] leading-relaxed text-ink-faint">
          Add at least one item to review and save the bill.
        </p>
      ) : null}

      <Button
        fullWidth
        size="lg"
        className="mt-3"
        onClick={onReview}
        disabled={!draftValidation.canFinalize}
        trailingIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
      >
        Review &amp; save bill
      </Button>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-[10.5px] leading-snug text-ink-faint">
          <ShieldCheck className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
          Draft auto-saved on this device
        </p>
        <button
          type="button"
          onClick={onClear}
          disabled={itemCount === 0}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-semibold transition-colors",
            itemCount === 0
              ? "cursor-not-allowed text-ink-faint/50"
              : "text-ink-faint hover:bg-danger-soft hover:text-danger",
          )}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Clear
        </button>
      </div>
    </aside>
  );
}
