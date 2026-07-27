"use client";

import { useEffect, useState } from "react";
import { ScrollText, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/skeleton";
import { formatDateTime } from "@/lib/format";
import type { Event } from "@/lib/types";

export default function EventsPage() {
  const { current } = useWorkspace();
  const [events, setEvents] = useState<Event[] | null>(null);

  useEffect(() => {
    if (!current) return;
    setEvents(null);
    const supabase = createClient();
    supabase
      .from("events")
      .select("*")
      .eq("workspace_id", current.id)
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data }) => setEvents(data ?? []));
  }, [current]);

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

      {events === null ? (
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
