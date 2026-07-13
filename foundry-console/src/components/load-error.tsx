import { AlertTriangle } from "lucide-react";

export function LoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-5 py-6 text-center">
      <AlertTriangle className="mx-auto h-5 w-5 text-red-400" />
      <p className="mt-3 text-sm font-semibold text-red-200">
        Couldn&apos;t load this data
      </p>
      <p className="mt-1 text-[13px] text-red-300/70">{message}</p>
      <button type="button" onClick={onRetry} className="btn-ghost mt-4">
        Try again
      </button>
    </div>
  );
}
