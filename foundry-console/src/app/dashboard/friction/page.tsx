"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import type { FrictionEntry } from "@/lib/types";

const SEVERITIES = ["low", "medium", "high", "critical"] as const;

export default function FrictionPage() {
  const { current } = useWorkspace();
  const [entries, setEntries] = useState<FrictionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("medium");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    if (!current) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("friction_entries")
      .select("*")
      .eq("workspace_id", current.id)
      .order("created_at", { ascending: false });
    setEntries(data ?? []);
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("friction_entries").insert({
      workspace_id: current.id,
      title,
      description: description || null,
      severity,
      created_by: user?.id ?? null,
    });
    setTitle("");
    setDescription("");
    setSeverity("medium");
    setShowForm(false);
    setSubmitting(false);
    load();
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <>
      <PageHeader
        title="Friction Log"
        description="Track friction points encountered during work."
        action={
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            {showForm ? "Cancel" : "Add Entry"}
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
              placeholder="What's the friction?"
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
              rows={3}
              placeholder="Details (optional)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Severity
            </label>
            <select
              value={severity}
              onChange={(e) =>
                setSeverity(e.target.value as (typeof SEVERITIES)[number])
              }
              className="input"
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
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

      {entries.length === 0 ? (
        <EmptyState message="No friction entries yet." />
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{entry.title}</p>
                <div className="flex items-center gap-2">
                  <StatusBadge value={entry.severity} />
                  <StatusBadge value={entry.status} />
                </div>
              </div>
              {entry.description && (
                <p className="mt-1 text-xs text-zinc-400">
                  {entry.description}
                </p>
              )}
              <p className="mt-1 text-xs text-zinc-600">
                {new Date(entry.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
