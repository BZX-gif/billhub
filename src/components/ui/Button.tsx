"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white shadow-[0_1px_0_rgba(255,255,255,0.16)_inset,0_8px_18px_-12px_rgba(18,80,58,0.8)] hover:bg-brand-strong active:bg-brand-strong",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-surface-soft active:bg-canvas",
  ghost: "text-ink-soft hover:bg-surface-soft hover:text-ink active:bg-canvas",
  danger:
    "bg-danger-soft text-danger border border-danger/25 hover:border-danger/40 hover:bg-danger/10",
  soft: "bg-brand-soft text-brand-strong hover:bg-brand-tint active:bg-brand-soft",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-11 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-[15px] gap-2.5 rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  leadingIcon,
  trailingIcon,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center font-semibold transition-colors duration-150",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {leadingIcon ? <span className="shrink-0">{leadingIcon}</span> : null}
      {children}
      {trailingIcon ? <span className="shrink-0">{trailingIcon}</span> : null}
    </button>
  );
}
