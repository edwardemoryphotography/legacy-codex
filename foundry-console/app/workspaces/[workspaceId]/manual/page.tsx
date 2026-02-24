import { ManualEditorForm } from "@/components/manual-editor-form";
import { requireUser } from "@/lib/auth";
import { requireWorkspaceAccess } from "@/lib/workspace";

type ManualRow = Record<string, unknown>;

export default async function ManualPage({
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

  if (!isAdmin) {
    return (
      <main className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-xl font-semibold">Admin only</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Manual page editing is restricted to admin roles from
          <code className="mx-1 rounded bg-slate-100 px-1 dark:bg-slate-800">
            workspace_members
          </code>
          .
        </p>
      </main>
    );
  }

  const { data, error } = await supabase
    .from("manual_pages")
    .select("*")
    .eq("workspace_id", workspaceId)
    .limit(1);

  if (error) {
    throw error;
  }

  const initialRow = ((data ?? [])[0] ?? null) as ManualRow | null;

  return (
    <main className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-xl font-semibold">Manual page editor</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Edit live manual content and version in
          <code className="mx-1 rounded bg-slate-100 px-1 dark:bg-slate-800">
            manual_pages
          </code>
          .
        </p>
      </section>

      <ManualEditorForm workspaceId={workspaceId} initialRow={initialRow} />
    </main>
  );
}
