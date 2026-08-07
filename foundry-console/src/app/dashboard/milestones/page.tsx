"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Flag,
  Plus,
  CheckCircle2,
  Circle,
  Sparkles,
  X,
  Rocket,
  BookOpen,
  Flame,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useToast } from "@/components/toast";
import { logEvent } from "@/lib/events";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/skeleton";
import { formatDate, timeAgo } from "@/lib/format";
import type { Milestone, Sprint, FrictionEntry, Event } from "@/lib/types";

// ---------------------------------------------------------------------------
// Signals — milestone suggestions derived from the systems that already share
// this Supabase project: sprints, friction, the audit event log, and the
// Legacy Codex knowledge base (codex_documents).
// ---------------------------------------------------------------------------

interface Signal {
  key: string;
  icon: "sprint" | "knowledge" | "friction";
  title: string;
  description: string | null;
  targetDate: string | null; // YYYY-MM-DD
  why: string;
}

interface KnowledgeStats {
  total: number;
  neverReviewed: number;
}

const DISMISS_KEY = "foundry_ms_signals_dismissed";

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function buildSignals(
  milestones: Milestone[],
  sprints: Sprint[],
  friction: FrictionEntry[],
  knowledge: KnowledgeStats | null
): Signal[] {
  const signals: Signal[] = [];
  const today = new Date();
  const openMilestones = milestones.filter((m) => !m.completed_at);

  const hasMilestoneNear = (date: string | null, windowDays: number) => {
    if (!date) return false;
    const target = new Date(date + "T00:00:00");
    return openMilestones.some((m) => {
      if (!m.target_date) return false;
      const mt = new Date(m.target_date + "T00:00:00");
      return Math.abs(daysBetween(mt, target)) <= windowDays;
    });
  };

  // 1. Active sprint heading for the finish line with no milestone waiting there.
  for (const s of sprints) {
    if (s.status !== "active" || !s.end_date) continue;
    if (hasMilestoneNear(s.end_date, 3)) continue;
    const end = new Date(s.end_date + "T00:00:00");
    const until = daysBetween(today, end);
    if (until > 30) continue; // too far out to be a signal
    signals.push({
      key: `sprint-end-${s.id}`,
      icon: "sprint",
      title: `Ship sprint: ${s.title}`,
      description: s.goal,
      targetDate: s.end_date,
      why:
        until >= 0
          ? `Active sprint ends in ${until} day${until === 1 ? "" : "s"} with no milestone at the finish line.`
          : `Active sprint's end date passed ${-until} day${until === -1 ? "" : "s"} ago and it is still open.`,
    });
  }

  // 2. Recently completed sprint that was never marked as a milestone.
  for (const s of sprints) {
    if (s.status !== "completed") continue;
    const completedRecently =
      daysBetween(new Date(s.updated_at), today) <= 45;
    if (!completedRecently) continue;
    const alreadyMarked = milestones.some((m) =>
      m.title.toLowerCase().includes(s.title.toLowerCase())
    );
    if (alreadyMarked) continue;
    signals.push({
      key: `sprint-done-${s.id}`,
      icon: "sprint",
      title: `Sprint complete: ${s.title}`,
      description: s.goal,
      targetDate: s.end_date,
      why: `Sprint finished ${timeAgo(s.updated_at)} but was never recorded as a milestone.`,
    });
  }

  // 3. Knowledge base growth — next 25-document threshold.
  if (knowledge && knowledge.total > 0) {
    const next = (Math.floor(knowledge.total / 25) + 1) * 25;
    const exists = openMilestones.some((m) =>
      /knowledge|codex|documents?/i.test(m.title)
    );
    if (!exists) {
      signals.push({
        key: `knowledge-${next}`,
        icon: "knowledge",
        title: `Grow the knowledge base to ${next} documents`,
        description: `The Legacy Codex knowledge base holds ${knowledge.total} documents across its categories. Reaching ${next} keeps the corpus compounding.`,
        targetDate: isoDay(addDays(today, 30)),
        why: `Knowledge base is at ${knowledge.total} documents — ${next - knowledge.total} short of the next threshold.`,
      });
    }
  }

  // 4. Knowledge hygiene — unreviewed documents.
  if (knowledge && knowledge.neverReviewed > 0) {
    signals.push({
      key: `knowledge-review-${knowledge.neverReviewed}`,
      icon: "knowledge",
      title: `Review ${knowledge.neverReviewed} never-reviewed knowledge document${knowledge.neverReviewed === 1 ? "" : "s"}`,
      description:
        "Documents without a review pass drift out of date silently. A review sweep keeps the codex trustworthy.",
      targetDate: isoDay(addDays(today, 14)),
      why: `${knowledge.neverReviewed} of ${knowledge.total} codex documents have no last_reviewed stamp.`,
    });
  }

  // 5. Aging high-severity friction.
  for (const f of friction) {
    if (f.status !== "open") continue;
    if (f.severity !== "high" && f.severity !== "critical") continue;
    const age = daysBetween(new Date(f.created_at), today);
    if (age < 5) continue;
    const exists = openMilestones.some((m) =>
      m.title.toLowerCase().includes(f.title.toLowerCase().slice(0, 24))
    );
    if (exists) continue;
    signals.push({
      key: `friction-${f.id}`,
      icon: "friction",
      title: `Resolve friction: ${f.title}`,
      description: f.description,
      targetDate: isoDay(addDays(today, 7)),
      why: `${f.severity} friction has been open for ${age} days.`,
    });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Milestone health — computed from the audit log and target dates.
// ---------------------------------------------------------------------------

type Health = "on-track" | "quiet" | "at-risk" | "overdue" | "done";

function milestoneHealth(m: Milestone, lastActivity: string | null): Health {
  if (m.completed_at) return "done";
  const today = new Date();
  if (m.target_date) {
    const until = daysBetween(today, new Date(m.target_date + "T00:00:00"));
    if (until < 0) return "overdue";
    const quiet =
      !lastActivity || daysBetween(new Date(lastActivity), today) >= 7;
    if (until <= 3 && quiet) return "at-risk";
    if (quiet) return "quiet";
  }
  return "on-track";
}

const HEALTH_STYLE: Record<Health, { label: string; className: string }> = {
  "on-track": {
    label: "On track",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  quiet: {
    label: "Quiet",
    className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  },
  "at-risk": {
    label: "At risk",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  overdue: {
    label: "Overdue",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  },
  done: {
    label: "Done",
    className: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  },
};

function SignalIcon({ kind }: { kind: Signal["icon"] }) {
  const cls = "h-4 w-4";
  if (kind === "sprint") return <Rocket className={`${cls} text-indigo-400`} />;
  if (kind === "knowledge")
    return <BookOpen className={`${cls} text-violet-400`} />;
  return <Flame className={`${cls} text-amber-400`} />;
}

// ---------------------------------------------------------------------------

export default function MilestonesPage() {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [friction, setFriction] = useState<FrictionEntry[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeStats | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]"));
    } catch {
      setDismissed([]);
    }
  }, []);

  const load = useCallback(async () => {
    if (!current) return;
    const supabase = createClient();
    const wsId = current.id;

    const [ms, sp, fr, ev] = await Promise.all([
      supabase
        .from("milestones")
        .select("*")
        .eq("workspace_id", wsId)
        .order("target_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("sprints")
        .select("*")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("friction_entries")
        .select("*")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("events")
        .select("*")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    setMilestones(ms.data ?? []);
    setSprints(sp.data ?? []);
    setFriction(fr.data ?? []);
    setEvents(ev.data ?? []);

    // Knowledge base lives project-wide (codex_documents), not per workspace.
    // It may be unreadable under some policies — degrade gracefully.
    const [total, unreviewed] = await Promise.all([
      supabase
        .from("codex_documents")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("codex_documents")
        .select("id", { count: "exact", head: true })
        .is("last_reviewed", null),
    ]);
    if (total.count != null) {
      setKnowledge({
        total: total.count,
        neverReviewed: unreviewed.count ?? 0,
      });
    }
  }, [current]);

  useEffect(() => {
    setMilestones(null);
    load();
  }, [load]);

  const signals = useMemo(() => {
    if (!milestones) return [];
    return buildSignals(milestones, sprints, friction, knowledge).filter(
      (s) => !dismissed.includes(s.key)
    );
  }, [milestones, sprints, friction, knowledge, dismissed]);

  const lastActivity = events[0]?.created_at ?? null;

  const stats = useMemo(() => {
    if (!milestones) return null;
    const open = milestones.filter((m) => !m.completed_at);
    const done = milestones.length - open.length;
    const atRisk = open.filter((m) =>
      ["at-risk", "overdue"].includes(milestoneHealth(m, lastActivity))
    ).length;
    const recentCompletions = milestones.filter(
      (m) =>
        m.completed_at &&
        daysBetween(new Date(m.completed_at), new Date()) <= 30
    ).length;
    return { open: open.length, done, atRisk, recentCompletions };
  }, [milestones, lastActivity]);

  function dismissSignal(key: string) {
    const next = [...dismissed, key];
    setDismissed(next);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
  }

  async function addMilestone(
    t: string,
    d: string | null,
    td: string | null
  ): Promise<boolean> {
    if (!current || !t.trim()) return false;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("milestones")
      .insert({
        workspace_id: current.id,
        title: t.trim(),
        description: d?.trim() || null,
        target_date: td || null,
      })
      .select()
      .single();
    if (error) {
      toast(error.message, "error");
      return false;
    }
    logEvent(current.id, "milestone.created", "milestone", data.id, {
      title: data.title,
    });
    return true;
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await addMilestone(title, description, targetDate || null);
    setBusy(false);
    if (!ok) return;
    toast("Milestone added");
    setTitle("");
    setDescription("");
    setTargetDate("");
    setShowForm(false);
    load();
  }

  async function acceptSignal(s: Signal) {
    setBusy(true);
    const ok = await addMilestone(s.title, s.description, s.targetDate);
    setBusy(false);
    if (!ok) return;
    toast("Signal promoted to milestone");
    dismissSignal(s.key);
    load();
  }

  async function toggleComplete(m: Milestone) {
    if (!current) return;
    const supabase = createClient();
    const completed = !m.completed_at;
    const { error } = await supabase
      .from("milestones")
      .update({ completed_at: completed ? new Date().toISOString() : null })
      .eq("id", m.id);
    if (error) {
      toast(error.message, "error");
      return;
    }
    logEvent(
      current.id,
      completed ? "milestone.completed" : "milestone.reopened",
      "milestone",
      m.id,
      { title: m.title }
    );
    toast(completed ? "Milestone completed" : "Milestone reopened");
    load();
  }

  return (
    <>
      <PageHeader
        title="Milestones"
        description="The waypoints that mark real progress — now reading signals from your sprints, friction, and knowledge base."
        action={
          <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
            <Plus className="h-4 w-4" />
            Add milestone
          </button>
        }
      />

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="card animate-fade-up mb-5 space-y-4 p-5"
        >
          <div>
            <label className="label">Title</label>
            <input
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="First deploy live"
              className="input"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes this milestone meaningful? (optional)"
              className="input resize-y"
            />
          </div>
          <div>
            <label className="label">Target date</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="input [color-scheme:dark]"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || !title.trim()}
              className="btn-primary"
            >
              {busy ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn-ghost"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {milestones === null ? (
        <ListSkeleton />
      ) : (
        <div className="animate-fade-up space-y-6">
          {/* Insight strip */}
          {stats && milestones.length > 0 && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="card p-4">
                <p className="text-2xl font-bold tabular-nums tracking-tight">
                  {stats.open}
                </p>
                <p className="mt-0.5 text-[12px] font-medium text-zinc-500">
                  Open
                </p>
              </div>
              <div className="card p-4">
                <p className="text-2xl font-bold tabular-nums tracking-tight text-emerald-400">
                  {stats.done}
                </p>
                <p className="mt-0.5 text-[12px] font-medium text-zinc-500">
                  Completed
                </p>
              </div>
              <div className="card p-4">
                <p
                  className={`text-2xl font-bold tabular-nums tracking-tight ${
                    stats.atRisk > 0 ? "text-amber-400" : ""
                  }`}
                >
                  {stats.atRisk}
                </p>
                <p className="mt-0.5 text-[12px] font-medium text-zinc-500">
                  At risk / overdue
                </p>
              </div>
              <div className="card p-4">
                <p className="text-2xl font-bold tabular-nums tracking-tight text-indigo-400">
                  {stats.recentCompletions}
                </p>
                <p className="mt-0.5 text-[12px] font-medium text-zinc-500">
                  Completed in 30 days
                </p>
              </div>
            </div>
          )}

          {/* Signals */}
          {signals.length > 0 && (
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-400" />
                <h3 className="text-[13px] font-semibold uppercase tracking-wider text-zinc-500">
                  Signals from your systems
                </h3>
              </div>
              <ul className="divide-y divide-zinc-800/60">
                {signals.map((s) => (
                  <li key={s.key} className="flex items-start gap-3 py-3">
                    <div className="mt-0.5 shrink-0">
                      <SignalIcon kind={s.icon} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{s.title}</p>
                      <p className="mt-0.5 text-[12px] text-zinc-500">
                        {s.why}
                        {s.targetDate && (
                          <>
                            {" "}
                            · Target{" "}
                            <span className="text-emerald-400">
                              {formatDate(s.targetDate)}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => acceptSignal(s)}
                        disabled={busy}
                        className="btn-primary px-3 py-1.5 text-[12px]"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => dismissSignal(s.key)}
                        className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-400"
                        aria-label="Dismiss signal"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Timeline */}
          {milestones.length === 0 ? (
            <EmptyState
              icon={<Flag className="h-5 w-5" />}
              title="No milestones yet"
              message="Add the waypoints you're building toward — or accept a signal above and let your systems draft them for you."
              action={
                !showForm ? (
                  <button
                    onClick={() => setShowForm(true)}
                    className="btn-primary"
                  >
                    <Plus className="h-4 w-4" />
                    Add milestone
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="relative ml-2.5 space-y-4 border-l border-zinc-800 pl-6">
              {milestones.map((m) => {
                const done = !!m.completed_at;
                const health = milestoneHealth(m, lastActivity);
                const healthStyle = HEALTH_STYLE[health];
                const related = events.filter(
                  (ev) => ev.target_type === "milestone" && ev.target_id === m.id
                );
                const until = m.target_date
                  ? daysBetween(
                      new Date(),
                      new Date(m.target_date + "T00:00:00")
                    )
                  : null;
                return (
                  <div key={m.id} className="relative">
                    <button
                      onClick={() => toggleComplete(m)}
                      className="absolute -left-[2.22rem] top-3.5 rounded-full bg-zinc-950 p-0.5"
                      aria-label={
                        done ? "Reopen milestone" : "Complete milestone"
                      }
                    >
                      {done ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <Circle className="h-5 w-5 text-zinc-700 transition-colors hover:text-zinc-500" />
                      )}
                    </button>
                    <div
                      className={`card px-4 py-3.5 transition-opacity ${
                        done ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p
                          className={`text-sm font-semibold ${
                            done
                              ? "text-zinc-400 line-through decoration-zinc-600"
                              : ""
                          }`}
                        >
                          {m.title}
                        </p>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${healthStyle.className}`}
                          >
                            {health === "at-risk" && (
                              <AlertTriangle className="mr-1 inline h-3 w-3" />
                            )}
                            {healthStyle.label}
                          </span>
                          {m.target_date && (
                            <span
                              className={`text-[12px] font-medium ${
                                done
                                  ? "text-zinc-600"
                                  : until !== null && until < 0
                                    ? "text-red-400"
                                    : "text-emerald-400"
                              }`}
                            >
                              {formatDate(m.target_date)}
                              {!done && until !== null && (
                                <span className="ml-1 text-zinc-600">
                                  (
                                  {until === 0
                                    ? "today"
                                    : until > 0
                                      ? `${until}d left`
                                      : `${-until}d over`}
                                  )
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      {m.description && (
                        <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
                          {m.description}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-zinc-600">
                        {done && (
                          <span>Completed {formatDate(m.completed_at)}</span>
                        )}
                        {related.length > 0 && (
                          <Link
                            href="/dashboard/events"
                            className="flex items-center gap-1 transition-colors hover:text-zinc-400"
                          >
                            {related.length} logged event
                            {related.length === 1 ? "" : "s"} · latest{" "}
                            {timeAgo(related[0].created_at)}
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        )}
                        {!done && health === "quiet" && (
                          <span className="text-zinc-600">
                            No workspace activity in 7+ days
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
