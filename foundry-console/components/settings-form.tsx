"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";

export function SettingsForm({
  workspaceId,
  initialKillSwitchAi,
  initialPiiWarningEnabled,
}: {
  workspaceId: string;
  initialKillSwitchAi: boolean;
  initialPiiWarningEnabled: boolean;
}) {
  const router = useRouter();
  const supabase = getBrowserClient();
  const [killSwitchAi, setKillSwitchAi] = useState(initialKillSwitchAi);
  const [piiWarningEnabled, setPiiWarningEnabled] = useState(
    initialPiiWarningEnabled,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const { error: updateError } = await supabase
      .from("workspaces")
      .update({
        kill_switch_ai: killSwitchAi,
        pii_warning_enabled: piiWarningEnabled,
      })
      .eq("id", workspaceId);

    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }

    setMessage("Settings updated.");
    setBusy(false);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-border bg-card p-4"
    >
      <h2 className="text-lg font-semibold">Workspace settings</h2>

      <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
        <span>kill_switch_ai</span>
        <input
          type="checkbox"
          checked={killSwitchAi}
          onChange={(event) => setKillSwitchAi(event.target.checked)}
        />
      </label>

      <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
        <span>pii_warning_enabled</span>
        <input
          type="checkbox"
          checked={piiWarningEnabled}
          onChange={(event) => setPiiWarningEnabled(event.target.checked)}
        />
      </label>

      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-slate-200 dark:text-slate-900"
      >
        {busy ? "Saving..." : "Save settings"}
      </button>

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
