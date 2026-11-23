"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/providers/auth-provider";
import { ApiError } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated, isLoading } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated && !isLoading) {
    router.replace("/dashboard");
  }

  const passwordTooShort = password.length > 0 && password.length < 8;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password);
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to create the account right now.",
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-sm text-ink-400 hover:text-ink-200">
          ← Back to home
        </Link>

        <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink-100">
          Create your workspace
        </h1>
        <p className="mt-1.5 text-sm text-ink-400">
          You get an isolated workspace with the preloaded company data included.
        </p>

        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
          <Input
            label="Full name"
            name="name"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Priya Sharma"
          />
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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            error={passwordTooShort ? "Password must be at least 8 characters." : null}
          />

          {error && (
            <p className="rounded-lg border border-bear/30 bg-bear/10 px-3 py-2 text-xs text-bear">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" loading={submitting} disabled={passwordTooShort}>
            Create account
          </Button>
        </form>

        <p className="mt-6 text-sm text-ink-400">
          Already registered?{" "}
          <Link href="/login" className="text-brand-400 hover:text-brand-300">
            Sign in
          </Link>
        </p>

        <p className="mt-8 rounded-lg border border-line bg-surface-900 p-3 text-[11px] leading-relaxed text-ink-400">
          Sample financial figures bundled with FinSight are illustrative. This platform is a
          research tool, not investment advice.
        </p>
      </div>
    </div>
  );
}
