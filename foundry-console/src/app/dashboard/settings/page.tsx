"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { PageHeader } from "@/components/page-header";
import type { Settings } from "@/lib/types";

export default function SettingsPage() {
  const { current, currentRole } = useWorkspace();
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentRole !== "admin") {
      router.replace("/dashboard/sprints");
      return;
    }
    if (!current) return;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("settings")
      .select("*")
      .eq("workspace_id", current.id)
      .single()
      .then(({ data }) => {
        setSettings(data);
        setLoading(false);
      });
  }, [current, currentRole, router]);

  async function handleToggle(field: "kill_switch_ai" | "pii_warning_enabled") {
    if (!settings) return;
    setSaving(true);
    const newValue = !settings[field];
    const supabase = createClient();
    await supabase
      .from("settings")
      .update({
        [field]: newValue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settings.id);
    setSettings({ ...settings, [field]: newValue });
    setSaving(false);
  }

  if (currentRole !== "admin") return null;
  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  if (!settings) {
    return (
      <>
        <PageHeader title="Settings" />
        <p className="text-sm text-zinc-400">
          No settings row found for this workspace. Create one in the database.
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Admin-only workspace configuration."
      />
      <div className="max-w-md space-y-4">
        <Toggle
          label="AI Kill Switch"
          description="Disable all AI-powered features in this workspace."
          checked={settings.kill_switch_ai}
          onChange={() => handleToggle("kill_switch_ai")}
          disabled={saving}
        />
        <Toggle
          label="PII Warning"
          description="Show a warning banner when PII may be present."
          checked={settings.pii_warning_enabled}
          onChange={() => handleToggle("pii_warning_enabled")}
          disabled={saving}
        />
      </div>
    </>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? "bg-indigo-600" : "bg-zinc-700"
        } disabled:opacity-50`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
