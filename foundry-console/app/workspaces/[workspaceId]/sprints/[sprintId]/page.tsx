import Link from "next/link";
import { notFound } from "next/navigation";
import { SprintEditorForm } from "@/components/sprint-editor-form";
import { requireUser } from "@/lib/auth";
import { requireWorkspaceAccess } from "@/lib/workspace";

type SprintRow = Record<string, unknown>;

export default async function SprintDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; sprintId: string }>;
}) {
  const { workspaceId, sprintId } = await params;
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
    .eq("id", sprintId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    notFound();
  }

  const sprint = data as SprintRow;

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Sprint detail</h2>
        <Link
          href={`/workspaces/${workspaceId}/sprints`}
          className="text-sm underline"
        >
          Back to sprints
        </Link>
      </div>

      <SprintEditorForm workspaceId={workspaceId} sprintId={sprintId} sprint={sprint} />
    </main>
  );
}
