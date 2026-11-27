import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "brand" | "amber" | "danger" | "outline";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-canvas text-ink-soft border-line",
  brand: "bg-brand-soft text-brand-strong border-brand/15",
  amber: "bg-amber-soft text-amber border-amber/20",
  danger: "bg-danger-soft text-danger border-danger/20",
  outline: "bg-transparent text-ink-faint border-line-strong",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-5 tracking-[0.02em]",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
