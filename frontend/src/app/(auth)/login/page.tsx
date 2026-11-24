"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <div className="w-full max-w-[380px]">
      <Link href="/" className="label-caps transition-colors hover:text-ink-100">
        ← Back to index
      </Link>

      <div className="mt-10 flex items-center gap-3">
        <span className="h-px w-7 bg-brand-500" aria-hidden />
        <p className="label-caps">Account access</p>
      </div>

      <h1 className="display mt-4 text-4xl">Sign in.</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-400">
        Continue to your workspaces, documents and research threads.
      </p>

      <form onSubmit={onSubmit} className="mt-9 flex flex-col gap-5">
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
          <p className="border-l-2 border-l-bear bg-bear/5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-bear">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" loading={submitting} className="mt-2 w-full">
          Sign in
        </Button>
      </form>

      <p className="mt-8 border-t border-line pt-5 text-sm text-ink-400">
        No account yet?{" "}
        <Link href="/register" className="text-brand-500 underline-offset-4 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
