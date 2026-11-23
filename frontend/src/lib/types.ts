/**
 * API types - mirrors of the FastAPI Pydantic schemas in
 * backend/app/schemas/*. Regenerate or update both sides together.
 */

export type UUID = string;

// --- auth -------------------------------------------------------------------

export interface User {
  id: UUID;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  token_type: "bearer";
}

// --- workspaces --------------------------------------------------------------

export interface Workspace {
  id: UUID;
  name: string;
  slug: string;
  description: string | null;
  owner_id: UUID;
  created_at: string;
}

export interface WorkspaceStats {
  documents: number;
  chunks: number;
  conversations: number;
}

// --- companies / financials ---------------------------------------------------

export interface Statement {
  id: UUID;
  fiscal_year: number;
  period: string;
  as_of: string | null;
  source: string | null;

  revenue: number | null;
  cost_of_revenue: number | null;
  gross_profit: number | null;
  operating_expenses: number | null;
  operating_profit: number | null;
  interest_expense: number | null;
  depreciation_amortization: number | null;
  profit_before_tax: number | null;
  tax_expense: number | null;
  net_profit: number | null;
  eps: number | null;

  total_assets: number | null;
  total_liabilities: number | null;
  total_equity: number | null;
  total_debt: number | null;
  cash_and_equivalents: number | null;
  current_assets: number | null;
  current_liabilities: number | null;
  inventory: number | null;
  working_capital: number | null;

  operating_cash_flow: number | null;
  investing_cash_flow: number | null;
  financing_cash_flow: number | null;
  capex: number | null;
  free_cash_flow: number | null;

  market_cap: number | null;
  dividend_payout_ratio: number | null;
}

export interface Company {
  id: UUID;
  slug: string;
  ticker: string;
  name: string;
  sector: string | null;
  industry: string | null;
  exchange: string | null;
  currency: string;
  logo_url: string | null;
  description: string | null;
}

export interface CompanyDetail extends Company {
  statements: Statement[];
}

export interface ComparisonSeries {
  fiscal_year: number;
  values: Record<string, number | null>;
}

export interface ComparisonResponse {
  metric: string;
  unit: string;
  companies: Company[];
  series: ComparisonSeries[];
}

// --- analytics ----------------------------------------------------------------

export interface KPI {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  delta_pct: number | null;
  fiscal_year: number | null;
}

export interface Overview {
  company: string;
  ticker: string;
  currency: string;
  fiscal_year: number;
  kpis: KPI[];
}

export interface TrendPoint {
  fiscal_year: number;
  value: number | null;
}

export interface Trend {
  metric: string;
  label: string;
  unit: string;
  points: TrendPoint[];
}

export interface RatioRow {
  fiscal_year: number;
  ratios: Record<string, number | null>;
}

export interface RiskFlag {
  key: string;
  label: string;
  severity: "low" | "medium" | "high";
  detail: string;
  value: number | null;
}

export interface RiskOut {
  company: string;
  fiscal_year: number;
  flags: RiskFlag[];
  summary: string | null;
}

// --- documents -----------------------------------------------------------------

export interface DocumentRecord {
  id: UUID;
  workspace_id: UUID;
  filename: string;
  content_type: string;
  size_bytes: number;
  status: "pending" | "processing" | "ready" | "failed";
  error: string | null;
  chunk_count: number;
  created_at: string;
}

export interface Chunk {
  id: UUID;
  chunk_index: number;
  text: string;
  page: number | null;
  section: string | null;
}

// --- chat -----------------------------------------------------------------------

export interface Citation {
  index: number;
  document_id: UUID | null;
  document_name: string;
  page: number | null;
  section: string | null;
  snippet: string;
  score: number | null;
}

export interface TraceStep {
  name: string;
  status: "ok" | "skipped" | "error";
  detail: string | null;
  duration_ms: number | null;
  payload: Record<string, unknown>;
}

export interface ChartSeries {
  key: string;
  label: string;
  data: { x: number | string; y: number | null }[];
}

export interface ChartSpec {
  chart_type: "line" | "bar" | "area" | "pie" | "kpi";
  title: string;
  unit: string | null;
  x_key: string;
  series: ChartSeries[];
}

export interface ChatResponse {
  conversation_id: UUID;
  message_id: UUID | null;
  answer: string;
  citations: Citation[];
  trace: TraceStep[];
  charts: ChartSpec[];
  sql: string | null;
  created_at: string | null;
}

export interface Conversation {
  id: UUID;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: UUID;
  role: "user" | "assistant" | "tool";
  content: string;
  citations_json: Citation[];
  trace_json: TraceStep[];
  created_at: string;
}

// --- evaluation -------------------------------------------------------------------

export interface EvalScores {
  faithfulness: number | null;
  answer_relevancy: number | null;
  context_precision: number | null;
  context_recall: number | null;
  factual_correctness: number | null;
}

export interface EvalRun {
  id: UUID;
  dataset_name: string;
  status: string;
  scores: EvalScores;
  sample_count: number;
  created_at: string;
  error: string | null;
}

// --- misc --------------------------------------------------------------------------

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export interface HealthStatus {
  status: "ok" | "degraded";
  version: string;
  environment: string;
  checks: Record<string, string>;
}
