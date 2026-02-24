"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";

type SprintRow = Record<string, unknown>;
type FieldKind = "boolean" | "number" | "json" | "string" | "null";

type FieldDraft = {
  kind: FieldKind;
  value: string | boolean;
  immutable: boolean;
};

function inferFieldDraft(value: unknown, immutable: boolean): FieldDraft {
  if (typeof value === "boolean") {
    return { kind: "boolean", value, immutable };
  }

  if (typeof value === "number") {
    return { kind: "number", value: String(value), immutable };
  }

  if (value === null) {
    return { kind: "null", value: "", immutable };
  }

  if (typeof value === "object") {
    return {
      kind: "json",
      value: JSON.stringify(value, null, 2),
      immutable,
    };
  }

  return {
    kind: "string",
    value: String(value),
    immutable,
  };
}

function parseFieldValue(field: FieldDraft) {
  switch (field.kind) {
    case "boolean":
      return Boolean(field.value);
    case "number": {
      const num = Number(field.value);
      if (Number.isNaN(num)) {
        throw new Error("A numeric field has an invalid value.");
      }
      return num;
    }
    case "json":
      return JSON.parse(String(field.value));
    case "null": {
      const trimmed = String(field.value).trim();
      if (!trimmed) {
        return null;
      }

      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    }
    case "string":
    default:
      return String(field.value);
  }
}

export function SprintEditorForm({
  workspaceId,
  sprintId,
  sprint,
}: {
  workspaceId: string;
  sprintId: string;
  sprint: SprintRow;
}) {
  const router = useRouter();
  const supabase = getBrowserClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [fields, setFields] = useState<Record<string, FieldDraft>>(() => {
    const entries = Object.entries(sprint).map(([key, value]) => {
      const immutable = key === "id";
      return [key, inferFieldDraft(value, immutable)];
    });

    return Object.fromEntries(entries);
  });

  const orderedKeys = useMemo(() => Object.keys(fields).sort(), [fields]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const payload: Record<string, unknown> = {};

      for (const key of orderedKeys) {
        const field = fields[key];
        if (!field || field.immutable) {
          continue;
        }

        payload[key] = parseFieldValue(field);
      }

      const { error: updateError } = await supabase
        .from("sprints")
        .update(payload)
        .eq("workspace_id", workspaceId)
        .eq("id", sprintId);

      if (updateError) {
        throw updateError;
      }

      setMessage("Sprint updated.");
      router.refresh();
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to update sprint.",
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
          <h2 className="text-lg font-semibold">Sprint editor</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Editable fields are loaded directly from the sprint row. The primary
            key is read-only.
          </p>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-slate-200 dark:text-slate-900"
        >
          {busy ? "Saving..." : "Save sprint"}
        </button>
      </div>

      <div className="space-y-3">
        {orderedKeys.map((key) => {
          const field = fields[key];
          if (!field) {
            return null;
          }

          return (
            <div key={key} className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {key}
              </label>

              {field.kind === "boolean" ? (
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(field.value)}
                    disabled={field.immutable}
                    onChange={(event) =>
                      setFields((prev) => ({
                        ...prev,
                        [key]: {
                          ...field,
                          value: event.target.checked,
                        },
                      }))
                    }
                  />
                  <span>{Boolean(field.value) ? "true" : "false"}</span>
                </label>
              ) : field.kind === "json" ? (
                <textarea
                  value={String(field.value)}
                  disabled={field.immutable}
                  onChange={(event) =>
                    setFields((prev) => ({
                      ...prev,
                      [key]: {
                        ...field,
                        value: event.target.value,
                      },
                    }))
                  }
                  rows={6}
                  className="w-full rounded-md p-3 font-mono text-xs"
                  spellCheck={false}
                />
              ) : (
                <input
                  type={field.kind === "number" ? "number" : "text"}
                  value={String(field.value)}
                  disabled={field.immutable}
                  onChange={(event) =>
                    setFields((prev) => ({
                      ...prev,
                      [key]: {
                        ...field,
                        value: event.target.value,
                      },
                    }))
                  }
                  className="w-full rounded-md px-3 py-2 text-sm"
                />
              )}
            </div>
          );
        })}
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
