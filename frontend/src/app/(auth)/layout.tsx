import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Account" };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-surface-950 lg:grid-cols-[0.95fr_1.05fr]">
      {/* Editorial panel */}
      <section className="relative hidden flex-col justify-between border-r border-line bg-surface-900 px-12 py-10 paper-grain lg:flex">
        <Link href="/" className="flex items-center gap-3">
          <span className="font-serif text-[26px] leading-none tracking-[-0.06em]">
            F<span className="text-brand-500">/</span>S
          </span>
          <span>
            <span className="block font-serif text-[15px] leading-none tracking-tight">FinSight</span>
            <span className="label-caps mt-1.5 block">Research terminal</span>
          </span>
        </Link>

        <div className="max-w-lg">
          <p className="label-caps">The research question</p>
          <blockquote className="display mt-5 text-4xl leading-[1.08]">
            “Which company converts profit into cash most efficiently?”
          </blockquote>
          <p className="serif-body mt-6 text-ink-300">
            Ask in plain language. FinSight routes the question, retrieves the filings, runs the
            numbers in SQL and Python, and answers with sources you can open.
          </p>

          <div className="mt-10 grid grid-cols-3 border-t border-line">
            {[
              ["01", "Hybrid retrieval", "BM25 + vectors"],
              ["02", "Reranked", "top-k precision"],
              ["03", "Cited", "page-level evidence"],
            ].map(([index, title, detail]) => (
              <div key={index} className="border-r border-line pr-4 last:border-r-0">
                <p className="num text-[10px] text-brand-500">{index}</p>
                <p className="mt-2 text-xs font-medium text-ink-100">{title}</p>
                <p className="mt-1 font-mono text-[10px] leading-relaxed text-ink-400">{detail}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-400">
          Sample figures are illustrative · not investment advice
        </p>
      </section>

      {/* Form panel */}
      <main className="flex items-center justify-center px-6 py-12 sm:px-12">{children}</main>
    </div>
  );
}
