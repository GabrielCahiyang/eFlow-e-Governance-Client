import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { WSelect } from "../workflow/primitives";

export interface PaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (nextPage: number) => void;
  onPageSizeChange?: (nextPageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  disabled?: boolean;
}

/** Shared domain-neutral pagination controls with non-wrapping labels and tabular counts. */
export function PaginationBar({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = "records",
  disabled = false,
}: PaginationBarProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  const pages: Array<number | "ellipsis"> = [];
  if (safeTotalPages <= 7) {
    for (let index = 1; index <= safeTotalPages; index += 1) pages.push(index);
  } else {
    pages.push(1);
    if (page > 3) pages.push("ellipsis");
    for (
      let index = Math.max(2, page - 1);
      index <= Math.min(safeTotalPages - 1, page + 1);
      index += 1
    ) {
      pages.push(index);
    }
    if (page < safeTotalPages - 2) pages.push("ellipsis");
    pages.push(safeTotalPages);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--eflow-border)] pt-3 text-xs text-[var(--eflow-text-muted)]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span role="status" className="eflow-tabular whitespace-nowrap">
          Showing {start.toLocaleString()}–{end.toLocaleString()} of{" "}
          {total.toLocaleString()} {itemLabel}
        </span>
        {onPageSizeChange && (
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <span className="shrink-0 whitespace-nowrap">Rows</span>
            <WSelect
              ariaLabel={`Rows per page for ${itemLabel}`}
              value={String(pageSize)}
              onChange={(value) => onPageSizeChange(Number(value))}
              options={pageSizeOptions.map((size) => ({
                value: String(size),
                label: `${size} / page`,
              }))}
              className="!min-w-[108px] w-auto shrink-0 whitespace-nowrap h-8 text-xs"
            />
          </div>
        )}
      </div>

      <nav
        aria-label={`${itemLabel} pagination`}
        className="flex shrink-0 flex-wrap items-center gap-1"
      >
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          className="shrink-0 whitespace-nowrap"
        >
          <ChevronLeft size={13} aria-hidden="true" />
          Previous
        </Button>

        {pages.map((entry, idx) =>
          entry === "ellipsis" ? (
            <span
              key={`ellipsis-${idx}`}
              className="px-1.5 text-[var(--eflow-text-muted)]"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <Button
              key={entry}
              type="button"
              size="sm"
              variant={entry === page ? "default" : "ghost"}
              disabled={disabled}
              aria-current={entry === page ? "page" : undefined}
              onClick={() => onPageChange(entry)}
              className="min-w-[32px] shrink-0 px-2"
            >
              {entry}
            </Button>
          ),
        )}

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || page >= safeTotalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          className="shrink-0 whitespace-nowrap"
        >
          Next
          <ChevronRight size={13} aria-hidden="true" />
        </Button>
      </nav>
    </div>
  );
}
