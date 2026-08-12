"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, GitBranch } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useToast } from "@/components/toast";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/skeleton";
import { LoadError } from "@/components/load-error";
import { StatusBadge } from "@/components/status-badge";
import { EvidenceStatusBadge } from "@/components/evidence-status";
import { formatDateTime } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { useRequestGate } from "@/lib/use-request-gate";
import { correctionChain } from "@/lib/derived-state";
import { classifyRoutingLoadError } from "@/lib/routing-load";
import type { EvidenceItem, RoutedRequest } from "@/lib/types";

export default function RoutingDetailPage() {
  const params = useParams<{ id: string }>();
  const routeId = params.id;
  const { current } = useWorkspace();
  const { toast } = useToast();
  const requestGate = useRequestGate(current?.id ?? null);
  const [requests, setRequests] = useState<RoutedRequest[] | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!current) return;
    const token = requestGate.begin();
    const workspaceId = current.id;
    if (!requestGate.isScopeCurrent(workspaceId)) return;
    setRequests(null);
    setEvidence(null);
    setLoadError(null);

    try {
      const supabase = createClient();
      const [reqRes, evRes] = await Promise.all([
        supabase
          .from("routed_requests")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: true }),
        supabase
          .from("evidence_items")
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("routed_request_id", routeId)
          .order("created_at", { ascending: false }),
      ]);
      if (!requestGate.isCurrent(token, workspaceId)) return;
      if (reqRes.error) throw reqRes.error;
      if (evRes.error) throw evRes.error;
      setRequests((reqRes.data ?? []) as RoutedRequest[]);
      setEvidence((evRes.data ?? []) as EvidenceItem[]);
    } catch (error) {
      if (!requestGate.isCurrent(token, workspaceId)) return;
      const classified = classifyRoutingLoadError(error);
      const message =
        classified.kind === "unknown"
          ? getErrorMessage(error)
          : classified.message;
      setLoadError(message);
      toast(message, "error");
    }
  }, [current, requestGate, routeId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const route = useMemo(
    () => requests?.find((item) => item.id === routeId) ?? null,
    [requests, routeId],
  );
  const chain = useMemo(
    () => (requests ? correctionChain(requests, routeId) : []),
    [requests, routeId],
  );

  if (!current) return null;

  return (
    <>
      <PageHeader
        title="Route detail"
        description="Full routed request, linked evidence, and append-only correction chain."
        action={
          <Link
            href="/dashboard/routing"
            className="btn-ghost inline-flex min-h-11 items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Inbox
          </Link>
        }
      />

      {loadError ? (
        <LoadError message={loadError} onRetry={() => void load()} />
      ) : requests === null || evidence === null ? (
        <ListSkeleton rows={5} />
      ) : !route ? (
        <EmptyState
          icon={<GitBranch className="h-5 w-5" />}
          title="Route not found"
          message="No routed request with this id exists in the current workspace."
        />
      ) : (
        <div className="animate-fade-up space-y-6">
          <section className="card space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[14px] font-semibold text-zinc-100">
                Routed request
              </h2>
              <StatusBadge value={route.status} />
            </div>
            <p className="text-[15px] text-zinc-100 break-words">{route.intent}</p>
            <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
              {[
                ["Workspace", route.workspace_id],
                ["Repository", route.repository],
                ["Path", route.repository_path ?? "—"],
                ["Task type", route.task_type],
                ["Execution lane", route.execution_lane],
                ["Selected agent", route.selected_agent],
                ["Risk", route.risk],
                ["Sensitivity", route.sensitivity],
                ["Confidence", String(route.confidence)],
                ["Route source", route.route_source],
                ["Provenance", route.provenance],
                ["Required evidence", route.required_evidence],
                ["Rationale", route.rationale],
                ["Action ID", route.action_id ?? "—"],
                ["Created", formatDateTime(route.created_at)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-zinc-500">{label}</dt>
                  <dd className="mt-0.5 break-words text-zinc-200">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="space-y-3">
            <h2 className="text-[14px] font-semibold text-zinc-100">
              Correction history
            </h2>
            <ol className="card divide-y divide-zinc-800/60" data-testid="correction-history">
              {chain.map((item, index) => (
                <li key={item.id} className="px-4 py-3">
                  <p className="text-[12px] text-zinc-500">
                    {index === 0
                      ? "Original route (preserved)"
                      : `Correction ${index}`}
                  </p>
                  <p className="mt-1 text-[13.5px] text-zinc-100">{item.intent}</p>
                  <p className="mt-1 font-mono text-[11.5px] text-zinc-600">
                    {item.id}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className="text-[14px] font-semibold text-zinc-100">Evidence</h2>
            {evidence.length === 0 ? (
              <EmptyState
                icon={<GitBranch className="h-5 w-5" />}
                title="Evidence pending"
                message="No evidence_items are linked to this route yet."
              />
            ) : (
              <div className="card divide-y divide-zinc-800/60">
                {evidence.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-[13.5px] text-zinc-100">{item.claim}</p>
                      {item.status === "verified" && item.source && item.observed_at && (
                        <p className="mt-1 text-[12px] text-zinc-400">
                          {item.source} · {formatDateTime(item.observed_at)} ·{" "}
                          {item.provenance} · {item.kind}
                        </p>
                      )}
                      {item.status === "pending" && (
                        <p className="mt-1 text-[12px] text-amber-200">
                          Pending — not verified
                        </p>
                      )}
                    </div>
                    <EvidenceStatusBadge status={item.status} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
