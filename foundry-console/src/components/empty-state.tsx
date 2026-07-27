export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="animate-fade-up flex flex-col items-center rounded-xl border border-dashed border-zinc-800 px-6 py-16 text-center">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-zinc-600 ring-1 ring-zinc-800">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-zinc-300">{title}</p>
      {message && (
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-zinc-600">
          {message}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
