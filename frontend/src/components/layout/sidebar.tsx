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
    <aside className="flex h-screen w-[248px] shrink-0 flex-col border-r border-line bg-surface-900">
      {/* Masthead */}
      <div className="flex h-16 items-center gap-3 border-b border-line px-5">
        <span className="font-serif text-[26px] leading-none tracking-[-0.06em] text-ink-100">
          F<span className="text-brand-500">/</span>S
        </span>
        <span className="min-w-0">
          <span className="block font-serif text-[15px] leading-none tracking-tight text-ink-100">
            FinSight
          </span>
          <span className="label-caps mt-1.5 block">Research terminal</span>
        </span>
      </div>

      {/* Workspace switcher */}
      <div className="relative border-b border-line px-5 py-4">
        <p className="label-caps mb-2">Active workspace</p>
        <button
          type="button"
          onClick={() => setSwitcherOpen((open) => !open)}
          className="focus-ring flex w-full items-center justify-between gap-2 border border-line bg-surface-850 px-3 py-2.5 text-left transition-colors hover:border-line-strong"
        >
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium text-ink-100">
              {workspace?.name ?? "No workspace"}
            </span>
            <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-ink-400">
              {workspace?.slug ?? "tenant scope"}
            </span>
          </span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 shrink-0 text-ink-400 transition-transform", switcherOpen && "rotate-180")}
            aria-hidden
          />
        </button>

        {switcherOpen && workspaces.length > 0 && (
          <div className="absolute left-5 right-5 top-full z-30 mt-1 border border-line-strong bg-surface-900">
            {workspaces.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  selectWorkspace(item.id);
                  setSwitcherOpen(false);
                }}
                className={cn(
                  "block w-full border-b border-line px-3 py-2.5 text-left font-mono text-[11px] uppercase tracking-wider last:border-b-0 transition-colors hover:bg-surface-850",
                  item.id === workspace?.id ? "text-brand-500" : "text-ink-300",
                )}
              >
                {item.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <p className="label-caps mb-3 px-2">Sections</p>
        <ul className="flex flex-col">
          {PRIMARY_NAV.map((item, index) => {
            const Icon = ICONS[item.icon] ?? LayoutDashboard;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "focus-ring group flex items-center gap-3 border-l-2 py-2.5 pl-[10px] pr-2 transition-colors",
                    active
                      ? "border-brand-500 bg-brand-500/[0.07] text-ink-100"
                      : "border-transparent text-ink-300 hover:bg-surface-850 hover:text-ink-100",
                  )}
                >
                  <span className="num w-5 shrink-0 text-[10px] text-ink-400">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate text-xs font-medium">{item.label}</span>
                  <Icon
                    className={cn(
                      "ml-auto h-3.5 w-3.5 shrink-0",
                      active ? "text-brand-500" : "text-ink-400 group-hover:text-ink-300",
                    )}
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-8 border-t border-line px-2 pt-5">
          <p className="label-caps leading-relaxed">
            Figures in INR crore. Sample data is illustrative and not investment advice.
          </p>
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-line p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center border border-line bg-surface-850 font-mono text-[11px] text-ink-200">
            {user ? initials(user.name) : "?"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-ink-100">
              {user?.name ?? "Signed out"}
            </span>
            <span className="block truncate font-mono text-[10px] text-ink-400">
              {user?.email}
            </span>
          </span>
          <button
            type="button"
            onClick={handleLogout}
            title="Sign out"
            className="focus-ring border border-transparent p-1.5 text-ink-400 transition-colors hover:border-line hover:text-bear"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        {workspace && (
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <span className="label-caps">Scope</span>
            <Badge tone="neutral">{workspace.slug}</Badge>
          </div>
        )}
      </div>
    </aside>
  );
}
