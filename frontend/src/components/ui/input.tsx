"use client";

import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="label-caps">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-11 w-full rounded-sm border border-line-strong bg-surface-900 px-3 text-sm text-ink-100",
            "placeholder:text-ink-400 transition-colors",
            "focus:border-brand-500 focus:outline-none focus:ring-0",
            error && "border-bear focus:border-bear",
            className,
          )}
          aria-invalid={Boolean(error) || undefined}
          {...props}
        />
        {error ? (
          <p className="text-xs text-bear">{error}</p>
        ) : hint ? (
          <p className="text-xs text-ink-400">{hint}</p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string | null;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="label-caps">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "w-full rounded-sm border border-line-strong bg-surface-900 px-3 py-2 text-sm text-ink-100",
            "placeholder:text-ink-400 transition-colors resize-none",
            "focus:border-brand-500 focus:outline-none focus:ring-0",
            error && "border-bear/60",
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-bear">{error}</p>}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";
