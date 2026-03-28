export function MessageBadge({ count }: { count: number }) {
  return (
    <span className="neo-panel inline-flex h-6 min-w-6 items-center justify-center bg-[var(--background)] px-1 text-[11px] font-bold leading-none">
      {count}
    </span>
  );
}
