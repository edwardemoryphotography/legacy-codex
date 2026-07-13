"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Rocket, Flame, Flag, ScrollText, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useToast } from "@/components/toast";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { LoadError } from "@/components/load-error";
import { timeAgo, formatDate } from "@/lib/format";
import { firstResultError, getErrorMessage } from "@/lib/errors";
import { useRequestGate } from "@/lib/use-request-gate";
import type { Sprint, Milestone, Event } from "@/lib/types";

interface OverviewData {
  sprintCount: number;
  openFrictionCount: number;
  milestoneCount: number;
  eventCount: number;
  activeSprint: Sprint | null;
  nextMilestone: Milestone | null;
  recentEvents: Event[];
}

export default function OverviewPage() {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const requestGate = useRequestGate(current?.id ?? null);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!current) return;
    const token = requestGate.begin();
    const wsId = current.id;
    if (!requestGate.isScopeCurrent(wsId)) return;
    setData(null);
    setLoadError(null);
    try {
      const supabase = createClient();
      const [
        sprints,
        friction,
        milestones,
        events,
        activeSprint,
        nextMilestone,
        recentEvents,
      ] = await Promise.all([
        supabase
          .from("sprints")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", wsId),
        supabase
          .from("friction_entries")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", wsId)
          .eq("status", "open"),
        supabase
          .from("milestones")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", wsId),
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", wsId),
        supabase
          .from("sprints")
          .select("*")
          .eq("workspace_id", wsId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("milestones")
          .select("*")
          .eq("workspace_id", wsId)
          .is("completed_at", null)
          .not("target_date", "is", null)
          .order("target_date", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("events")
          .select("*")
          .eq("workspace_id", wsId)
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      if (!requestGate.isCurrent(token, wsId)) return;
      const queryError = firstResultError([
        sprints,
        friction,
        milestones,
        events,
        activeSprint,
        nextMilestone,
        recentEvents,
      ]);
      if (queryError) throw queryError;

      setData({
        sprintCount: sprints.count ?? 0,
        openFrictionCount: friction.count ?? 0,
        milestoneCount: milestones.count ?? 0,
        eventCount: events.count ?? 0,
        activeSprint: activeSprint.data,
        nextMilestone: nextMilestone.data,
        recentEvents: recentEvents.data ?? [],
      });
    } catch (error) {
      if (!requestGate.isCurrent(token, wsId)) return;
      const message = getErrorMessage(error);
      setLoadError(message);
      toast(message, "error");
    }
  }, [current, requestGate, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!current) return null;

  return (
    <>
      <PageHeader
        title="Overview"
        description={`Live snapshot of ${current.name}.`}
      />

      {loadError ? (
        <LoadError message={loadError} onRetry={() => void load()} />
      ) : !data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[92px] animate-pulse rounded-xl border border-zinc-800/60 bg-zinc-900/40"
            />
          ))}
        </div>
      ) : (
        <div className="animate-fade-up space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              href="/dashboard/sprints"
              icon={<Rocket className="h-4 w-4" />}
              label="Sprints"
              value={data.sprintCount}
              accent="text-indigo-400"
            />
            <StatCard
              href="/dashboard/friction"
              icon={<Flame className="h-4 w-4" />}
              label="Open friction"
              value={data.openFrictionCount}
              accent="text-amber-400"
            />
            <StatCard
              href="/dashboard/milestones"
              icon={<Flag className="h-4 w-4" />}
              label="Milestones"
              value={data.milestoneCount}
              accent="text-emerald-400"
            />
            <StatCard
              href="/dashboard/events"
              icon={<ScrollText className="h-4 w-4" />}
              label="Audit events"
              value={data.eventCount}
              accent="text-violet-400"
            />
          </div>

          {/* Focus row */}
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold uppercase tracking-wider text-zinc-500">
                  Active sprint
                </h3>
                <Link
                  href="/dashboard/sprints"
                  className="flex items-center gap-1 text-[12px] font-medium text-indigo-400 hover:text-indigo-300"
                >
                  All sprints <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {data.activeSprint ? (
                <Link
                  href={`/dashboard/sprints/${data.activeSprint.id}`}
                  className="block rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-zinc-700"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold">
                      {data.activeSprint.title}
                    </p>
                    <StatusBadge value={data.activeSprint.status} />
                  </div>
                  {data.activeSprint.goal && (
                    <p className="mt-1.5 line-clamp-2 text-[13px] text-zinc-500">
                      {data.activeSprint.goal}
                    </p>
                  )}
                  {(data.activeSprint.start_date ||
                    data.activeSprint.end_date) && (
                    <p className="mt-2 text-[12px] text-zinc-600">
                      {formatDate(data.activeSprint.start_date)} →{" "}
                      {formatDate(data.activeSprint.end_date)}
                    </p>
                  )}
                </Link>
              ) : (
                <p className="py-6 text-center text-[13px] text-zinc-600">
                  No sprint is active right now.
                </p>
              )}
            </div>

            <div className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold uppercase tracking-wider text-zinc-500">
                  Next milestone
                </h3>
                <Link
                  href="/dashboard/milestones"
                  className="flex items-center gap-1 text-[12px] font-medium text-indigo-400 hover:text-indigo-300"
                >
                  Timeline <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {data.nextMilestone ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
                  <p className="truncate text-sm font-semibold">
                    {data.nextMilestone.title}
                  </p>
                  {data.nextMilestone.description && (
                    <p className="mt-1.5 line-clamp-2 text-[13px] text-zinc-500">
                      {data.nextMilestone.description}
                    </p>
                  )}
                  <p className="mt-2 text-[12px] font-medium text-emerald-400">
                    Target: {formatDate(data.nextMilestone.target_date)}
                  </p>
                </div>
              ) : (
                <p className="py-6 text-center text-[13px] text-zinc-600">
                  No upcoming milestone with a target date.
                </p>
              )}
            </div>
          </div>

          {/* Recent activity */}
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold uppercase tracking-wider text-zinc-500">
                Recent activity
              </h3>
              <Link
                href="/dashboard/events"
                className="flex items-center gap-1 text-[12px] font-medium text-indigo-400 hover:text-indigo-300"
              >
                Full log <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {data.recentEvents.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-zinc-600">
                Nothing has happened yet. Actions you take will show up here.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-800/60">
                {data.recentEvents.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500/70" />
                      <span className="truncate text-[13px] text-zinc-300">
                        {ev.action}
                      </span>
                      {ev.target_type && (
                        <span className="hidden shrink-0 rounded bg-zinc-800/80 px-1.5 py-0.5 text-[11px] text-zinc-500 sm:inline">
                          {ev.target_type}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-[12px] text-zinc-600">
                      {timeAgo(ev.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({
  href,
  icon,
  label,
  value,
  accent,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="card group p-4 transition-colors hover:border-zinc-700"
    >
      <div className={`mb-3 ${accent}`}>{icon}</div>
      <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="mt-0.5 text-[12px] font-medium text-zinc-500 group-hover:text-zinc-400">
        {label}
      </p>
    </Link>
  );
}
