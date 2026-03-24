"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { PageHeader } from "@/components/page-header";
import type { Sprint } from "@/lib/types";

const STATUSES = ["planned", "active", "completed", "cancelled"] as const;

export default function SprintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { current } = useWorkspace();
  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!current || !id) return;
    const supabase = createClient();
    supabase
      .from("sprints")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", current.id)
      .single()
      .then(({ data }) => {
        setSprint(data);
        setLoading(false);
      });
  }, [current, id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!sprint) return;
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("sprints")
      .update({
        title: sprint.title,
        goal: sprint.goal,
        status: sprint.status,
        start_date: sprint.start_date || null,
        end_date: sprint.end_date || null,
        notes: sprint.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sprint.id);
    setSaving(false);
    router.push("/dashboard/sprints");
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;
  if (!sprint) return <p className="text-sm text-red-400">Sprint not found.</p>;

  function update(field: keyof Sprint, value: string) {
    setSprint((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  return (
    <>
      <PageHeader title="Edit Sprint" />
      <form onSubmit={handleSave} className="max-w-lg space-y-4">
        <Field label="Title">
          <input
            required
            value={sprint.title}
            onChange={(e) => update("title", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Goal">
          <input
            value={sprint.goal ?? ""}
            onChange={(e) => update("goal", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Status">
          <select
            value={sprint.status}
            onChange={(e) => update("status", e.target.value)}
            className="input"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start Date">
            <input
              type="date"
              value={sprint.start_date ?? ""}
              onChange={(e) => update("start_date", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="End Date">
            <input
              type="date"
              value={sprint.end_date ?? ""}
              onChange={(e) => update("end_date", e.target.value)}
              className="input"
            />
          </Field>
        </div>
        <Field label="Notes">
          <textarea
            rows={4}
            value={sprint.notes ?? ""}
            onChange={(e) => update("notes", e.target.value)}
            className="input resize-y"
          />
        </Field>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/sprints")}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
