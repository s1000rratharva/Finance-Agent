import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_TAGLINE } from "@/lib/constants";
import {
  ArrowRight,
  Building2,
  ChartNoAxesCombined,
  FileUp,
  GitCompareArrows,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

const FEATURES = [
  {
    icon: MessageSquareText,
    title: "Cited RAG, not vibes",
    body: "Hybrid search (BM25 + vectors), query rewriting and reranking answer with inline [n] citations back to the exact page.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "SQL + Python analytics",
    body: "Numbers come from Postgres and a guarded Python calculator — never from the model's arithmetic.",
  },
  {
    icon: GitCompareArrows,
    title: "Multi-year comparisons",
    body: "Compare Reliance, TCS and Infosys across FY21–FY25 on revenue, margin, debt, cash flow and ratios.",
  },
  {
    icon: Workflow,
    title: "Agentic task routing",
    body: "A router classifies each request and picks the right tool: retrieve, query, compute, chart or assess risk.",
  },
  {
    icon: FileUp,
    title: "Your documents too",
    body: "Upload PDFs, Excel, CSV and Word files. Text and numeric tables are extracted and indexed per workspace.",
  },
  {
    icon: ShieldCheck,
    title: "Tenant-isolated by design",
    body: "Workspace-scoped collections, storage keys and queries. One tenant can never read another's data.",
  },
];

const STACK = ["Next.js 16", "FastAPI", "PostgreSQL", "ChromaDB", "Groq", "Tailwind 4", "RAGAS"];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden />

      {/* Header */}
      <header className="relative z-10 flex h-16 items-center justify-between px-6 lg:px-10">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-500 text-surface-950">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            FinSight <span className="text-brand-400">AI</span>
          </span>
        </div>
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="focus-ring rounded-lg px-3 py-2 text-sm text-ink-300 transition-colors hover:text-ink-100"
          >
            Sign in
          </Link>
          <Link href="/register">
            <Button size="sm">Get started</Button>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-16 lg:px-10">
        <section className="max-w-3xl">
          <Badge tone="brand" className="mb-5">
            Production-oriented financial intelligence
          </Badge>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-ink-100 sm:text-5xl">
            Financial research with <span className="text-brand-400">sources you can check</span>.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-300">
            {APP_TAGLINE} Explore preloaded fundamentals for Reliance, TCS and Infosys, upload
            your own filings, and get cited answers backed by hybrid retrieval, SQL analytics
            and a guarded Python calculation layer.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/register">
              <Button size="lg">
                <ArrowRight className="h-4 w-4" aria-hidden />
                Start researching
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Sign in to a workspace
              </Button>
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {STACK.map((item) => (
              <span
                key={item}
                className="rounded-full border border-line bg-surface-900 px-3 py-1 text-[11px] text-ink-400"
              >
                {item}
              </span>
            ))}
          </div>
        </section>

        {/* Feature grid */}
        <section className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="card card-hover p-5"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500/12 text-brand-400">
                <Icon className="h-4.5 w-4.5" aria-hidden />
              </span>
              <h2 className="mt-3.5 text-sm font-semibold text-ink-100">{title}</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-400">{body}</p>
            </article>
          ))}
        </section>

        {/* Company strip */}
        <section className="card mt-16 flex flex-wrap items-center justify-between gap-6 p-6">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-ink-400" aria-hidden />
            <div>
              <p className="text-sm font-medium text-ink-100">Preloaded coverage</p>
              <p className="text-xs text-ink-400">
                Five fiscal years of statements, ratios and risk signals — ready on day one.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Reliance Industries", "TCS", "Infosys"].map((name) => (
              <Badge key={name} tone="neutral">
                {name}
              </Badge>
            ))}
          </div>
        </section>

        <footer className="mt-16 flex items-center justify-between border-t border-line pt-6 text-xs text-ink-400">
          <span>FinSight AI — sample data is illustrative, not investment advice.</span>
          <span className="num">v0.1.0</span>
        </footer>
      </main>
    </div>
  );
}
