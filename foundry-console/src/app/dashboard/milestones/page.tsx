"use client";

import { useEffect, useState, useCallback } from "react";
import { Flag, Plus, CheckCircle2, Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useToast } from "@/components/toast";
import { logEvent } from "@/lib/events";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/skeleton";
import { LoadError } from "@/components/load-error";
import { formatDate } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { useRequestGate } from "@/lib/use-request-gate";
import type { Milestone } from "@/lib/types";

export default function MilestonesPage() {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const requestGate = useRequestGate(current?.id ?? null);
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!current) return;
    const token = requestGate.begin();
    const workspaceId = current.id;
    if (!requestGate.isScopeCurrent(workspaceId)) return;
    setLoadError(null);
    try {
      const { data, error } = await createClient()
        .from("milestones")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("target_date", { ascending: true, nullsFirst: false });
      if (!requestGate.isCurrent(token, workspaceId)) return;
      if (error) throw error;
      setMilestones(data ?? []);
    } catch (error) {
      if (!requestGate.isCurrent(token, workspaceId)) return;
      const message = getErrorMessage(error);
      setLoadError(message);
      toast(message, "error");
    }
  }, [current, requestGate, toast]);

  useEffect(() => {
    setMilestones(null);
    setBusy(false);
    setShowForm(false);
    setTitle("");
    setDescription("");
    setTargetDate("");
    void load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!current || !title.trim()) return;
    const workspaceId = current.id;
    setBusy(true);
    try {
      const { data, error } = await createClient()
        .from("milestones")
        .insert({
          workspace_id: workspaceId,
          title: title.trim(),
          description: description.trim() || null,
          target_date: targetDate || null,
        })
        .select()
        .single();
      if (!requestGate.isScopeCurrent(workspaceId)) return;
      if (error) throw error;
      if (!data) throw new Error("Supabase returned no milestone row.");
      void logEvent(workspaceId, "milestone.created", "milestone", data.id, {
        title: data.title,
      });
      toast("Milestone added");
      setTitle("");
      setDescription("");
      setTargetDate("");
      setShowForm(false);
      void load();
    } catch (error) {
      if (requestGate.isScopeCurrent(workspaceId)) {
        toast(getErrorMessage(error), "error");
      }
    } finally {
      if (requestGate.isScopeCurrent(workspaceId)) setBusy(false);
    }
  }

  async function toggleComplete(m: Milestone) {
    if (!current) return;
    const workspaceId = current.id;
    const completed = !m.completed_at;
    try {
      const { error } = await createClient()
        .from("milestones")
        .update({ completed_at: completed ? new Date().toISOString() : null })
        .eq("id", m.id)
        .eq("workspace_id", workspaceId);
      if (!requestGate.isScopeCurrent(workspaceId)) return;
      if (error) throw error;
      void logEvent(
        workspaceId,
        completed ? "milestone.completed" : "milestone.reopened",
        "milestone",
        m.id,
        { title: m.title }
      );
      toast(completed ? "Milestone completed" : "Milestone reopened");
      void load();
    } catch (error) {
      if (requestGate.isScopeCurrent(workspaceId)) {
        toast(getErrorMessage(error), "error");
      }
    }
  }

  return (
    <>
      <PageHeader
        title="Milestones"
        description="The waypoints that mark real progress."
        action={
          <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
            <Plus className="h-4 w-4" />
            Add milestone
          </button>
        }
      />

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="card animate-fade-up mb-5 space-y-4 p-5"
        >
          <div>
            <label className="label">Title</label>
            <input
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="First deploy live"
              className="input"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes this milestone meaningful? (optional)"
              className="input resize-y"
            />
          </div>
          <div>
            <label className="label">Target date</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="input [color-scheme:dark]"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || !title.trim()}
              className="btn-primary"
            >
              {busy ? "Adding…" : "Add"}
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
      ) : milestones === null ? (
        <ListSkeleton />
      ) : milestones.length === 0 ? (
        <EmptyState
          icon={<Flag className="h-5 w-5" />}
          title="No milestones yet"
          message="Add the waypoints you're building toward. Completed ones stay on the timeline."
          action={
            !showForm ? (
              <button onClick={() => setShowForm(true)} className="btn-primary">
                <Plus className="h-4 w-4" />
                Add milestone
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="animate-fade-up relative ml-2.5 space-y-4 border-l border-zinc-800 pl-6">
          {milestones.map((m) => {
            const done = !!m.completed_at;
            return (
              <div key={m.id} className="relative">
                <button
                  onClick={() => toggleComplete(m)}
                  className="absolute -left-[2.22rem] top-3.5 rounded-full bg-zinc-950 p-0.5"
                  aria-label={done ? "Reopen milestone" : "Complete milestone"}
                >
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <Circle className="h-5 w-5 text-zinc-700 transition-colors hover:text-zinc-500" />
                  )}
                </button>
                <div
                  className={`card px-4 py-3.5 transition-opacity ${
                    done ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p
                      className={`text-sm font-semibold ${
                        done ? "text-zinc-400 line-through decoration-zinc-600" : ""
                      }`}
                    >
                      {m.title}
                    </p>
                    {m.target_date && (
                      <span
                        className={`shrink-0 text-[12px] font-medium ${
                          done ? "text-zinc-600" : "text-emerald-400"
                        }`}
                      >
                        {formatDate(m.target_date)}
                      </span>
                    )}
                  </div>
                  {m.description && (
                    <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
                      {m.description}
                    </p>
                  )}
                  {done && (
                    <p className="mt-1.5 text-[12px] text-zinc-600">
                      Completed {formatDate(m.completed_at)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
