"use client";

import {
  Building2,
  Files,
  Gauge,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  GitCompareArrows,
  ChevronDown,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/providers/auth-provider";
import { PRIMARY_NAV } from "@/lib/constants";
import { cn, initials } from "@/lib/utils";

const ICONS: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard,
  Building2,
  GitCompareArrows,
  MessageSquareText,
  Files,
  Gauge,
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, workspace, workspaces, selectWorkspace, logout } = useAuth();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-line bg-surface-900">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 border-b border-line px-4">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-500 text-surface-950">
          <Wallet className="h-4 w-4" aria-hidden />
        </span>
        <span className="text-sm font-semibold tracking-tight text-ink-100">
          FinSight <span className="text-brand-400">AI</span>
        </span>
      </div>

      {/* Workspace switcher */}
      <div className="relative border-b border-line px-3 py-3">
        <button
          type="button"
          onClick={() => setSwitcherOpen((open) => !open)}
          className="focus-ring flex w-full items-center justify-between rounded-lg border border-line bg-surface-850 px-3 py-2 text-left transition-colors hover:border-line-strong"
        >
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium text-ink-200">
              {workspace?.name ?? "No workspace"}
            </span>
            <span className="block text-[10px] uppercase tracking-wide text-ink-400">
              workspace
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
        </button>

        {switcherOpen && workspaces.length > 0 && (
          <div className="absolute left-3 right-3 top-full z-30 mt-1 overflow-hidden rounded-lg border border-line-strong bg-surface-850 shadow-2xl">
            {workspaces.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  selectWorkspace(item.id);
                  setSwitcherOpen(false);
                }}
                className={cn(
                  "block w-full px-3 py-2 text-left text-xs transition-colors hover:bg-surface-700",
                  item.id === workspace?.id ? "text-brand-300" : "text-ink-300",
                )}
              >
                {item.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="flex flex-col gap-1">
          {PRIMARY_NAV.map((item) => {
            const Icon = ICONS[item.icon] ?? LayoutDashboard;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "focus-ring group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-brand-500/12 text-brand-300"
                      : "text-ink-300 hover:bg-surface-800 hover:text-ink-100",
                  )}
                >
                  <Icon
                    className={cn("h-4 w-4 shrink-0", active ? "text-brand-400" : "text-ink-400")}
                    aria-hidden
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-700 text-[11px] font-semibold text-ink-200">
            {user ? initials(user.name) : "?"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-ink-200">
              {user?.name ?? "Signed out"}
            </span>
            <span className="block truncate text-[11px] text-ink-400">{user?.email}</span>
          </span>
          <button
            type="button"
            onClick={handleLogout}
            title="Sign out"
            className="focus-ring rounded-md p-1.5 text-ink-400 transition-colors hover:bg-surface-800 hover:text-bear"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {workspace && (
          <div className="mt-2">
            <Badge tone="brand">{workspace.slug}</Badge>
          </div>
        )}
      </div>
    </aside>
  );
}
