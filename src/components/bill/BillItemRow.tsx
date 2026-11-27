"use client";

import { AlertTriangle, Check, ChevronRight, Trash2 } from "lucide-react";
import { QuantityStepper } from "./QuantityStepper";
import { PriceInput } from "./PriceInput";
import { useApp } from "@/store/AppProvider";
import { computeLineAmount } from "@/lib/billing";
import { formatMoney } from "@/lib/units";
import { UNIT_LABEL, type DraftItem } from "@/lib/types";
import { cn } from "@/lib/cn";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function BillItemRow({
  item,
  index,
  onChooseProduct,
}: {
  item: DraftItem;
  index: number;
  onChooseProduct: (item: DraftItem) => void;
}) {
  const { updateDraftItem, removeDraftItem, resolveDraftItem, products, settings } = useApp();
  const symbol = settings.currencySymbol;
  const amount = computeLineAmount(item.quantity, item.unitPrice);
  const missingPrice = !(item.unitPrice > 0);
  const alternatives = item.alternatives
    .map((alt) => products.find((product) => product.id === alt.productId))
    .filter((product): product is NonNullable<typeof product> => Boolean(product))
    .slice(0, 2);

  return (
    <li className="animate-fade-up rounded-2xl border border-line bg-surface px-3 py-3 shadow-[0_1px_0_rgba(36,31,23,0.02)] sm:px-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-canvas text-[12px] font-bold text-ink-soft">
          {initials(item.name) || index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate text-[14.5px] font-semibold leading-tight text-ink">{item.name}</span>
                {item.matchStatus === "unmatched" ? (
                  <span className="rounded-full border border-danger/20 bg-danger-soft px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-danger">
                    No match
                  </span>
                ) : null}
                {item.matchStatus === "ambiguous" ? (
                  <span className="rounded-full border border-amber/25 bg-amber-soft px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-amber">
                    Confirm
                  </span>
                ) : null}
                {item.matchStatus === "custom" ? (
                  <span className="rounded-full border border-line bg-canvas px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-ink-faint">
                    Custom
                  </span>
                ) : null}
                {item.source === "voice" ? (
                  <span className="text-[10px] font-medium text-ink-faint">via voice</span>
                ) : null}
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-faint">
                {missingPrice ? (
                  <span className="font-semibold text-danger">Price missing</span>
                ) : (
                  <span className="tabular-nums">
                    {formatMoney(item.unitPrice, symbol)} per {UNIT_LABEL[item.unit]}
                  </span>
                )}
                {item.notice ? <span> · {item.notice}</span> : null}
              </p>
            </div>
            <p className="shrink-0 font-display text-[18px] font-semibold leading-tight tabular-nums text-ink">
              {formatMoney(amount, symbol)}
            </p>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <QuantityStepper
              quantity={item.quantity}
              unit={item.unit}
              label={item.name}
              onChange={(quantity) => updateDraftItem(item.id, { quantity })}
            />
            <span className="rounded-lg bg-canvas px-2 py-1.5 text-[11px] font-semibold tracking-wide text-ink-soft">
              {UNIT_LABEL[item.unit]}
            </span>
            <PriceInput
              value={item.unitPrice}
              symbol={symbol}
              label={`Price per ${item.unit} for ${item.name}`}
              onChange={(unitPrice) => updateDraftItem(item.id, { unitPrice })}
            />
            <button
              type="button"
              onClick={() => onChooseProduct(item)}
              className="ml-auto inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold text-brand-strong transition-colors hover:bg-brand-soft"
            >
              Change
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => removeDraftItem(item.id)}
              aria-label={`Remove ${item.name} from bill`}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {item.needsReview || missingPrice ? (
        <div
          className={cn(
            "mt-3 rounded-xl border px-3 py-2.5 text-left",
            missingPrice
              ? "border-amber/25 bg-amber-soft/70"
              : "border-amber/25 bg-amber-soft/70",
          )}
        >
          <p className="flex items-start gap-1.5 text-[12px] font-medium leading-relaxed text-amber">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {missingPrice && !item.needsReview
                ? "Set a price per unit, or choose a product from your catalogue."
                : item.reviewReason ?? "Check this line before saving the bill."}
            </span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {alternatives.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => resolveDraftItem(item.id, product.id)}
                className="inline-flex items-center gap-1 rounded-full border border-amber/30 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand-strong"
              >
                <Check className="h-3 w-3 text-brand" aria-hidden="true" />
                {product.name} · {formatMoney(product.price, symbol)}/{UNIT_LABEL[product.unit]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onChooseProduct(item)}
              className="inline-flex items-center gap-1 rounded-full border border-transparent bg-amber/10 px-2.5 py-1 text-[11.5px] font-semibold text-amber transition-colors hover:bg-amber/15"
            >
              {item.matchStatus === "unmatched" ? "Choose product or add custom" : "Fix this line"}
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
