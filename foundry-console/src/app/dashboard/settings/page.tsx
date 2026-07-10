"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useToast } from "@/components/toast";
import { logEvent } from "@/lib/events";
import { PageHeader } from "@/components/page-header";
import { LoadError } from "@/components/load-error";
import { getErrorMessage } from "@/lib/errors";
import { useRequestGate } from "@/lib/use-request-gate";
import type { Settings } from "@/lib/types";

export default function SettingsPage() {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const loadGate = useRequestGate();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    if (!current) return;
    const token = loadGate.begin();
    const wsId = current.id;
    setLoading(true);
    setSaving(false);
    setSettings(null);
    setLoadError(null);

    async function load() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("settings")
          .select("*")
          .eq("workspace_id", wsId)
          .maybeSingle();

        if (!loadGate.isCurrent(token)) return;
        if (error) throw error;

        if (data) {
          setSettings(data);
          return;
        }

        const { data: created, error: insertError } = await supabase
          .from("settings")
          .upsert({ workspace_id: wsId }, { onConflict: "workspace_id" })
          .select()
          .single();

        if (!loadGate.isCurrent(token)) return;
        if (insertError) throw insertError;
        setSettings(created);
      } catch (error) {
        if (!loadGate.isCurrent(token)) return;
        const message = getErrorMessage(error);
        setLoadError(message);
        toast(message, "error");
      } finally {
        if (loadGate.isCurrent(token)) setLoading(false);
      }
    }

    void load();
  }, [current, loadGate, reloadNonce, toast]);

  async function handleToggle(field: "kill_switch_ai" | "pii_warning_enabled") {
    if (!settings || !current) return;
    const settingsId = settings.id;
    const workspaceId = current.id;
    setSaving(true);
    const newValue = !settings[field];
    try {
      const { error } = await createClient()
        .from("settings")
        .update({ [field]: newValue, updated_at: new Date().toISOString() })
        .eq("id", settingsId)
        .eq("workspace_id", workspaceId);
      if (error) throw error;

      setSettings((previous) =>
        previous?.id === settingsId
          ? { ...previous, [field]: newValue }
          : previous
      );
      void logEvent(
        workspaceId,
        `settings.${field}.${newValue ? "on" : "off"}`,
        "settings",
        settingsId
      );
      toast(newValue ? "Enabled" : "Disabled");
    } catch (error) {
      toast(getErrorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Workspace-level safety controls."
      />

      {loadError ? (
        <LoadError
          message={loadError}
          onRetry={() => setReloadNonce((value) => value + 1)}
        />
      ) : loading ? (
        <div className="max-w-lg space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-[76px] animate-pulse rounded-xl border border-zinc-800/60 bg-zinc-900/40"
            />
          ))}
        </div>
      ) : settings ? (
        <div className="animate-fade-up max-w-lg space-y-3">
          <ToggleRow
            label="AI kill switch"
            description="Immediately disable every AI-powered feature in this workspace."
            checked={settings.kill_switch_ai}
            onChange={() => handleToggle("kill_switch_ai")}
            disabled={saving}
            danger
          />
          <ToggleRow
            label="PII warning"
            description="Show a warning banner wherever personal data might appear."
            checked={settings.pii_warning_enabled}
            onChange={() => handleToggle("pii_warning_enabled")}
            disabled={saving}
          />
        </div>
      ) : null}
    </>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
  danger,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
  danger?: boolean;
}) {
  return (
    <div className="card flex items-center justify-between gap-4 px-5 py-4">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-500">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        disabled={disabled}
        className={`relative inline-flex h-[26px] w-[46px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-50 ${
          checked ? (danger ? "bg-red-500" : "bg-indigo-500") : "bg-zinc-700"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
