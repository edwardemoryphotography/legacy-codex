"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import type { Sprint } from "@/lib/types";

export default function SprintsPage() {
  const { current } = useWorkspace();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!current) return;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("sprints")
      .select("*")
      .eq("workspace_id", current.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setSprints(data ?? []);
        setLoading(false);
      });
  }, [current]);

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <>
      <PageHeader title="Sprints" description="All sprints in this workspace." />
      {sprints.length === 0 ? (
        <EmptyState message="No sprints yet. Create one in the database to get started." />
      ) : (
        <div className="space-y-2">
          {sprints.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/sprints/${s.id}`}
              className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 hover:border-zinc-700 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{s.title}</p>
                {s.goal && (
                  <p className="text-xs text-zinc-500 truncate mt-0.5">
                    {s.goal}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <StatusBadge value={s.status} />
                {s.start_date && (
                  <span className="text-xs text-zinc-500">{s.start_date}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
