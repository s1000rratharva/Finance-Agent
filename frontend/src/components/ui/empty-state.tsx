import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 border border-dashed border-line px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="mb-1 grid h-11 w-11 place-items-center border border-line bg-surface-850 text-ink-400">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      )}
      <p className="font-serif text-base text-ink-100">{title}</p>
      {description && <p className="max-w-sm text-xs leading-relaxed text-ink-400">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
