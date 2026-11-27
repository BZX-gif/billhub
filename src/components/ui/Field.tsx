"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

interface FieldWrapperProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
  optional?: boolean;
}

export function FieldWrapper({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
  optional,
}: FieldWrapperProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={htmlFor} className="vb-label flex items-center gap-1.5">
        {label}
        {optional ? (
          <span className="font-normal normal-case tracking-normal text-ink-faint/80">(optional)</span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  containerClassName?: string;
  prefix?: ReactNode;
}

export function TextField({
  label,
  hint,
  error,
  optional,
  containerClassName,
  prefix,
  className,
  id,
  ...props
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldWrapper
      label={label}
      htmlFor={inputId}
      hint={hint}
      error={error}
      className={containerClassName}
      optional={optional}
    >
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
            {prefix}
          </span>
        ) : null}
        <input
          id={inputId}
          className={cn("vb-input", Boolean(prefix) && "pl-8", className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
      </div>
    </FieldWrapper>
  );
}

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  containerClassName?: string;
}

export function TextAreaField({
  label,
  hint,
  error,
  optional,
  containerClassName,
  className,
  id,
  ...props
}: TextAreaFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldWrapper
      label={label}
      htmlFor={inputId}
      hint={hint}
      error={error}
      className={containerClassName}
      optional={optional}
    >
      <textarea
        id={inputId}
        className={cn("vb-input resize-y", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...props}
      />
    </FieldWrapper>
  );
}

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  containerClassName?: string;
  children: ReactNode;
}

export function SelectField({
  label,
  hint,
  error,
  optional,
  containerClassName,
  className,
  children,
  id,
  ...props
}: SelectFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldWrapper
      label={label}
      htmlFor={inputId}
      hint={hint}
      error={error}
      className={containerClassName}
      optional={optional}
    >
      <select
        id={inputId}
        className={cn("vb-input appearance-none bg-[length:14px] bg-[right_0.9rem_center] bg-no-repeat pr-9", className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%235C5548' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")",
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...props}
      >
        {children}
      </select>
    </FieldWrapper>
  );
}
