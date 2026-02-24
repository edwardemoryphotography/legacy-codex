import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";

type MemberRow = {
  workspace_id: string;
  role: string | null;
};

type WorkspaceRow = {
  id: string;
  name: string | null;
};

export default async function WorkspacesPage() {
  const { supabase, user } = await requireUser();

  const { data: memberRows, error: memberError } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id);

  if (memberError) {
    throw memberError;
  }

  const memberships = (memberRows ?? []) as MemberRow[];
  const workspaceIds = memberships.map((membership) => membership.workspace_id);

  let workspaces: WorkspaceRow[] = [];
  if (workspaceIds.length > 0) {
    const { data: workspaceRows, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, name")
      .in("id", workspaceIds)
      .order("name", { ascending: true });

    if (workspaceError) {
      throw workspaceError;
    }

    workspaces = (workspaceRows ?? []) as WorkspaceRow[];
  }

  const roleByWorkspace = new Map(
    memberships.map((membership) => [membership.workspace_id, membership.role]),
  );

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">The Foundry Console</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Choose a workspace you belong to.
          </p>
        </div>
        <SignOutButton />
      </header>

      {workspaces.length === 0 ? (
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">No workspaces available</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            This account is authenticated, but has no rows in
            <code className="mx-1 rounded bg-slate-100 px-1 dark:bg-slate-800">
              workspace_members
            </code>
            visible under RLS.
          </p>
        </section>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {workspaces.map((workspace) => (
            <li
              key={workspace.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">
                    {workspace.name || workspace.id}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Role: {roleByWorkspace.get(workspace.id) ?? "unknown"}
                  </p>
                </div>
                <Link
                  href={`/workspaces/${workspace.id}`}
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white dark:bg-slate-200 dark:text-slate-900"
                >
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
