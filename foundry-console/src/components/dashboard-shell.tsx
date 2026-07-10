"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Rocket,
  Flame,
  Flag,
  BookOpen,
  ScrollText,
  Settings,
  Download,
  Menu,
  X,
  ChevronsUpDown,
  Plus,
  AlertTriangle,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import type { CreateWorkspaceResult } from "@/lib/workspace-context";
import type { Workspace } from "@/lib/types";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/sprints", label: "Sprints", icon: Rocket },
  { href: "/dashboard/friction", label: "Friction", icon: Flame },
  { href: "/dashboard/milestones", label: "Milestones", icon: Flag },
  { href: "/dashboard/manual", label: "Manual", icon: BookOpen },
  { href: "/dashboard/events", label: "Audit Log", icon: ScrollText },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/export", label: "Export", icon: Download },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const { workspaces, current, setCurrent, createWorkspace, loading, connectionError } =
    useWorkspace();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-indigo-500" />
          <p className="text-[13px] text-zinc-600">Connecting…</p>
        </div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="card max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold">Can&apos;t reach the database</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
            {connectionError}
          </p>
          <p className="mt-3 text-[13px] text-zinc-600">
            Check that <code className="text-zinc-400">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
            and <code className="text-zinc-400">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
            are set, and that SCHEMA.sql has been applied.
          </p>
        </div>
      </div>
    );
  }

  if (!current) {
    return <FirstRun onCreate={createWorkspace} />;
  }

  const nav = (
    <nav className="flex-1 space-y-0.5 px-3 py-3">
      {NAV_ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors ${
              active
                ? "bg-zinc-800/80 text-zinc-50"
                : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
          >
            <Icon
              className={`h-4 w-4 transition-colors ${
                active ? "text-indigo-400" : "text-zinc-600 group-hover:text-zinc-400"
              }`}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const workspaceSwitcher = (
    <div className="relative border-b border-zinc-800/80 p-3">
      <button
        onClick={() => setSwitcherOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-zinc-900"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-[13px] font-bold text-white shadow-sm">
          {current.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-zinc-100">
            {current.name}
          </p>
          <p className="text-[11px] text-zinc-600">Workspace</p>
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
      </button>

      {switcherOpen && (
        <div className="animate-fade-up absolute left-3 right-3 top-full z-30 mt-1 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
          {workspaces.map((ws: Workspace) => (
            <button
              key={ws.id}
              onClick={() => {
                setCurrent(ws);
                setSwitcherOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-zinc-800 ${
                ws.id === current.id
                  ? "font-semibold text-indigo-300"
                  : "text-zinc-300"
              }`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-800 text-[10px] font-bold">
                {ws.name.charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{ws.name}</span>
            </button>
          ))}
          <NewWorkspaceInline
            onCreate={async (name) => {
              const result = await createWorkspace(name);
              if (result.ok) setSwitcherOpen(false);
              return result;
            }}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-zinc-800/80 bg-zinc-950 md:flex">
        <div className="flex items-center gap-2 px-5 pb-1 pt-5">
          <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
          <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-zinc-400">
            Foundry Console
          </span>
        </div>
        {workspaceSwitcher}
        {nav}
        <div className="border-t border-zinc-800/80 px-5 py-3">
          <p className="text-[11px] text-zinc-700">Case Study Zero</p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/90 px-4 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-indigo-500" />
          <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-zinc-400">
            Foundry
          </span>
          <span className="text-zinc-700">/</span>
          <span className="max-w-[140px] truncate text-[13px] font-semibold text-zinc-200">
            {current.name}
          </span>
        </div>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-900"
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile slide-over */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="animate-fade-up absolute inset-y-0 left-0 flex w-72 flex-col border-r border-zinc-800 bg-zinc-950">
            <div className="flex h-14 items-center justify-between px-5">
              <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                Foundry Console
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-900"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {workspaceSwitcher}
            {nav}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 pt-14 md:ml-60 md:pt-0">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}

function NewWorkspaceInline({
  onCreate,
}: {
  onCreate: (name: string) => Promise<CreateWorkspaceResult>;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="flex w-full items-center gap-2 border-t border-zinc-800 px-3 py-2.5 text-left text-[13px] text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
      >
        <Plus className="h-3.5 w-3.5" />
        New workspace
      </button>
    );
  }

  return (
    <form
      className="border-t border-zinc-800 p-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        setError(null);
        try {
          const result = await onCreate(name.trim());
          if (result.ok) {
            setName("");
            setAdding(false);
          } else {
            setError(result.error);
          }
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Workspace name"
          className="input py-1.5 text-[13px]"
        />
        <button type="submit" disabled={busy || !name.trim()} className="btn-primary px-3 py-1.5 text-[13px]">
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
      {error && <p className="mt-2 text-[12px] text-red-400">{error}</p>}
    </form>
  );
}

function FirstRun({
  onCreate,
}: {
  onCreate: (name: string) => Promise<CreateWorkspaceResult>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="animate-fade-up w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
            <Rocket className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            The Foundry Console
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            No workspaces yet. Name your first one to get started — that&apos;s
            the only setup there is.
          </p>
        </div>

        <form
          className="card space-y-4 p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            setBusy(true);
            setError(null);
            try {
              const result = await onCreate(name.trim());
              if (!result.ok) setError(result.error);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div>
            <label htmlFor="ws-name" className="label">
              Workspace name
            </label>
            <input
              id="ws-name"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Case Study Zero"
              className="input"
            />
          </div>
          {error && <p className="text-[13px] text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="btn-primary w-full"
          >
            {busy ? "Creating…" : "Create workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
