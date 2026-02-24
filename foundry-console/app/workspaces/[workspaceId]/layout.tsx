import Link from "next/link";
import { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { requireWorkspaceAccess } from "@/lib/workspace";
import { WorkspaceNavLink } from "@/components/workspace-nav-link";
import { SignOutButton } from "@/components/sign-out-button";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { supabase, user } = await requireUser();
  const { workspace, membership, isAdmin } = await requireWorkspaceAccess({
    supabase,
    userId: user.id,
    workspaceId,
  });

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-6 py-8">
      <header className="mb-6 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">
                {workspace.name || workspace.id}
              </h1>
              <span className="rounded-md border border-border px-2 py-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
                {membership.role ?? "member"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Workspace ID: {workspace.id}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/workspaces"
              className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              All workspaces
            </Link>
            <SignOutButton />
          </div>
        </div>

        <nav className="mt-4 flex flex-wrap items-center gap-2">
          <WorkspaceNavLink href={`/workspaces/${workspaceId}`} label="Overview" />
          <WorkspaceNavLink
            href={`/workspaces/${workspaceId}/sprints`}
            label="Sprints"
          />
          <WorkspaceNavLink
            href={`/workspaces/${workspaceId}/friction`}
            label="Friction"
          />
          <WorkspaceNavLink
            href={`/workspaces/${workspaceId}/milestones`}
            label="Milestones"
          />
          <WorkspaceNavLink
            href={`/workspaces/${workspaceId}/events`}
            label="Audit log"
          />
          {isAdmin ? (
            <>
              <WorkspaceNavLink
                href={`/workspaces/${workspaceId}/manual`}
                label="Manual"
              />
              <WorkspaceNavLink
                href={`/workspaces/${workspaceId}/settings`}
                label="Settings"
              />
            </>
          ) : null}
        </nav>
      </header>

      {children}
    </div>
  );
}
