"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";

function parseObjectInput(input: string) {
  const parsed = JSON.parse(input);

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Input must be a JSON object.");
  }

  return parsed as Record<string, unknown>;
}

export function JsonInsertForm({
  tableName,
  workspaceId,
  title,
}: {
  tableName: string;
  workspaceId: string;
  title: string;
}) {
  const router = useRouter();
  const supabase = getBrowserClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState("{}");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const payload = parseObjectInput(jsonInput);
      const insertData = { workspace_id: workspaceId, ...payload };

      const { error: insertError } = await supabase
        .from(tableName)
        .insert(insertData);

      if (insertError) {
        throw insertError;
      }

      setMessage(`${title} created.`);
      setJsonInput("{}");
      router.refresh();
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create record.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Add {title}</h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            Enter a real JSON object for this table. The console adds
            <code className="mx-1 rounded bg-slate-100 px-1 dark:bg-slate-800">
              workspace_id
            </code>
            automatically.
          </p>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 dark:bg-slate-200 dark:text-slate-900"
        >
          {busy ? "Saving..." : "Save"}
        </button>
      </div>

      <textarea
        value={jsonInput}
        onChange={(event) => setJsonInput(event.target.value)}
        rows={8}
        className="w-full rounded-md p-3 font-mono text-xs"
        spellCheck={false}
      />

      {message ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
          {error}
        </p>
      ) : null}
    </form>
  );
}
