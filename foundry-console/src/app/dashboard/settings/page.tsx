"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useToast } from "@/components/toast";
import { logEvent } from "@/lib/events";
import { PageHeader } from "@/components/page-header";
import type { Settings } from "@/lib/types";

export default function SettingsPage() {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!current) return;
    setLoading(true);
    const supabase = createClient();
    const wsId = current.id;

    async function load() {
      const { data } = await supabase
        .from("settings")
        .select("*")
        .eq("workspace_id", wsId)
        .maybeSingle();

      if (data) {
        setSettings(data);
      } else {
        // First visit for this workspace: initialize a settings row
        // with safe defaults (everything off).
        const { data: created } = await supabase
          .from("settings")
          .insert({ workspace_id: wsId })
          .select()
          .single();
        setSettings(created ?? null);
      }
      setLoading(false);
    }
    load();
  }, [current]);

  async function handleToggle(field: "kill_switch_ai" | "pii_warning_enabled") {
    if (!settings || !current) return;
    setSaving(true);
    const newValue = !settings[field];
    const supabase = createClient();
    const { error } = await supabase
      .from("settings")
      .update({ [field]: newValue, updated_at: new Date().toISOString() })
      .eq("id", settings.id);
    setSaving(false);
    if (error) {
      toast(error.message, "error");
      return;
    }
    setSettings({ ...settings, [field]: newValue });
    logEvent(current.id, `settings.${field}.${newValue ? "on" : "off"}`, "settings", settings.id);
    toast(newValue ? "Enabled" : "Disabled");
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Workspace-level safety controls."
      />

      {loading ? (
        <div className="max-w-lg space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-[76px] animate-pulse rounded-xl border border-zinc-800/60 bg-zinc-900/40"
            />
          ))}
        </div>
      ) : !settings ? (
        <p className="text-sm text-zinc-500">
          Couldn&apos;t load settings. Make sure SCHEMA.sql has been applied.
        </p>
      ) : (
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
      )}
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
