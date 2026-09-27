export function ChatUnreadBadge({ count = 1 }: { count?: number }) {
  const visibleCount = count > 9 ? "9+" : String(count);
  return <span aria-label={`${count} unread conversation${count === 1 ? "" : "s"}`} className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">{visibleCount}</span>;
}
