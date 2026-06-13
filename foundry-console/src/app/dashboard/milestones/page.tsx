"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import type { Milestone } from "@/lib/types";

export default function MilestonesPage() {
  const { current } = useWorkspace();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    if (!current) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("milestones")
      .select("*")
      .eq("workspace_id", current.id)
      .order("target_date", { ascending: true });
    setMilestones(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return;
    setSubmitting(true);
    const supabase = createClient();
    await supabase.from("milestones").insert({
      workspace_id: current.id,
      title,
      description: description || null,
      target_date: targetDate || null,
    });
    setTitle("");
    setDescription("");
    setTargetDate("");
    setShowForm(false);
    setSubmitting(false);
    load();
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <>
      <PageHeader
        title="Milestones"
        description="Timeline of project milestones."
        action={
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            {showForm ? "Cancel" : "Add Milestone"}
          </button>
        }
      />

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3"
        >
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Title
            </label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="Milestone title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input resize-y"
              rows={2}
              placeholder="Details (optional)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Target Date
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="input"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting ? "Adding…" : "Add"}
          </button>
        </form>
      )}

      {milestones.length === 0 ? (
        <EmptyState message="No milestones yet." />
      ) : (
        <div className="relative ml-4 border-l border-zinc-700 space-y-6 pl-6">
          {milestones.map((m) => (
            <div key={m.id} className="relative">
              <div className="absolute -left-[1.56rem] top-1 h-3 w-3 rounded-full border-2 border-zinc-700 bg-zinc-900" />
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{m.title}</p>
                  {m.completed_at && (
                    <span className="text-xs text-emerald-400">Completed</span>
                  )}
                </div>
                {m.description && (
                  <p className="mt-1 text-xs text-zinc-400">{m.description}</p>
                )}
                {m.target_date && (
                  <p className="mt-1 text-xs text-zinc-500">
                    Target: {m.target_date}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
