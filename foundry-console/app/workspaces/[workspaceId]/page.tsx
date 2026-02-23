import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { requireWorkspaceAccess } from "@/lib/workspace";

async function getCountForTable({
  supabase,
  table,
  workspaceId,
}: {
  supabase: any;
  table: string;
  workspaceId: string;
}) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  if (error) {
    return null;
  }

  return count ?? 0;
}

export default async function WorkspaceOverviewPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { supabase, user } = await requireUser();
  const { isAdmin } = await requireWorkspaceAccess({
    supabase,
    userId: user.id,
    workspaceId,
  });

  const [sprintCount, frictionCount, milestoneCount, eventCount] =
    await Promise.all([
      getCountForTable({ supabase, table: "sprints", workspaceId }),
      getCountForTable({ supabase, table: "friction_entries", workspaceId }),
      getCountForTable({ supabase, table: "milestones", workspaceId }),
      getCountForTable({ supabase, table: "events", workspaceId }),
    ]);

  return (
    <main className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-xl font-semibold">Workspace overview</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          This console renders only real Supabase data under RLS. Empty states
          are shown when rows do not exist.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <article className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Sprints
          </h3>
          <p className="mt-2 text-3xl font-semibold">
            {sprintCount === null ? "N/A" : sprintCount}
          </p>
          <Link
            href={`/workspaces/${workspaceId}/sprints`}
            className="mt-3 inline-block text-sm underline"
          >
            Open sprints
          </Link>
        </article>

        <article className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Friction entries
          </h3>
          <p className="mt-2 text-3xl font-semibold">
            {frictionCount === null ? "N/A" : frictionCount}
          </p>
          <Link
            href={`/workspaces/${workspaceId}/friction`}
            className="mt-3 inline-block text-sm underline"
          >
            Open friction
          </Link>
        </article>

        <article className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Milestones
          </h3>
          <p className="mt-2 text-3xl font-semibold">
            {milestoneCount === null ? "N/A" : milestoneCount}
          </p>
          <Link
            href={`/workspaces/${workspaceId}/milestones`}
            className="mt-3 inline-block text-sm underline"
          >
            Open milestones
          </Link>
        </article>

        <article className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Audit events
          </h3>
          <p className="mt-2 text-3xl font-semibold">
            {eventCount === null ? "N/A" : eventCount}
          </p>
          <Link
            href={`/workspaces/${workspaceId}/events`}
            className="mt-3 inline-block text-sm underline"
          >
            Open audit log
          </Link>
        </article>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Export workspace data</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          JSON export includes sprints, friction entries, milestones, and events.
        </p>
        <a
          href={`/api/workspaces/${workspaceId}/export`}
          className="mt-3 inline-block rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white dark:bg-slate-200 dark:text-slate-900"
        >
          Download JSON export
        </a>
      </section>

      {isAdmin ? (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Admin panels</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            <li>
              <Link href={`/workspaces/${workspaceId}/manual`} className="underline">
                Manual page editor
              </Link>
            </li>
            <li>
              <Link
                href={`/workspaces/${workspaceId}/settings`}
                className="underline"
              >
                Workspace settings
              </Link>
            </li>
          </ul>
        </section>
      ) : null}
    </main>
  );
}
