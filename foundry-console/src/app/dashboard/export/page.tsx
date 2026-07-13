"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileJson } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useToast } from "@/components/toast";
import { logEvent } from "@/lib/events";
import { PageHeader } from "@/components/page-header";
import { getErrorMessage } from "@/lib/errors";
import {
  buildExportPayload,
  createExportFilename,
  EXPORT_DATASETS,
} from "@/lib/export";
import { useRequestGate } from "@/lib/use-request-gate";

export default function ExportPage() {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const requestGate = useRequestGate(current?.id ?? null);
  const exportingRef = useRef<symbol | null>(null);
  const [exporting, setExporting] = useState(false);
  const [lastCounts, setLastCounts] = useState<Record<string, number> | null>(
    null
  );

  useEffect(() => {
    exportingRef.current = null;
    setExporting(false);
    setLastCounts(null);
  }, [current?.id]);

  async function handleExport() {
    if (!current || exportingRef.current) return;
    const workspace = { id: current.id, name: current.name };
    const token = requestGate.begin();
    const operation = Symbol("export");
    exportingRef.current = operation;
    setExporting(true);
    setLastCounts(null);
    let objectUrl: string | null = null;

    try {
      const supabase = createClient();
      const [sprints, friction, milestones, manual, settings, events] = await Promise.all([
        supabase.from("sprints").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
        supabase.from("friction_entries").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
        supabase.from("milestones").select("*").eq("workspace_id", workspace.id).order("target_date", { ascending: true }),
        supabase.from("manual").select("*").eq("workspace_id", workspace.id).order("title", { ascending: true }),
        supabase.from("settings").select("*").eq("workspace_id", workspace.id),
        supabase.from("events").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
      ]);

      if (!requestGate.isCurrent(token, workspace.id)) return;
      const exportedAt = new Date().toISOString();
      const results = [sprints, friction, milestones, manual, settings, events];
      const payload = buildExportPayload(workspace, exportedAt, results);
      const counts = Object.fromEntries(
        EXPORT_DATASETS.map((dataset) => [
          dataset,
          (payload[dataset] as unknown[]).length,
        ])
      );

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = createExportFilename(workspace.name, exportedAt);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      setLastCounts(counts);
      void logEvent(workspace.id, "workspace.exported", "workspace", workspace.id, counts);
      toast("Export downloaded");
    } catch (error) {
      if (requestGate.isScopeCurrent(workspace.id)) {
        toast(getErrorMessage(error), "error");
      }
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (exportingRef.current === operation) {
        exportingRef.current = null;
        setExporting(false);
      }
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
          One JSON file containing every sprint, friction entry, milestone,
          manual page, settings row, and audit event in this workspace. Exactly what&apos;s in the database —
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
          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-zinc-800/80 pt-4 sm:grid-cols-3">
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
