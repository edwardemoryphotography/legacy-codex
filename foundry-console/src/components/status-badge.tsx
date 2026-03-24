const COLORS: Record<string, string> = {
  planned: "bg-zinc-700 text-zinc-300",
  active: "bg-indigo-600/20 text-indigo-300",
  completed: "bg-emerald-600/20 text-emerald-300",
  cancelled: "bg-red-600/20 text-red-300",
  open: "bg-amber-600/20 text-amber-300",
  resolved: "bg-emerald-600/20 text-emerald-300",
  wontfix: "bg-zinc-700 text-zinc-400",
  low: "bg-zinc-700 text-zinc-300",
  medium: "bg-amber-600/20 text-amber-300",
  high: "bg-orange-600/20 text-orange-300",
  critical: "bg-red-600/20 text-red-300",
};

export function StatusBadge({ value }: { value: string }) {
  const cls = COLORS[value] ?? "bg-zinc-700 text-zinc-300";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {value}
    </span>
  );
}
