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
      className="border border-line-strong bg-surface-900 transition-colors focus-within:border-brand-500"
    >
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="label-caps">New query</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-400">
          Enter to send · Shift+Enter for new line
        </span>
      </div>

      <div className="flex items-end gap-2 p-2">
        <button
          type="button"
          title="Attach a document"
          className="focus-ring mb-1 border border-transparent p-2 text-ink-400 transition-colors hover:border-line hover:text-ink-100"
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
            "serif-body max-h-44 min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-ink-100",
            "placeholder:text-ink-400 focus:outline-none disabled:opacity-50",
          )}
        />

        {busy ? (
          <button
            type="button"
            onClick={onStop}
            title="Stop generating"
            className="focus-ring mb-1 grid h-9 w-9 place-items-center border border-line bg-surface-800 text-ink-200 hover:border-line-strong"
          >
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            title="Send"
            className={cn(
              "focus-ring mb-1 grid h-9 w-9 place-items-center transition-colors",
              canSend
                ? "bg-brand-500 text-surface-900 hover:bg-brand-600"
                : "border border-line bg-surface-800 text-ink-400",
            )}
          >
            <ArrowUp className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    </form>
  );
}
