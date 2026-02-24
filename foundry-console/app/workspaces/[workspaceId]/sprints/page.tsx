import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { requireWorkspaceAccess } from "@/lib/workspace";

type SprintRow = Record<string, unknown>;

function sprintLabel(row: SprintRow) {
  if (typeof row.name === "string" && row.name.trim()) {
    return row.name;
  }
  if (typeof row.title === "string" && row.title.trim()) {
    return row.title;
  }
  if (typeof row.id === "string") {
    return row.id;
  }
  return "Untitled sprint";
}

function sprintStatus(row: SprintRow) {
  if (typeof row.status === "string" && row.status.trim()) {
    return row.status;
  }
  return "unknown";
}

export default async function SprintsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { supabase, user } = await requireUser();
  await requireWorkspaceAccess({
    supabase,
    userId: user.id,
    workspaceId,
  });

  const { data, error } = await supabase
    .from("sprints")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const sprints = (data ?? []) as SprintRow[];

  return (
    <main className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-xl font-semibold">Sprints</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Select a sprint to edit all available fields.
        </p>
      </section>

      {sprints.length === 0 ? (
        <section className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-lg font-semibold">No sprints yet</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            No rows are available in
            <code className="mx-1 rounded bg-slate-100 px-1 dark:bg-slate-800">
              sprints
            </code>
            for this workspace.
          </p>
        </section>
      ) : (
        <ul className="space-y-3">
          {sprints.map((sprint, index) => {
            const id = typeof sprint.id === "string" ? sprint.id : null;
            return (
              <li
                key={id ?? `sprint-${index}`}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{sprintLabel(sprint)}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      status: {sprintStatus(sprint)}
                    </p>
                  </div>

                  {id ? (
                    <Link
                      href={`/workspaces/${workspaceId}/sprints/${id}`}
                      className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Edit
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Missing sprint id
                    </span>
                  )}
                </div>

                <pre className="mt-3 overflow-x-auto rounded-md bg-slate-100 p-3 text-xs dark:bg-slate-800">
                  {JSON.stringify(sprint, null, 2)}
                </pre>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
