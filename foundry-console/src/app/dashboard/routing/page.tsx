"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GitBranch, Link2, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useToast } from "@/components/toast";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/skeleton";
import { LoadError } from "@/components/load-error";
import { StatusBadge } from "@/components/status-badge";
import { EvidenceStatusBadge } from "@/components/evidence-status";
import { CognitiveSummary } from "@/components/cognitive-summary";
import { formatDateTime } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { useRequestGate } from "@/lib/use-request-gate";
import {
  activeRoute,
  correctionChain,
  deriveFoundryState,
} from "@/lib/derived-state";
import { classifyRoutingLoadError } from "@/lib/routing-load";
import type { EvidenceItem, Event, RoutedRequest } from "@/lib/types";

interface ActionLite {
  id: string;
  title?: string | null;
  finish_line?: string | null;
  status?: string | null;
  owner?: string | null;
  agent?: string | null;
  blocker?: string | null;
  next_action?: string | null;
}

export default function RoutingPage() {
  const { current } = useWorkspace();
  const { toast } = useToast();
  const requestGate = useRequestGate(current?.id ?? null);
  const [requests, setRequests] = useState<RoutedRequest[] | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[] | null>(null);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [loadedWorkspaceId, setLoadedWorkspaceId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tablesMissing, setTablesMissing] = useState(false);

  const load = useCallback(async () => {
    if (!current) return;
    const token = requestGate.begin();
    const workspaceId = current.id;
    if (!requestGate.isScopeCurrent(workspaceId)) return;
    setRequests(null);
    setEvidence(null);
    setEvents(null);
    setLoadedWorkspaceId(null);
    setLoadError(null);
    setTablesMissing(false);

    try {
      const supabase = createClient();
      const [reqRes, evRes, eventRes] = await Promise.all([
        supabase
          .from("routed_requests")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false }),
        supabase
          .from("evidence_items")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false }),
        supabase
          .from("events")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (!requestGate.isCurrent(token, workspaceId)) return;

      if (reqRes.error) throw reqRes.error;
      if (evRes.error) throw evRes.error;
      if (eventRes.error) throw eventRes.error;

      const loadedRequests = (reqRes.data ?? []) as RoutedRequest[];
      const loadedEvidence = (evRes.data ?? []) as EvidenceItem[];
      setRequests(loadedRequests);
      setEvidence(loadedEvidence);
      setEvents((eventRes.data ?? []) as Event[]);
      // Action linking is intentionally not loaded while the global actions
      // table remains public and lacks a workspace relationship. Existing ids
      // are shown as ids only; no unrelated global action is treated as fact.
      setLoadedWorkspaceId(workspaceId);
    } catch (error) {
      if (!requestGate.isCurrent(token, workspaceId)) return;
      setLoadedWorkspaceId(workspaceId);
      const classified = classifyRoutingLoadError(error);
      if (classified.kind === "tables_missing") {
        setTablesMissing(true);
        setLoadError(classified.message);
      } else {
        const message =
          classified.kind === "unknown"
            ? getErrorMessage(error)
            : classified.message;
        setLoadError(message);
        toast(message, "error");
      }
    }
  }, [current, requestGate, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    if (!requests || !evidence || !events) return null;
    return deriveFoundryState(requests, evidence, events);
  }, [requests, evidence, events]);

  const live = useMemo(
    () => (requests ? activeRoute(requests) : null),
    [requests],
  );

  if (!current) return null;
  const loadedForCurrentWorkspace = loadedWorkspaceId === current.id;

  return (
    <>
      <PageHeader
        title="Routing"
        description="Routed requests, linked work, evidence, and correction history for this workspace."
      />

      {!loadedForCurrentWorkspace ? (
        <ListSkeleton rows={6} />
      ) : loadError ? (
        <div className="space-y-4">
          <LoadError message={loadError} onRetry={() => void load()} />
          {tablesMissing && (
            <div className="card flex items-start gap-3 p-4 text-[13px] text-zinc-400">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <p>
                No demonstration records are seeded. Once the migration is
                applied and routes are persisted from the Control Panel, they
                appear here under owner RLS.
              </p>
            </div>
          )}
        </div>
      ) : requests === null || evidence === null || events === null ? (
        <ListSkeleton rows={6} />
      ) : (
        <div className="animate-fade-up space-y-6">
          {summary && <CognitiveSummary state={summary} />}

          <section aria-label="Active work" className="space-y-3">
            <h2 className="text-[14px] font-semibold text-zinc-100">
              Active work
            </h2>
            {!live ? (
              <EmptyState
                icon={<GitBranch className="h-5 w-5" />}
                title="No active routed request"
                message="No routed requests exist yet for this workspace, or all routes are superseded/rejected."
              />
            ) : (
              <ActiveWorkCard
                route={live}
                evidence={evidence.filter(
                  (item) => item.routed_request_id === live.id,
                )}
                action={null}
                summaryNext={summary?.nextAction ?? null}
                summaryBlocker={summary?.currentBlocker ?? null}
                evidenceState={summary?.evidenceState ?? "none"}
              />
            )}
          </section>

          <section aria-label="Routing inbox" className="space-y-3">
            <h2 className="text-[14px] font-semibold text-zinc-100">
              Routing inbox
            </h2>
            {requests.length === 0 ? (
              <EmptyState
                icon={<GitBranch className="h-5 w-5" />}
                title="No routed requests yet"
                message="Persist a confirmed route from the Codex Control Panel. This inbox never invents sample routes."
              />
            ) : (
              <div className="card divide-y divide-zinc-800/60">
                {requests.map((route) => (
                  <RouteRow
                    key={route.id}
                    route={route}
                    chainLength={correctionChain(requests, route.id).length}
                  />
                ))}
              </div>
            )}
          </section>

          <section aria-label="Evidence" className="space-y-3">
            <h2 className="text-[14px] font-semibold text-zinc-100">
              Evidence
            </h2>
            {evidence.length === 0 ? (
              <EmptyState
                icon={<Link2 className="h-5 w-5" />}
                title="No evidence items"
                message="Evidence is pending until the Control Panel persistence flow creates evidence_items rows, or an owner records observed evidence."
              />
            ) : (
              <div className="card divide-y divide-zinc-800/60">
                {evidence.map((item) => (
                  <EvidenceRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>

          <section aria-label="Correction history" className="space-y-3">
            <h2 className="text-[14px] font-semibold text-zinc-100">
              Correction history
            </h2>
            {!live ? (
              <EmptyState
                icon={<GitBranch className="h-5 w-5" />}
                title="No correction chain"
                message="Correction history appears when a live route exists. The original route is preserved."
              />
            ) : (
              <CorrectionHistory
                chain={correctionChain(requests, live.id)}
              />
            )}
          </section>
        </div>
      )}
    </>
  );
}

function ActiveWorkCard({
  route,
  evidence,
  action,
  summaryNext,
  summaryBlocker,
  evidenceState,
}: {
  route: RoutedRequest;
  evidence: EvidenceItem[];
  action: ActionLite | null;
  summaryNext: string | null;
  summaryBlocker: string | null;
  evidenceState: string;
}) {
  const title =
    action?.finish_line ??
    action?.title ??
    (route.action_id ? `Linked action ${route.action_id}` : "No linked action");

  return (
    <div className="card space-y-3 p-4" data-testid="active-work">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
            Finish line / title
          </p>
          <p className="mt-1 text-[14px] font-medium text-zinc-100 break-words">
            {title}
          </p>
        </div>
        <StatusBadge value={action?.status ?? route.status} />
      </div>
      <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Owner / agent</dt>
          <dd className="text-zinc-200">
            {action?.owner ?? action?.agent ?? route.selected_agent}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Linked routed request</dt>
          <dd className="font-mono text-[12px] text-zinc-300">
            <Link
              href={`/dashboard/routing/${route.id}`}
              className="text-indigo-300 underline-offset-2 hover:underline"
            >
              {route.id}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Blocker</dt>
          <dd className="text-zinc-200">
            {action?.blocker ?? summaryBlocker ?? "None"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Next action</dt>
          <dd className="text-zinc-200">
            {action?.next_action ?? summaryNext ?? "None"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Evidence state</dt>
          <dd className="text-zinc-200">{evidenceState}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Evidence items on route</dt>
          <dd className="text-zinc-200">{evidence.length}</dd>
        </div>
      </dl>
    </div>
  );
}

function RouteRow({
  route,
  chainLength,
}: {
  route: RoutedRequest;
  chainLength: number;
}) {
  return (
    <Link
      href={`/dashboard/routing/${route.id}`}
      className="block px-4 py-3 transition-colors hover:bg-zinc-900/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-400"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium text-zinc-100 break-words">
            {route.intent}
          </p>
          <p className="mt-1 text-[12px] text-zinc-500">
            {route.repository}
            {route.repository_path ? ` / ${route.repository_path}` : ""} ·{" "}
            {route.task_type} · {route.execution_lane} · {route.selected_agent}
          </p>
          <p className="mt-1 text-[12px] text-zinc-600">
            risk {route.risk} · sensitivity {route.sensitivity} · confidence{" "}
            {route.confidence} · source {route.route_source} · provenance{" "}
            {route.provenance}
            {route.supersedes_request_id
              ? ` · corrects ${route.supersedes_request_id.slice(0, 8)}…`
              : ""}
            {chainLength > 1 ? ` · chain ${chainLength}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge value={route.status} />
          <span className="text-[11px] tabular-nums text-zinc-600">
            {formatDateTime(route.created_at)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function EvidenceRow({ item }: { item: EvidenceItem }) {
  const verifiedIncomplete =
    item.status === "verified" && (!item.source || !item.observed_at);

  return (
    <div
      className="px-4 py-3"
      data-testid={`evidence-${item.id}`}
      data-evidence-status={item.status}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium text-zinc-100 break-words">
            {item.claim}
          </p>
          <p className="mt-1 text-[12px] text-zinc-500">
            kind {item.kind}
            {item.routed_request_id
              ? ` · route ${item.routed_request_id.slice(0, 8)}…`
              : ""}
          </p>
          {item.status === "verified" && !verifiedIncomplete && (
            <p className="mt-1 text-[12px] text-zinc-400">
              source {item.source} · observed {formatDateTime(item.observed_at!)}{" "}
              · provenance {item.provenance}
            </p>
          )}
          {verifiedIncomplete && (
            <p className="mt-1 text-[12px] text-red-300" role="alert">
              Verified evidence is incomplete — source and observed time are
              required.
            </p>
          )}
          {item.status === "pending" && (
            <p className="mt-1 text-[12px] text-amber-200/90">
              Evidence pending — not verified or completed.
            </p>
          )}
          {item.status === "conflict" && (
            <p className="mt-1 text-[12px] text-red-300">
              Conflicting evidence — do not treat as verified.
            </p>
          )}
          {item.status === "stale" && (
            <p className="mt-1 text-[12px] text-orange-200">
              Stale evidence — observation may no longer reflect reality.
            </p>
          )}
        </div>
        <EvidenceStatusBadge status={item.status} />
      </div>
    </div>
  );
}

function CorrectionHistory({ chain }: { chain: RoutedRequest[] }) {
  return (
    <ol
      className="card divide-y divide-zinc-800/60"
      data-testid="correction-history"
    >
      {chain.map((route, index) => (
        <li key={route.id} className="px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-medium text-zinc-400">
              {index === 0
                ? "Original route (preserved)"
                : `Correction ${index}`}
            </p>
            <StatusBadge value={route.status} />
          </div>
          <p className="mt-1 text-[13.5px] text-zinc-100 break-words">
            {route.intent}
          </p>
          <p className="mt-1 font-mono text-[11.5px] text-zinc-600">
            {route.id} · {formatDateTime(route.created_at)}
            {route.supersedes_request_id
              ? ` · supersedes ${route.supersedes_request_id}`
              : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
