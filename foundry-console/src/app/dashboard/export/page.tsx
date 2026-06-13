"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { PageHeader } from "@/components/page-header";

export default function ExportPage() {
  const { current } = useWorkspace();
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!current) return;
    setExporting(true);
    const supabase = createClient();

    const [sprints, friction, milestones, events] = await Promise.all([
      supabase
        .from("sprints")
        .select("*")
        .eq("workspace_id", current.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("friction_entries")
        .select("*")
        .eq("workspace_id", current.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("milestones")
        .select("*")
        .eq("workspace_id", current.id)
        .order("target_date", { ascending: true }),
      supabase
        .from("events")
        .select("*")
        .eq("workspace_id", current.id)
        .order("created_at", { ascending: false }),
    ]);

    const payload = {
      workspace: {
        id: current.id,
        name: current.name,
      },
      exported_at: new Date().toISOString(),
      sprints: sprints.data ?? [],
      friction_entries: friction.data ?? [],
      milestones: milestones.data ?? [],
      events: events.data ?? [],
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${current.name.replace(/\s+/g, "_").toLowerCase()}_export.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  return (
    <>
      <PageHeader
        title="Export"
        description="Download workspace data as JSON."
      />
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 max-w-md">
        <p className="text-sm text-zinc-300 mb-4">
          Export all sprints, friction entries, milestones, and audit events for{" "}
          <strong>{current?.name ?? "this workspace"}</strong> as a single JSON
          file.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting || !current}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {exporting ? "Exporting…" : "Export JSON"}
        </button>
      </div>
    </>
  );
}
