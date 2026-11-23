"use client";

import { ArrowUp, Paperclip, Square } from "lucide-react";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

interface ComposerProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  busy?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export function Composer({
  onSend,
  onStop,
  busy,
  placeholder = "Ask about revenue, leverage, margins…",
  disabled,
}: ComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = value.trim().length > 0 && !busy && !disabled;

  const submit = () => {
    if (!canSend) return;
    onSend(value.trim());
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const autoGrow = (element: HTMLTextAreaElement) => {
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 180)}px`;
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-line bg-surface-900 p-2 transition-colors focus-within:border-line-strong"
    >
      <div className="flex items-end gap-2">
        <button
          type="button"
          title="Attach a document"
          className="focus-ring mb-1 rounded-lg p-2 text-ink-400 transition-colors hover:bg-surface-800 hover:text-ink-200"
          onClick={() => (window.location.href = "/documents")}
        >
          <Paperclip className="h-4 w-4" aria-hidden />
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            autoGrow(event.target);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "max-h-44 min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-sm text-ink-100",
            "placeholder:text-ink-400 focus:outline-none disabled:opacity-50",
          )}
        />

        {busy ? (
          <button
            type="button"
            onClick={onStop}
            title="Stop generating"
            className="focus-ring mb-1 grid h-9 w-9 place-items-center rounded-lg bg-surface-700 text-ink-200 hover:bg-surface-600"
          >
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            title="Send"
            className={cn(
              "focus-ring mb-1 grid h-9 w-9 place-items-center rounded-lg transition-colors",
              canSend
                ? "bg-brand-500 text-surface-950 hover:bg-brand-400"
                : "bg-surface-800 text-ink-400",
            )}
          >
            <ArrowUp className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      <p className="px-2 pb-0.5 text-[10px] text-ink-400">
        Enter to send · Shift+Enter for a new line · answers cite retrieved sources
      </p>
    </form>
  );
}
