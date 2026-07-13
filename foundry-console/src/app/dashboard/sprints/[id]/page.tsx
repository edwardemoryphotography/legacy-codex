"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useToast } from "@/components/toast";
import { logEvent } from "@/lib/events";
import { formatDateTime } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { useRequestGate } from "@/lib/use-request-gate";
import { LoadError } from "@/components/load-error";
import type { Sprint } from "@/lib/types";

const STATUSES = ["planned", "active", "completed", "cancelled"] as const;

export default function SprintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { current } = useWorkspace();
  const { toast } = useToast();
  const requestScope = current && id ? `${current.id}:${id}` : null;
  const requestGate = useRequestGate(requestScope);
  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    setSaving(false);
    if (!current || !id) return;
    const token = requestGate.begin();
    const workspaceId = current.id;
    const sprintId = id;
    const scope = `${workspaceId}:${sprintId}`;
    if (!requestGate.isScopeCurrent(scope)) return;
    setSprint(null);
    setNotFound(false);
    setLoadError(null);

    async function load() {
      try {
        const { data, error } = await createClient()
          .from("sprints")
          .select("*")
          .eq("id", sprintId)
          .eq("workspace_id", workspaceId)
          .maybeSingle();

        if (!requestGate.isCurrent(token, scope)) return;
        if (error) throw error;
        if (data) setSprint(data);
        else setNotFound(true);
      } catch (error) {
        if (!requestGate.isCurrent(token, scope)) return;
        const message = getErrorMessage(error);
        setLoadError(message);
        toast(message, "error");
      }
    }

    void load();
  }, [current, id, reloadNonce, requestGate, toast]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!sprint || !current) return;
    const workspaceId = current.id;
    const sprintId = sprint.id;
    const scope = `${workspaceId}:${sprintId}`;
    setSaving(true);
    try {
      const { error } = await createClient()
        .from("sprints")
        .update({
          title: sprint.title,
          goal: sprint.goal || null,
          status: sprint.status,
          start_date: sprint.start_date || null,
          end_date: sprint.end_date || null,
          notes: sprint.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sprintId)
        .eq("workspace_id", workspaceId);
      if (!requestGate.isScopeCurrent(scope)) return;
      if (error) throw error;
      void logEvent(workspaceId, "sprint.updated", "sprint", sprintId, {
        title: sprint.title,
        status: sprint.status,
      });
      toast("Sprint saved");
      router.push("/dashboard/sprints");
    } catch (error) {
      if (requestGate.isScopeCurrent(scope)) {
        toast(getErrorMessage(error), "error");
      }
    } finally {
      if (requestGate.isScopeCurrent(scope)) setSaving(false);
    }
  }

  if (loadError) {
    return (
      <LoadError
        message={loadError}
        onRetry={() => setReloadNonce((value) => value + 1)}
      />
    );
  }

  if (notFound) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-zinc-500">Sprint not found in this workspace.</p>
        <Link
          href="/dashboard/sprints"
          className="mt-3 inline-block text-sm font-medium text-indigo-400 hover:text-indigo-300"
        >
          Back to sprints
        </Link>
      </div>
    );
  }

  if (!sprint) {
    return (
      <div className="max-w-xl space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl border border-zinc-800/60 bg-zinc-900/40"
          />
        ))}
      </div>
    );
  }

  function update(field: keyof Sprint, value: string) {
    setSprint((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  return (
    <div className="animate-fade-up">
      <Link
        href="/dashboard/sprints"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Sprints
      </Link>

      <h2 className="mb-1 text-[22px] font-bold tracking-tight">{sprint.title}</h2>
      <p className="mb-6 text-[12px] text-zinc-600">
        Last updated {formatDateTime(sprint.updated_at)}
      </p>

      <form onSubmit={handleSave} className="max-w-xl space-y-5">
        <div>
          <label className="label">Title</label>
          <input
            required
            value={sprint.title}
            onChange={(e) => update("title", e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="label">Goal</label>
          <input
            value={sprint.goal ?? ""}
            onChange={(e) => update("goal", e.target.value)}
            placeholder="What does done look like?"
            className="input"
          />
        </div>

        <div>
          <label className="label">Status</label>
          <div className="grid grid-cols-4 gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => update("status", s)}
                className={`rounded-lg border px-2 py-2 text-[12.5px] font-medium capitalize transition-all ${
                  sprint.status === s
                    ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                    : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Start date</label>
            <input
              type="date"
              value={sprint.start_date ?? ""}
              onChange={(e) => update("start_date", e.target.value)}
              className="input [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="label">End date</label>
            <input
              type="date"
              value={sprint.end_date ?? ""}
              onChange={(e) => update("end_date", e.target.value)}
              className="input [color-scheme:dark]"
            />
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea
            rows={5}
            value={sprint.notes ?? ""}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Anything worth remembering about this sprint…"
            className="input resize-y"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save changes"}
          </button>
          <Link href="/dashboard/sprints" className="btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
