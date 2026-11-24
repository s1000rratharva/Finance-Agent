import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    title: "Cited retrieval",
    body: "Dense vectors and BM25 are fused with reciprocal rank fusion, reranked, then cited back to the exact page and section.",
  },
  {
    title: "Deterministic numbers",
    body: "SQL and a guarded Python layer compute the figures. The model explains them; it never invents them.",
  },
  {
    title: "Peer comparison",
    body: "Put Reliance, TCS and Infosys side by side across five fiscal years of revenue, margin, leverage and cash flow.",
  },
  {
    title: "Routed questions",
    body: "A router sends each query down the right path: retrieve, query, compute, chart, compare or assess risk.",
  },
  {
    title: "Your own filings",
    body: "PDF, Excel, CSV and Word uploads are extracted, chunked and indexed inside your workspace only.",
  },
  {
    title: "Quality gate",
    body: "RAGAS runs replay a labelled dataset before changes ship, so retrieval regressions are visible.",
  },
];

const STACK = ["Next.js", "FastAPI", "PostgreSQL", "ChromaDB", "Groq", "RAGAS"];

const COVERAGE = [
  { name: "Reliance Industries", ticker: "RELIANCE", note: "Energy · Materials · Retail" },
  { name: "Tata Consultancy Services", ticker: "TCS", note: "Information technology" },
  { name: "Infosys", ticker: "INFY", note: "Information technology" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-950 paper-grain">
      {/* Masthead */}
      <header className="border-b border-line bg-surface-950/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <span className="font-serif text-[26px] leading-none tracking-[-0.06em]">
              F<span className="text-brand-500">/</span>S
            </span>
            <span>
              <span className="block font-serif text-[15px] leading-none tracking-tight">
                FinSight
              </span>
              <span className="label-caps mt-1.5 block">Research terminal</span>
            </span>
          </Link>

          <nav className="flex items-center gap-5 sm:gap-7">
            <a href="#method" className="label-caps hidden transition-colors hover:text-ink-100 sm:block">
              Method
            </a>
            <a href="#coverage" className="label-caps hidden transition-colors hover:text-ink-100 sm:block">
              Coverage
            </a>
            <Link
              href="/login"
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-300 transition-colors hover:text-ink-100"
            >
              Sign in
            </Link>
            <Link href="/register">
              <Button size="sm">Get access</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 lg:px-10">
        {/* Hero */}
        <section className="grid gap-14 py-16 lg:grid-cols-[1.22fr_0.78fr] lg:items-start lg:py-24">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-brand-500" aria-hidden />
              <p className="label-caps">Issue 01 · Financial intelligence</p>
            </div>

            <h1 className="display mt-6 max-w-2xl text-5xl sm:text-6xl lg:text-[68px]">
              Research that <span className="text-brand-500">shows its work.</span>
            </h1>

            <p className="serif-body mt-6 max-w-xl text-ink-300">
              FinSight turns filings and uploaded documents into answers you can audit. Every
              figure is traced to a source; every claim carries its evidence.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-6">
              <Link href="/register">
                <Button size="lg">
                  Open a workspace
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </Link>
              <a
                href="#method"
                className="border-b border-line-strong pb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-300 transition-colors hover:border-brand-500 hover:text-ink-100"
              >
                Read the method
              </a>
            </div>

            <div className="mt-14 grid max-w-xl grid-cols-3 border-t border-line">
              {[
                ["03", "Companies"],
                ["05", "Fiscal years"],
                ["01", "Isolated workspace"],
              ].map(([value, label]) => (
                <div key={label} className="border-r border-line pr-4 last:border-r-0">
                  <p className="num text-2xl text-ink-100">{value}</p>
                  <p className="label-caps mt-1.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Illustrative answer card — deliberately paper, not a glowing chat bubble. */}
          <aside className="card self-start">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="label-caps">Illustrative query</span>
              <span className="num text-[10px] text-ink-400">01 / 04</span>
            </div>
            <div className="p-5">
              <p className="font-serif text-lg leading-snug text-ink-100">
                “How did operating margin move for TCS between FY21 and FY25?”
              </p>

              <div className="my-5 border-t border-line" />

              <p className="label-caps mb-2">Answer</p>
              <p className="serif-body text-ink-200">
                Margin expanded steadily, with the sharpest step in FY22. Revenue growth and
                stable cost discipline drove the movement.
                <span className="citation-mark ml-1">1</span>
                <span className="citation-mark ml-0.5">2</span>
              </p>

              <div className="mt-5 border border-line bg-surface-850 p-3">
                <p className="label-caps mb-2">Evidence ledger</p>
                <div className="flex items-start justify-between gap-3 border-b border-line py-1.5 font-mono text-[10px] text-ink-400">
                  <span>TCS · FY25 annual report</span>
                  <span className="shrink-0">p.42</span>
                </div>
                <div className="flex items-start justify-between gap-3 pt-1.5 font-mono text-[10px] text-ink-400">
                  <span>TCS · FY22 results release</span>
                  <span className="shrink-0">p.08</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 font-mono text-[10px] uppercase tracking-wider text-ink-400">
                <span>Route: sql → rag</span>
                <span className="num">1.8s</span>
              </div>
            </div>
          </aside>
        </section>

        {/* Method */}
        <section id="method" className="border-t border-line py-14">
          <div className="grid gap-10 lg:grid-cols-[0.32fr_1fr]">
            <div>
              <p className="label-caps">01 / Method</p>
              <h2 className="display mt-3 text-3xl">
                Numbers first.
                <br />
                Narrative second.
              </h2>
              <p className="mt-4 max-w-xs text-xs leading-relaxed text-ink-400">
                A research tool built around provenance, not plausible prose.
              </p>
            </div>

            <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature, index) => (
                <article key={feature.title} className="border-t border-line-strong pt-4">
                  <p className="num text-[10px] text-brand-500">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-3 text-base text-ink-100">{feature.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-ink-400">{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Coverage */}
        <section id="coverage" className="border-t border-line py-14">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="label-caps">02 / Coverage</p>
              <h2 className="display mt-3 max-w-xl text-3xl">
                Three benchmark names, five years deep.
              </h2>
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-ink-400">
              Statements, ratios, trends and rule-based risk flags are preloaded. Registering a
              workspace provisions an isolated copy of the dataset.
            </p>
          </div>

          <div className="mt-8 grid gap-px border border-line bg-line sm:grid-cols-3">
            {COVERAGE.map((company) => (
              <div key={company.ticker} className="bg-surface-900 p-5">
                <p className="num text-[10px] text-brand-500">{company.ticker}</p>
                <p className="mt-3 font-serif text-lg text-ink-100">{company.name}</p>
                <p className="mt-1 text-xs text-ink-400">{company.note}</p>
                <p className="mt-5 border-t border-line pt-3 font-mono text-[10px] uppercase tracking-wider text-ink-400">
                  FY21 — FY25 · ready
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Stack */}
        <section className="border-t border-line py-10">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <p className="label-caps">System</p>
            {STACK.map((item) => (
              <span key={item} className="font-mono text-[11px] uppercase tracking-wider text-ink-300">
                {item}
              </span>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-6 py-6 font-mono text-[10px] uppercase tracking-wider text-ink-400 lg:px-10">
          <span>FinSight AI · illustrative data, not investment advice</span>
          <span>Built for research desks</span>
        </div>
      </footer>
    </div>
  );
}
