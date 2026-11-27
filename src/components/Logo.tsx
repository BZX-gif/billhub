import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-[11px] bg-brand text-white shadow-[0_8px_18px_-10px_rgba(18,80,58,0.9)]",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3Z" />
        <path d="M6.5 10.5v1a5.5 5.5 0 0 0 11 0v-1" />
        <path d="M12 17v3" />
        <path d="M9 20.5h6" />
      </svg>
      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-[1.5px] border-brand bg-[#d9b45b]" />
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-[20px] font-semibold leading-none tracking-[-0.02em] text-ink", className)}>
      Voice<span className="text-brand">Bill</span>
    </span>
  );
}

export function BrandLockup({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      {compact ? (
        <Wordmark />
      ) : (
        <span className="flex flex-col gap-0.5">
          <Wordmark />
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-faint">
            Speak. Review. Bill.
          </span>
        </span>
      )}
    </span>
  );
}
