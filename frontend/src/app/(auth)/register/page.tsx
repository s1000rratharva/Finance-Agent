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
    <div className="w-full max-w-[380px]">
      <Link href="/" className="label-caps transition-colors hover:text-ink-100">
        ← Back to index
      </Link>

      <div className="mt-10 flex items-center gap-3">
        <span className="h-px w-7 bg-brand-500" aria-hidden />
        <p className="label-caps">New workspace</p>
      </div>

      <h1 className="display mt-4 text-4xl">Set up your desk.</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-400">
        Registration provisions an isolated workspace with the preloaded company dataset.
      </p>

      <form onSubmit={onSubmit} className="mt-9 flex flex-col gap-5">
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
          <p className="border-l-2 border-l-bear bg-bear/5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-bear">
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          loading={submitting}
          disabled={passwordTooShort}
          className="mt-2 w-full"
        >
          Create workspace
        </Button>
      </form>

      <p className="mt-8 border-t border-line pt-5 text-sm text-ink-400">
        Already registered?{" "}
        <Link href="/login" className="text-brand-500 underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>

      <p className="mt-6 border-l-2 border-line pl-3 font-mono text-[10px] uppercase leading-relaxed tracking-wider text-ink-400">
        Sample financial figures are illustrative. This is a research tool, not investment advice.
      </p>
    </div>
  );
}
