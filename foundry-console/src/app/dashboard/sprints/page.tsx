"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Rocket, Plus, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useToast } from "@/components/toast";
import { logEvent } from "@/lib/events";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { ListSkeleton } from "@/components/skeleton";
import { formatDate } from "@/lib/format";
import type { Sprint } from "@/lib/types";

export default function SprintsPage() {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const [sprints, setSprints] = useState<Sprint[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!current) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("sprints")
      .select("*")
      .eq("workspace_id", current.id)
      .order("created_at", { ascending: false });
    setSprints(data ?? []);
  }, [current]);

  useEffect(() => {
    setSprints(null);
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!current || !title.trim()) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("sprints")
      .insert({
        workspace_id: current.id,
        title: title.trim(),
        goal: goal.trim() || null,
      })
      .select()
      .single();
    setBusy(false);
    if (error) {
      toast(error.message, "error");
      return;
    }
    logEvent(current.id, "sprint.created", "sprint", data.id, {
      title: data.title,
    });
    toast("Sprint created");
    setTitle("");
    setGoal("");
    setShowForm(false);
    load();
  }

  return (
    <>
      <PageHeader
        title="Sprints"
        description="Plan, run, and close out focused work cycles."
        action={
          <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
            <Plus className="h-4 w-4" />
            New sprint
          </button>
        }
      />

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="card animate-fade-up mb-5 space-y-4 p-5"
        >
          <div>
            <label className="label">Title</label>
            <input
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sprint 1 — Foundation"
              className="input"
            />
          </div>
          <div>
            <label className="label">Goal</label>
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What does done look like? (optional)"
              className="input"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !title.trim()} className="btn-primary">
              {busy ? "Creating…" : "Create"}
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

      {sprints === null ? (
        <ListSkeleton />
      ) : sprints.length === 0 ? (
        <EmptyState
          icon={<Rocket className="h-5 w-5" />}
          title="No sprints yet"
          message="Create your first sprint to start tracking focused work cycles."
          action={
            !showForm ? (
              <button onClick={() => setShowForm(true)} className="btn-primary">
                <Plus className="h-4 w-4" />
                New sprint
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="animate-fade-up space-y-2">
          {sprints.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/sprints/${s.id}`}
              className="card group flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:border-zinc-700"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{s.title}</p>
                {s.goal && (
                  <p className="mt-0.5 truncate text-[13px] text-zinc-500">
                    {s.goal}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {(s.start_date || s.end_date) && (
                  <span className="hidden text-[12px] text-zinc-600 sm:inline">
                    {formatDate(s.start_date)} → {formatDate(s.end_date)}
                  </span>
                )}
                <StatusBadge value={s.status} />
                <ChevronRight className="h-4 w-4 text-zinc-700 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-500" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
