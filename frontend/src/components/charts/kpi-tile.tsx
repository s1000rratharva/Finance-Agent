"use client";

import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/spinner";
import { formatCurrency, formatPercent, trendClass } from "@/lib/format";
import { cn } from "@/lib/utils";

interface KPITileProps {
  label: string;
  value: number | null;
  unit?: string;
  deltaPct?: number | null;
  fiscalYear?: number | null;
  icon?: LucideIcon;
  currency?: string;
  loading?: boolean;
  className?: string;
}

/** Single KPI card with a signed YoY delta chip. */
export function KPITile({
  label,
  value,
  unit = "currency",
  deltaPct,
  fiscalYear,
  icon: Icon,
  currency = "INR",
  loading,
  className,
}: KPITileProps) {
  const display =
    unit === "perShare"
      ? value === null
        ? "—"
        : `₹${value.toFixed(2)}`
      : formatCurrency(value, currency, "cr");

  const DeltaIcon: LucideIcon =
    deltaPct === null || deltaPct === undefined || deltaPct === 0
      ? Minus
      : deltaPct > 0
        ? ArrowUpRight
        : ArrowDownRight;

  return (
    <div className={cn("card card-hover flex flex-col gap-2 border-t-2 border-t-line p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="label-caps truncate">{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />}
      </div>

      {loading ? (
        <Skeleton className="h-7 w-24" />
      ) : (
        <span className="num text-2xl text-ink-100">{display}</span>
      )}

      <div className="flex items-center justify-between gap-2">
        {deltaPct !== null && deltaPct !== undefined ? (
          <span
            className={cn(
              "num inline-flex items-center gap-0.5 text-[11px] font-medium",
              trendClass(deltaPct),
            )}
          >
            <DeltaIcon className="h-3 w-3" aria-hidden />
            {formatPercent(deltaPct)}
            <span className="text-ink-400">YoY</span>
          </span>
        ) : (
          <span className="text-[11px] text-ink-400">—</span>
        )}
        {fiscalYear && <span className="text-[11px] text-ink-400">FY{fiscalYear}</span>}
      </div>
    </div>
  );
}
