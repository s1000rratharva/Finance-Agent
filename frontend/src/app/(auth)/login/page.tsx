"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/providers/auth-provider";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated && !isLoading) {
    router.replace("/dashboard");
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to sign in right now. Try again.",
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Form side */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="text-sm text-ink-400 hover:text-ink-200">
            ← Back to home
          </Link>

          <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink-100">
            Sign in to FinSight
          </h1>
          <p className="mt-1.5 text-sm text-ink-400">
            Access your workspaces, documents and research threads.
          </p>

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="analyst@firm.com"
            />
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />

            {error && (
              <p className="rounded-lg border border-bear/30 bg-bear/10 px-3 py-2 text-xs text-bear">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" loading={submitting}>
              {submitting ? <Spinner className="mr-1" /> : null}
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-sm text-ink-400">
            No account yet?{" "}
            <Link href="/register" className="text-brand-400 hover:text-brand-300">
              Create one
            </Link>
          </p>
        </div>
      </div>

      {/* Brand side */}
      <div className="relative hidden overflow-hidden border-l border-line bg-surface-900 lg:block">
        <div className="grid-backdrop absolute inset-0" aria-hidden />
        <div className="relative flex h-full flex-col justify-center px-14">
          <p className="max-w-md text-2xl font-medium leading-snug tracking-tight text-ink-100">
            “Which company converts profit into cash most efficiently?”
          </p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-400">
            Ask in plain English. FinSight routes the question, retrieves the filings, runs the
            numbers in SQL and Python, and answers with citations you can open.
          </p>
          <div className="mt-8 grid max-w-md grid-cols-3 gap-3">
            {[
              ["Hybrid RAG", "BM25 + vectors"],
              ["Reranked", "top-k precision"],
              ["Cited", "page-level sources"],
            ].map(([title, body]) => (
              <div key={title} className="rounded-lg border border-line bg-surface-850 p-3">
                <p className="text-xs font-medium text-ink-200">{title}</p>
                <p className="mt-0.5 text-[11px] text-ink-400">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
