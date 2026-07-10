"use client";

import { useState } from "react";
import { Download, FileJson } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useToast } from "@/components/toast";
import { logEvent } from "@/lib/events";
import { PageHeader } from "@/components/page-header";
import { firstResultError, getErrorMessage } from "@/lib/errors";

export default function ExportPage() {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [lastCounts, setLastCounts] = useState<Record<string, number> | null>(
    null
  );

  async function handleExport() {
    if (!current) return;
    const workspace = { id: current.id, name: current.name };
    setExporting(true);
    setLastCounts(null);
    let objectUrl: string | null = null;

    try {
      const supabase = createClient();
      const [sprints, friction, milestones, events] = await Promise.all([
        supabase.from("sprints").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
        supabase.from("friction_entries").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
        supabase.from("milestones").select("*").eq("workspace_id", workspace.id).order("target_date", { ascending: true }),
        supabase.from("events").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
      ]);

      const queryError = firstResultError([sprints, friction, milestones, events]);
      if (queryError) throw queryError;

      const payload = {
        workspace,
        exported_at: new Date().toISOString(),
        sprints: sprints.data ?? [],
        friction_entries: friction.data ?? [],
        milestones: milestones.data ?? [],
        events: events.data ?? [],
      };
      const counts = {
        sprints: payload.sprints.length,
        friction: payload.friction_entries.length,
        milestones: payload.milestones.length,
        events: payload.events.length,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${workspace.name.replace(/\s+/g, "_").toLowerCase()}_export_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      setLastCounts(counts);
      void logEvent(workspace.id, "workspace.exported", "workspace", workspace.id, counts);
      toast("Export downloaded");
    } catch (error) {
      toast(getErrorMessage(error), "error");
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Export"
        description="Take your data with you — everything, as JSON."
      />

      <div className="card animate-fade-up max-w-lg p-6">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20">
          <FileJson className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold">
          {current?.name ?? "Workspace"} — full export
        </h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
          One JSON file containing every sprint, friction entry, milestone, and
          audit event in this workspace. Exactly what&apos;s in the database —
          nothing generated, nothing added.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting || !current}
          className="btn-primary mt-5"
        >
          <Download className="h-4 w-4" />
          {exporting ? "Exporting…" : "Download JSON"}
        </button>

        {lastCounts && (
          <div className="mt-5 grid grid-cols-4 gap-2 border-t border-zinc-800/80 pt-4">
            {Object.entries(lastCounts).map(([k, v]) => (
              <div key={k} className="text-center">
                <p className="text-lg font-bold tabular-nums">{v}</p>
                <p className="text-[11px] capitalize text-zinc-600">{k}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
