"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/units";
import { cn } from "@/lib/cn";

export function PriceInput({
  value,
  symbol = "₹",
  label,
  onChange,
  className,
}: {
  value: number;
  symbol?: string;
  label: string;
  onChange: (value: number) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(() => (value > 0 ? String(value) : ""));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value > 0 ? String(value) : "");
  }, [value, focused]);

  const commit = () => {
    const parsed = Number.parseFloat(draft);
    const next = Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : 0;
    onChange(next);
    setDraft(next > 0 ? String(next) : "");
  };

  return (
    <div className={cn("relative", className)}>
      <span
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] font-medium text-ink-faint"
        aria-hidden="true"
      >
        {symbol}
      </span>
      <input
        aria-label={label}
        inputMode="decimal"
        value={draft}
        placeholder={formatMoney(0, "").replace("0.00", "0")}
        onFocus={(event) => {
          setFocused(true);
          event.currentTarget.select();
        }}
        onChange={(event) => setDraft(event.target.value.replace(/[^0-9.]/g, ""))}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
        className="h-9 w-[86px] rounded-lg border border-line bg-white pl-6 pr-2 text-right text-[13.5px] font-semibold tabular-nums text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/10"
      />
    </div>
  );
}
