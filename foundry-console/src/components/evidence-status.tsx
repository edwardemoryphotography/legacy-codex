import type { EvidenceStatus } from "@/lib/types";

/**
 * Visual + semantic evidence states. Pending must never look successful.
 * Color is never the only signal — each state includes a text label and icon glyph.
 */
const STYLES: Record<
  EvidenceStatus,
  { className: string; glyph: string; label: string }
> = {
  pending: {
    className: "bg-amber-500/10 text-amber-200 ring-amber-500/30",
    glyph: "◌",
    label: "Pending",
  },
  verified: {
    className: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    glyph: "✓",
    label: "Verified",
  },
  unverified: {
    className: "bg-zinc-500/10 text-zinc-300 ring-zinc-500/30",
    glyph: "?",
    label: "Unverified",
  },
  conflict: {
    className: "bg-red-500/10 text-red-300 ring-red-500/35",
    glyph: "!",
    label: "Conflict",
  },
  stale: {
    className: "bg-orange-500/10 text-orange-200 ring-orange-500/30",
    glyph: "⌛",
    label: "Stale",
  },
};

export function EvidenceStatusBadge({ status }: { status: EvidenceStatus }) {
  const style = STYLES[status] ?? STYLES.unverified;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${style.className}`}
      data-evidence-status={status}
      aria-label={`Evidence status: ${style.label}`}
    >
      <span aria-hidden="true">{style.glyph}</span>
      {style.label}
    </span>
  );
}
