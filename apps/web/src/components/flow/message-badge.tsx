export function MessageBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-1.5 text-[10px] font-semibold shadow-sm">
      {count}
    </span>
  );
}
