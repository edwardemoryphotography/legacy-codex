"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@/lib/supabase/client";
import type { Workspace } from "@/lib/types";

const NAV_ITEMS = [
  { href: "/dashboard/sprints", label: "Sprints" },
  { href: "/dashboard/friction", label: "Friction" },
  { href: "/dashboard/milestones", label: "Milestones" },
  { href: "/dashboard/manual", label: "Manual" },
  { href: "/dashboard/events", label: "Audit Log" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/export", label: "Export" },
];

export function DashboardShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { workspaces, current, setCurrent, currentRole, loading } =
    useWorkspace();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center space-y-3">
          <h2 className="text-lg font-semibold">No Workspaces</h2>
          <p className="text-sm text-zinc-400">
            You are not a member of any workspace yet.
          </p>
          <button
            onClick={handleSignOut}
            className="text-sm text-indigo-400 hover:text-indigo-300"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-zinc-800 bg-zinc-900/50 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <h1 className="text-sm font-bold tracking-wide text-zinc-200 uppercase">
            Foundry Console
          </h1>
          {workspaces.length > 1 ? (
            <select
              value={current.id}
              onChange={(e) => {
                const ws = workspaces.find(
                  (w: Workspace) => w.id === e.target.value
                );
                if (ws) setCurrent(ws);
              }}
              className="mt-2 block w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
            >
              {workspaces.map((ws: Workspace) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-2 text-xs text-zinc-400 truncate">
              {current.name}
            </p>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            if (
              item.href === "/dashboard/settings" &&
              currentRole !== "admin"
            ) {
              return null;
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded px-3 py-1.5 text-sm ${
                  active
                    ? "bg-indigo-600/20 text-indigo-300 font-medium"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-800 p-3 space-y-2">
          <p className="text-xs text-zinc-500 truncate">{userEmail}</p>
          {currentRole && (
            <p className="text-xs text-zinc-600 capitalize">{currentRole}</p>
          )}
          <button
            onClick={handleSignOut}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl p-6">{children}</div>
      </main>
    </div>
  );
}
