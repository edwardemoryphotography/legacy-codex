"use client";

import { useEffect, useState, useCallback } from "react";
import { Flame, Plus, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useToast } from "@/components/toast";
import { logEvent } from "@/lib/events";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { ListSkeleton } from "@/components/skeleton";
import { LoadError } from "@/components/load-error";
import { timeAgo } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { useRequestGate } from "@/lib/use-request-gate";
import type { FrictionEntry } from "@/lib/types";

const SEVERITIES = ["low", "medium", "high", "critical"] as const;

export default function FrictionPage() {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const requestGate = useRequestGate();
  const [entries, setEntries] = useState<FrictionEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] =
    useState<(typeof SEVERITIES)[number]>("medium");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!current) return;
    const token = requestGate.begin();
    const workspaceId = current.id;
    setLoadError(null);
    try {
      const { data, error } = await createClient()
        .from("friction_entries")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (!requestGate.isCurrent(token)) return;
      if (error) throw error;
      setEntries(data ?? []);
    } catch (error) {
      if (!requestGate.isCurrent(token)) return;
      const message = getErrorMessage(error);
      setLoadError(message);
      toast(message, "error");
    }
  }, [current, requestGate, toast]);

  useEffect(() => {
    setEntries(null);
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!current || !title.trim()) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("friction_entries")
      .insert({
        workspace_id: current.id,
        title: title.trim(),
        description: description.trim() || null,
        severity,
      })
      .select()
      .single();
    setBusy(false);
    if (error) {
      toast(error.message, "error");
      return;
    }
    logEvent(current.id, "friction.logged", "friction_entry", data.id, {
      title: data.title,
      severity,
    });
    toast("Friction logged");
    setTitle("");
    setDescription("");
    setSeverity("medium");
    setShowForm(false);
    load();
  }

  async function handleResolve(entry: FrictionEntry) {
    if (!current) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("friction_entries")
      .update({ status: "resolved" })
      .eq("id", entry.id);
    if (error) {
      toast(error.message, "error");
      return;
    }
    logEvent(current.id, "friction.resolved", "friction_entry", entry.id, {
      title: entry.title,
    });
    toast("Marked resolved");
    load();
  }

  return (
    <>
      <PageHeader
        title="Friction"
        description="Capture what slowed you down, the moment it happens."
        action={
          <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
            <Plus className="h-4 w-4" />
            Log friction
          </button>
        }
      />

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="card animate-fade-up mb-5 space-y-4 p-5"
        >
          <div>
            <label className="label">What happened?</label>
            <input
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary of the friction"
              className="input"
            />
          </div>
          <div>
            <label className="label">Details</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Context, impact, or ideas to fix it (optional)"
              className="input resize-y"
            />
          </div>
          <div>
            <label className="label">Severity</label>
            <div className="grid grid-cols-4 gap-1.5">
              {SEVERITIES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  className={`rounded-lg border px-2 py-2 text-[12.5px] font-medium capitalize transition-all ${
                    severity === s
                      ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                      : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || !title.trim()}
              className="btn-primary"
            >
              {busy ? "Logging…" : "Log it"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn-ghost"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loadError ? (
        <LoadError message={loadError} onRetry={() => void load()} />
      ) : entries === null ? (
        <ListSkeleton />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Flame className="h-5 w-5" />}
          title="No friction logged"
          message="When something slows you down, log it here so patterns become visible."
          action={
            !showForm ? (
              <button onClick={() => setShowForm(true)} className="btn-primary">
                <Plus className="h-4 w-4" />
                Log friction
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="animate-fade-up space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="card px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{entry.title}</p>
                  {entry.description && (
                    <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
                      {entry.description}
                    </p>
                  )}
                  <p className="mt-1.5 text-[12px] text-zinc-600">
                    {timeAgo(entry.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="flex items-center gap-1.5">
                    <StatusBadge value={entry.severity} />
                    <StatusBadge value={entry.status} />
                  </div>
                  {entry.status === "open" && (
                    <button
                      onClick={() => handleResolve(entry)}
                      className="flex items-center gap-1 text-[12px] font-medium text-emerald-400 transition-colors hover:text-emerald-300"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
