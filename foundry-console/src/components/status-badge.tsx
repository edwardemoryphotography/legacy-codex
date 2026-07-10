const STYLES: Record<string, string> = {
  planned: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20",
  active: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/25",
  completed: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25",
  cancelled: "bg-red-500/10 text-red-300 ring-red-500/25",
  open: "bg-amber-500/10 text-amber-300 ring-amber-500/25",
  resolved: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25",
  wontfix: "bg-zinc-500/10 text-zinc-500 ring-zinc-500/20",
  low: "bg-sky-500/10 text-sky-300 ring-sky-500/25",
  medium: "bg-amber-500/10 text-amber-300 ring-amber-500/25",
  high: "bg-orange-500/10 text-orange-300 ring-orange-500/25",
  critical: "bg-red-500/10 text-red-300 ring-red-500/25",
};

export function StatusBadge({ value }: { value: string }) {
  const cls = STYLES[value] ?? "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset ${cls}`}
    >
      {value}
    </span>
  );
}
