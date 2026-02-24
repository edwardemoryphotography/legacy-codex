import { requireUser } from "@/lib/auth";
import { requireWorkspaceAccess } from "@/lib/workspace";

type EventRow = Record<string, unknown>;

export default async function EventsPage({
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
    .from("events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const events = (data ?? []) as EventRow[];

  return (
    <main className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-xl font-semibold">Audit log</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Read-only event stream from
          <code className="mx-1 rounded bg-slate-100 px-1 dark:bg-slate-800">
            events
          </code>
          . This UI does not support edit or delete.
        </p>
      </section>

      {events.length === 0 ? (
        <section className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-lg font-semibold">No events yet</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            No audit rows are currently visible for this workspace.
          </p>
        </section>
      ) : (
        <ul className="space-y-3">
          {events.map((eventRow, index) => (
            <li
              key={typeof eventRow.id === "string" ? eventRow.id : `event-${index}`}
              className="rounded-lg border border-border bg-card p-4"
            >
              <pre className="overflow-x-auto rounded-md bg-slate-100 p-3 text-xs dark:bg-slate-800">
                {JSON.stringify(eventRow, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
