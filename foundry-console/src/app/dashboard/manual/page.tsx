"use client";

import { useEffect, useState, useCallback } from "react";
import { BookOpen, Plus, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useToast } from "@/components/toast";
import { logEvent } from "@/lib/events";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/skeleton";
import { formatDateTime } from "@/lib/format";
import type { ManualPage } from "@/lib/types";

export default function ManualPageView() {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const [pages, setPages] = useState<ManualPage[] | null>(null);
  const [editing, setEditing] = useState<ManualPage | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!current) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("manual")
      .select("*")
      .eq("workspace_id", current.id)
      .order("title");
    setPages(data ?? []);
  }, [current]);

  useEffect(() => {
    setPages(null);
    setEditing(null);
    setCreating(false);
    load();
  }, [load]);

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !current) return;
    setSaving(true);
    const supabase = createClient();
    const newVersion = editing.version + 1;
    const { error } = await supabase
      .from("manual")
      .update({
        title: editing.title,
        content: editing.content,
        version: newVersion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast(error.message, "error");
      return;
    }
    logEvent(current.id, "manual.updated", "manual", editing.id, {
      title: editing.title,
      version: newVersion,
    });
    toast(`Saved as v${newVersion}`);
    setEditing(null);
    load();
  }

  async function handleCreate(title: string, content: string) {
    if (!current) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("manual")
      .insert({
        workspace_id: current.id,
        title,
        content: content || null,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast(error.message, "error");
      return;
    }
    logEvent(current.id, "manual.created", "manual", data.id, { title });
    toast("Page created");
    setCreating(false);
    load();
  }

  if (editing) {
    return (
      <>
        <PageHeader
          title={`Edit — ${editing.title}`}
          description={`Currently v${editing.version}. Saving creates v${editing.version + 1}.`}
        />
        <form onSubmit={handleSaveEdit} className="max-w-2xl space-y-5">
          <div>
            <label className="label">Title</label>
            <input
              required
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Content</label>
            <textarea
              rows={16}
              value={editing.content ?? ""}
              onChange={(e) =>
                setEditing({ ...editing, content: e.target.value })
              }
              className="input resize-y font-mono text-[13px] leading-relaxed"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving…" : `Save as v${editing.version + 1}`}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="btn-ghost"
            >
              Cancel
            </button>
          </div>
        </form>
      </>
    );
  }

  if (creating) {
    return (
      <NewPageForm
        saving={saving}
        onCancel={() => setCreating(false)}
        onSubmit={handleCreate}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Manual"
        description="Living documentation with a version counter on every save."
        action={
          <button onClick={() => setCreating(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            New page
          </button>
        }
      />

      {pages === null ? (
        <ListSkeleton />
      ) : pages.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="No manual pages"
          message="Write down how this project works — every edit bumps the version."
          action={
            <button onClick={() => setCreating(true)} className="btn-primary">
              <Plus className="h-4 w-4" />
              New page
            </button>
          }
        />
      ) : (
        <div className="animate-fade-up space-y-3">
          {pages.map((p) => (
            <article key={p.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">{p.title}</h3>
                  <p className="mt-0.5 text-[12px] text-zinc-600">
                    <span className="mr-2 rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">
                      v{p.version}
                    </span>
                    Updated {formatDateTime(p.updated_at)}
                  </p>
                </div>
                <button
                  onClick={() => setEditing(p)}
                  className="btn-ghost px-3 py-1.5 text-[12.5px]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              </div>
              {p.content && (
                <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-zinc-300">
                  {p.content}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function NewPageForm({
  saving,
  onCancel,
  onSubmit,
}: {
  saving: boolean;
  onCancel: () => void;
  onSubmit: (title: string, content: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  return (
    <>
      <PageHeader
        title="New manual page"
        description="Starts at v1. Every subsequent edit bumps the version."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) onSubmit(title.trim(), content.trim());
        }}
        className="max-w-2xl space-y-5"
      >
        <div>
          <label className="label">Title</label>
          <input
            autoFocus
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Operating principles"
            className="input"
          />
        </div>
        <div>
          <label className="label">Content</label>
          <textarea
            rows={12}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write the page…"
            className="input resize-y font-mono text-[13px] leading-relaxed"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="btn-primary"
          >
            {saving ? "Creating…" : "Create page"}
          </button>
          <button type="button" onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
