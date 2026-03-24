export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-700 p-12 text-center">
      <p className="text-sm text-zinc-500">{message}</p>
    </div>
  );
}
