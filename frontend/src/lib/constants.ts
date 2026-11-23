/** Shared UI constants: navigation, metric catalogues, copy. */

import type { ChartSpec } from "@/lib/types";

export const APP_NAME = "FinSight AI";
export const APP_TAGLINE = "Financial intelligence, not another PDF chatbot.";

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: string; // lucide icon name resolved in Sidebar
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", description: "Workspace snapshot", icon: "LayoutDashboard" },
  { href: "/companies", label: "Companies", description: "Preloaded fundamentals", icon: "Building2" },
  { href: "/compare", label: "Compare", description: "Cross-company analysis", icon: "GitCompareArrows" },
  { href: "/chat", label: "Research chat", description: "Agentic RAG with citations", icon: "MessageSquareText" },
  { href: "/documents", label: "Documents", description: "Upload & index filings", icon: "Files" },
  { href: "/evaluations", label: "Evaluations", description: "RAGAS quality runs", icon: "Gauge" },
];

/** Statement columns exposed as chartable metrics. */
export interface MetricDef {
  key: string;
  label: string;
  group: "pnl" | "balance" | "cashflow" | "perShare";
  unit: "currency" | "ratio" | "perShare";
  description: string;
}

export const METRICS: MetricDef[] = [
  { key: "revenue", label: "Revenue", group: "pnl", unit: "currency", description: "Total income from operations" },
  { key: "gross_profit", label: "Gross profit", group: "pnl", unit: "currency", description: "Revenue less cost of revenue" },
  { key: "operating_profit", label: "Operating profit", group: "pnl", unit: "currency", description: "EBIT" },
  { key: "operating_expenses", label: "Operating expenses", group: "pnl", unit: "currency", description: "SG&A + other opex" },
  { key: "net_profit", label: "Net profit", group: "pnl", unit: "currency", description: "Profit after tax" },
  { key: "eps", label: "EPS", group: "perShare", unit: "perShare", description: "Earnings per share" },
  { key: "total_debt", label: "Total debt", group: "balance", unit: "currency", description: "Borrowings (short + long term)" },
  { key: "total_assets", label: "Total assets", group: "balance", unit: "currency", description: "Balance sheet total" },
  { key: "total_equity", label: "Total equity", group: "balance", unit: "currency", description: "Shareholders' funds" },
  { key: "cash_and_equivalents", label: "Cash", group: "balance", unit: "currency", description: "Cash & equivalents" },
  { key: "operating_cash_flow", label: "Operating cash flow", group: "cashflow", unit: "currency", description: "Cash from operations" },
  { key: "capex", label: "Capex", group: "cashflow", unit: "currency", description: "Capital expenditure" },
  { key: "free_cash_flow", label: "Free cash flow", group: "cashflow", unit: "currency", description: "OCF less capex" },
];

export const METRIC_GROUPS: { key: MetricDef["group"]; label: string }[] = [
  { key: "pnl", label: "Profit & loss" },
  { key: "balance", label: "Balance sheet" },
  { key: "cashflow", label: "Cash flow" },
  { key: "perShare", label: "Per share" },
];

export function metricLabel(key: string): string {
  return METRICS.find((m) => m.key === key)?.label ?? key.replace(/_/g, " ");
}

export const SUPPORTED_FILE_TYPES = [
  { ext: ".pdf", label: "PDF", hint: "Annual reports, filings, research" },
  { ext: ".xlsx", label: "Excel", hint: "Financial models, statements" },
  { ext: ".csv", label: "CSV", hint: "Tabular exports" },
  { ext: ".docx", label: "Word", hint: "Notes, memos, transcripts" },
] as const;

export const SUGGESTED_PROMPTS = [
  "Compare revenue growth of TCS and Infosys over the last 5 years",
  "What is Reliance's debt-to-equity trend and is leverage rising?",
  "Show operating margin history for Infosys as a chart",
  "Which company converts profit into cash most efficiently?",
  "Summarise the key financial risks for Reliance in FY2025",
] as const;

export const EMPTY_CHART: ChartSpec = {
  chart_type: "line",
  title: "",
  unit: null,
  x_key: "fiscal_year",
  series: [],
};
