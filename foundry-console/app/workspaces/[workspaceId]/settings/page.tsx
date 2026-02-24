import { SettingsForm } from "@/components/settings-form";
import { requireUser } from "@/lib/auth";
import { requireWorkspaceAccess } from "@/lib/workspace";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { supabase, user } = await requireUser();
  const { workspace, isAdmin } = await requireWorkspaceAccess({
    supabase,
    userId: user.id,
    workspaceId,
  });

  if (!isAdmin) {
    return (
      <main className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-xl font-semibold">Admin only</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Settings can only be changed by admin roles in
          <code className="mx-1 rounded bg-slate-100 px-1 dark:bg-slate-800">
            workspace_members
          </code>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Toggle workspace controls directly in
          <code className="mx-1 rounded bg-slate-100 px-1 dark:bg-slate-800">
            workspaces
          </code>
          .
        </p>
      </section>

      <SettingsForm
        workspaceId={workspaceId}
        initialKillSwitchAi={Boolean(workspace.kill_switch_ai)}
        initialPiiWarningEnabled={Boolean(workspace.pii_warning_enabled)}
      />
    </main>
  );
}
