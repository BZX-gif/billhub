import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="vb-caps mb-1.5 text-brand">{eyebrow}</p>
        ) : null}
        <h1 className="font-display text-[clamp(1.7rem,4.5vw,2.15rem)] font-medium leading-[1.1] tracking-[-0.025em] text-ink">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-ink-soft">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
