/** Number / currency / date formatting for financial data. */

const INDIAN_NUMBER_FORMAT = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

const COMPACT_NUMBER_FORMAT = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 2,
});

/** 964643 -> "9,64,643" (Indian digit grouping). */
export function formatNumber(value: number | null | undefined, fractionDigits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value);
}

/** 964643 -> "9.65L" (Indian crore/lakh scale via compact notation). */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return COMPACT_NUMBER_FORMAT.format(value);
}

/** Full currency with unit, e.g. ₹9,64,643 cr. */
export function formatCurrency(
  value: number | null | undefined,
  currency = "INR",
  unit = "cr",
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : `${currency} `;
  const suffix = unit ? ` ${unit}` : "";
  return `${symbol}${INDIAN_NUMBER_FORMAT.format(value)}${suffix}`;
}

/** Signed percentage, e.g. +12.4% / -3.1% / —. */
export function formatPercent(
  value: number | null | undefined,
  fractionDigits = 1,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(fractionDigits)}%`;
}

/** Decimal ratio, e.g. 0.184 -> 18.4%. */
export function formatRatio(value: number | null | undefined, fractionDigits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

/** Multiple, e.g. 2.34 -> "2.34x". */
export function formatMultiple(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(2)}x`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Fiscal-year label, e.g. 2025 -> "FY25". */
export function fiscalYear(year: number): string {
  return `FY${String(year).slice(-2)}`;
}

/** Classify a delta for colouring. */
export function trendClass(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return "text-ink-400";
  return value > 0 ? "text-bull" : "text-bear";
}
