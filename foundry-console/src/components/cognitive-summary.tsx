import type { DerivedFoundryState } from "@/lib/derived-state";
import { formatDateTime } from "@/lib/format";

export function CognitiveSummary({
  state,
}: {
  state: DerivedFoundryState;
}) {
  const rows: Array<{ label: string; value: string; testId: string }> = [
    {
      label: "What matters now",
      value: state.whatMattersNow ?? "Nothing routed yet",
      testId: "summary-what",
    },
    {
      label: "Why",
      value: state.why ?? "—",
      testId: "summary-why",
    },
    {
      label: "Blocker",
      value: state.currentBlocker ?? "None",
      testId: "summary-blocker",
    },
    {
      label: "Next action",
      value: state.nextAction
        ? `${state.nextAction} (${state.nextActionProvenance})`
        : "None",
      testId: "summary-next",
    },
    {
      label: "Evidence state",
      value: state.evidenceState,
      testId: "summary-evidence",
    },
    {
      label: "Last trustworthy update",
      value: state.lastTrustworthyUpdate
        ? formatDateTime(state.lastTrustworthyUpdate)
        : "None",
      testId: "summary-updated",
    },
    {
      label: "Provenance",
      value: state.provenance,
      testId: "summary-provenance",
    },
  ];

  return (
    <section
      className="card p-4"
      aria-label="Cognitive summary"
      data-testid="cognitive-summary"
      data-derived="deriveFoundryState"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold text-zinc-100">
          Cognitive summary
        </h2>
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          derived · not stored
        </span>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              {row.label}
            </dt>
            <dd
              className="mt-1 text-[13.5px] leading-relaxed text-zinc-200 break-words"
              data-testid={row.testId}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
