"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { LoadingState } from "@/components/ui/spinner";
import { useAuth } from "@/providers/auth-provider";

interface AppShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Authenticated application frame: sidebar + topbar + gated content.
 * Redirects to /login when the session cannot be resolved.
 */
export function AppShell({ title, subtitle, actions, children }: AppShellProps) {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="grid h-screen place-items-center">
        <LoadingState label="Restoring session…" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="grid h-screen place-items-center">
        <LoadingState label="Redirecting to sign in…" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} subtitle={subtitle} actions={actions} />
        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
