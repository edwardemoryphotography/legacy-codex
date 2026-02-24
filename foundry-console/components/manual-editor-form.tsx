"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";

const CONTENT_CANDIDATE_KEYS = ["content", "body", "markdown", "text"];

function detectContentKey(row: Record<string, unknown> | null) {
  if (!row) {
    return "content";
  }

  const foundKey = CONTENT_CANDIDATE_KEYS.find((key) => key in row);
  return foundKey ?? "content";
}

function parseJsonObject(raw: string) {
  if (!raw.trim()) {
    return {};
  }

  const parsed = JSON.parse(raw);

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Additional fields must be a JSON object.");
  }

  return parsed as Record<string, unknown>;
}

export function ManualEditorForm({
  workspaceId,
  initialRow,
}: {
  workspaceId: string;
  initialRow: Record<string, unknown> | null;
}) {
  const router = useRouter();
  const supabase = getBrowserClient();

  const contentKey = useMemo(() => detectContentKey(initialRow), [initialRow]);
  const [version, setVersion] = useState(
    String(initialRow?.version ?? initialRow?.manual_version ?? ""),
  );
  const [content, setContent] = useState(
    String(initialRow?.[contentKey] ?? ""),
  );
  const [extraJson, setExtraJson] = useState("{}");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const extra = parseJsonObject(extraJson);
      const payload: Record<string, unknown> = {
        ...(initialRow ?? {}),
        ...extra,
        workspace_id: workspaceId,
        version,
        [contentKey]: content,
      };

      const query = supabase.from("manual_pages");
      let saveErrorMessage: string | null = null;

      if (initialRow) {
        const { error: updateError } = await query
          .update(payload)
          .eq("workspace_id", workspaceId);
        saveErrorMessage = updateError?.message ?? null;
      } else {
        const { error: insertError } = await query.insert(payload);
        saveErrorMessage = insertError?.message ?? null;
      }

      if (saveErrorMessage) {
        throw new Error(saveErrorMessage);
      }

      setMessage("Manual page saved.");
      router.refresh();
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save manual page.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Manual page</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Version is explicit and required by this console.
          </p>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-slate-200 dark:text-slate-900"
        >
          {busy ? "Saving..." : "Save manual"}
        </button>
      </div>

      <div className="space-y-1">
        <label htmlFor="manual-version" className="text-sm font-medium">
          Version
        </label>
        <input
          id="manual-version"
          required
          value={version}
          onChange={(event) => setVersion(event.target.value)}
          className="w-full rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="manual-content" className="text-sm font-medium">
          Content ({contentKey})
        </label>
        <textarea
          id="manual-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={14}
          className="w-full rounded-md p-3 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="manual-extra" className="text-sm font-medium">
          Additional fields (JSON object)
        </label>
        <textarea
          id="manual-extra"
          value={extraJson}
          onChange={(event) => setExtraJson(event.target.value)}
          rows={6}
          spellCheck={false}
          className="w-full rounded-md p-3 font-mono text-xs"
        />
      </div>

      {message ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
          {error}
        </p>
      ) : null}
    </form>
  );
}
