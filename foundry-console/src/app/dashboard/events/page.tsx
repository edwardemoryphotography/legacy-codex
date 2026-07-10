"use client";

import { useCallback, useEffect, useState } from "react";
import { ScrollText, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useToast } from "@/components/toast";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/skeleton";
import { LoadError } from "@/components/load-error";
import { formatDateTime } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { useRequestGate } from "@/lib/use-request-gate";
import type { Event } from "@/lib/types";

export default function EventsPage() {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const requestGate = useRequestGate();
  const [events, setEvents] = useState<Event[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!current) return;
    const token = requestGate.begin();
    const workspaceId = current.id;
    setEvents(null);
    setLoadError(null);

    try {
      const { data, error } = await createClient()
        .from("events")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(300);

      if (!requestGate.isCurrent(token)) return;
      if (error) throw error;
      setEvents(data ?? []);
    } catch (error) {
      if (!requestGate.isCurrent(token)) return;
      const message = getErrorMessage(error);
      setLoadError(message);
      toast(message, "error");
    }
  }, [current, requestGate, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Every action, recorded once, never edited."
        action={
          <span className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1.5 text-[12px] font-medium text-zinc-500 ring-1 ring-zinc-800">
            <Lock className="h-3 w-3" />
            Append-only
          </span>
        }
      />

      {loadError ? (
        <LoadError message={loadError} onRetry={() => void load()} />
      ) : events === null ? (
        <ListSkeleton rows={6} />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-5 w-5" />}
          title="No events yet"
          message="As you create sprints, log friction, and change settings, a permanent record accumulates here."
        />
      ) : (
        <div className="card animate-fade-up divide-y divide-zinc-800/60">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500/70" />
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium text-zinc-200">
                    {ev.action}
                  </p>
                  {ev.metadata && (
                    <p className="mt-0.5 truncate font-mono text-[11.5px] text-zinc-600">
                      {JSON.stringify(ev.metadata)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {ev.target_type && (
                  <span className="hidden rounded bg-zinc-800/80 px-1.5 py-0.5 text-[11px] text-zinc-500 sm:inline">
                    {ev.target_type}
                  </span>
                )}
                <span className="text-[12px] tabular-nums text-zinc-600">
                  {formatDateTime(ev.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
