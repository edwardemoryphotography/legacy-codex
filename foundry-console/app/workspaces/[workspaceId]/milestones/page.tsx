import { JsonInsertForm } from "@/components/json-insert-form";
import { requireUser } from "@/lib/auth";
import { requireWorkspaceAccess } from "@/lib/workspace";

type MilestoneRow = Record<string, unknown>;

function pickTimelineDate(row: MilestoneRow) {
  const candidates = [
    row.date,
    row.target_date,
    row.due_date,
    row.milestone_date,
    row.created_at,
  ];

  const found = candidates.find(
    (value) => typeof value === "string" && value.trim().length > 0,
  );

  return typeof found === "string" ? found : "No date field";
}

export default async function MilestonesPage({
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
    .from("milestones")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const milestones = (data ?? []) as MilestoneRow[];

  return (
    <main className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-xl font-semibold">Milestones timeline</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Timeline cards are built from real rows in
          <code className="mx-1 rounded bg-slate-100 px-1 dark:bg-slate-800">
            milestones
          </code>
          .
        </p>
      </section>

      <JsonInsertForm
        tableName="milestones"
        workspaceId={workspaceId}
        title="milestone"
      />

      {milestones.length === 0 ? (
        <section className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-lg font-semibold">No milestones yet</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Add a real milestone row from the form above.
          </p>
        </section>
      ) : (
        <ol className="space-y-3">
          {milestones.map((milestone, index) => (
            <li
              key={
                typeof milestone.id === "string" ? milestone.id : `milestone-${index}`
              }
              className="rounded-lg border border-border bg-card p-4"
            >
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {pickTimelineDate(milestone)}
              </p>
              <pre className="mt-2 overflow-x-auto rounded-md bg-slate-100 p-3 text-xs dark:bg-slate-800">
                {JSON.stringify(milestone, null, 2)}
              </pre>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
