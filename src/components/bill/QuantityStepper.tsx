"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { Unit } from "@/lib/types";
import { formatQuantity } from "@/lib/units";
import { cn } from "@/lib/cn";

function stepForUnit(unit: Unit): number {
  if (unit === "gram" || unit === "ml") return 50;
  if (unit === "kg" || unit === "litre") return 0.5;
  return 1;
}

export function QuantityStepper({
  quantity,
  unit,
  label,
  onChange,
  min = 0.001,
  className,
}: {
  quantity: number;
  unit: Unit;
  label: string;
  onChange: (value: number) => void;
  min?: number;
  className?: string;
}) {
  const [draft, setDraft] = useState(() => formatQuantity(quantity));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(formatQuantity(quantity));
  }, [quantity, focused]);

  const step = stepForUnit(unit);

  const commit = (value: number) => {
    const safe = Number.isFinite(value) ? Math.max(min, Math.round(value * 1000) / 1000) : min;
    onChange(safe);
    setDraft(formatQuantity(safe));
  };

  return (
    <div
      className={cn(
        "inline-flex h-9 items-stretch overflow-hidden rounded-lg border border-line bg-white",
        className,
      )}
    >
      <button
        type="button"
        aria-label={`Decrease quantity of ${label}`}
        onClick={() => commit(quantity - step)}
        className="flex w-9 items-center justify-center text-ink-soft transition-colors hover:bg-surface-soft active:bg-canvas"
      >
        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <input
        aria-label={`Quantity of ${label}`}
        inputMode="decimal"
        value={draft}
        onFocus={(event) => {
          setFocused(true);
          event.currentTarget.select();
        }}
        onChange={(event) => setDraft(event.target.value.replace(/[^0-9.]/g, ""))}
        onBlur={() => {
          setFocused(false);
          const parsed = Number.parseFloat(draft);
          commit(Number.isFinite(parsed) ? parsed : quantity);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
        className="w-11 border-x border-line bg-white text-center text-[13.5px] font-semibold tabular-nums text-ink outline-none focus:bg-brand-tint"
      />
      <button
        type="button"
        aria-label={`Increase quantity of ${label}`}
        onClick={() => commit(quantity + step)}
        className="flex w-9 items-center justify-center text-ink-soft transition-colors hover:bg-surface-soft active:bg-canvas"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
