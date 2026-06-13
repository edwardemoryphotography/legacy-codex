"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import type { Event } from "@/lib/types";

export default function EventsPage() {
  const { current } = useWorkspace();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!current) return;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("events")
      .select("*")
      .eq("workspace_id", current.id)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setEvents(data ?? []);
        setLoading(false);
      });
  }, [current]);

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Read-only, append-only event log."
      />
      {events.length === 0 ? (
        <EmptyState message="No events recorded yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                <th className="pb-2 pr-4 font-medium">Time</th>
                <th className="pb-2 pr-4 font-medium">Action</th>
                <th className="pb-2 pr-4 font-medium">Target</th>
                <th className="pb-2 font-medium">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr
                  key={ev.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-900/30"
                >
                  <td className="py-2 pr-4 text-xs text-zinc-500 whitespace-nowrap">
                    {new Date(ev.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-zinc-300">{ev.action}</td>
                  <td className="py-2 pr-4 text-zinc-400 text-xs">
                    {ev.target_type && (
                      <span>
                        {ev.target_type}
                        {ev.target_id && (
                          <span className="text-zinc-600 ml-1">
                            {ev.target_id.slice(0, 8)}…
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-xs text-zinc-500 font-mono max-w-xs truncate">
                    {ev.metadata ? JSON.stringify(ev.metadata) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
