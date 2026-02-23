"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import type { ManualPage } from "@/lib/types";

export default function ManualPageView() {
  const { current, currentRole } = useWorkspace();
  const [pages, setPages] = useState<ManualPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ManualPage | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!current) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("manual")
      .select("*")
      .eq("workspace_id", current.id)
      .order("title");
    setPages(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase
      .from("manual")
      .update({
        title: editing.title,
        content: editing.content,
        version: editing.version + 1,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editing.id);
    setEditing(null);
    setSaving(false);
    load();
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  if (editing) {
    return (
      <>
        <PageHeader title={`Edit: ${editing.title}`} />
        <form onSubmit={handleSave} className="max-w-2xl space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Title
            </label>
            <input
              required
              value={editing.title}
              onChange={(e) =>
                setEditing({ ...editing, title: e.target.value })
              }
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Content
            </label>
            <textarea
              value={editing.content ?? ""}
              onChange={(e) =>
                setEditing({ ...editing, content: e.target.value })
              }
              className="input resize-y font-mono text-sm"
              rows={16}
            />
          </div>
          <p className="text-xs text-zinc-500">
            Current version: {editing.version} — saving will increment to{" "}
            {editing.version + 1}
          </p>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </form>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Manual"
        description="Documentation pages for this workspace."
      />
      {pages.length === 0 ? (
        <EmptyState message="No manual pages yet." />
      ) : (
        <div className="space-y-3">
          {pages.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{p.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    v{p.version} — updated{" "}
                    {new Date(p.updated_at).toLocaleString()}
                  </p>
                </div>
                {currentRole === "admin" && (
                  <button
                    onClick={() => setEditing(p)}
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    Edit
                  </button>
                )}
              </div>
              {p.content && (
                <p className="mt-2 text-sm text-zinc-300 whitespace-pre-wrap">
                  {p.content}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
