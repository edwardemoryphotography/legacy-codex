import { JsonInsertForm } from "@/components/json-insert-form";
import { requireUser } from "@/lib/auth";
import { requireWorkspaceAccess } from "@/lib/workspace";

type FrictionRow = Record<string, unknown>;

export default async function FrictionPage({
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
    .from("friction_entries")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const entries = (data ?? []) as FrictionRow[];

  return (
    <main className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-xl font-semibold">Friction entries</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Real rows from
          <code className="mx-1 rounded bg-slate-100 px-1 dark:bg-slate-800">
            friction_entries
          </code>
          scoped by workspace.
        </p>
      </section>

      <JsonInsertForm
        tableName="friction_entries"
        workspaceId={workspaceId}
        title="friction entry"
      />

      {entries.length === 0 ? (
        <section className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-lg font-semibold">No friction entries yet</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Add the first real row using the JSON form above.
          </p>
        </section>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry, index) => (
            <li
              key={typeof entry.id === "string" ? entry.id : `friction-${index}`}
              className="rounded-lg border border-border bg-card p-4"
            >
              <pre className="overflow-x-auto rounded-md bg-slate-100 p-3 text-xs dark:bg-slate-800">
                {JSON.stringify(entry, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
