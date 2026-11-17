import { Button } from "../../../components/ui/button";
import { BUDGET_PAGE_SIZE_OPTIONS } from "../hooks/useBudgetPagination";

interface BudgetPaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  visibleCount: number;
  noun: string;
  pluralNoun?: string;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

/** Shared accessible pagination footer aligned across Accounting and Office Budget lists. */
export function BudgetPagination({
  page,
  pageSize,
  totalItems,
  visibleCount,
  noun,
  pluralNoun,
  loading = false,
  onPageChange,
  onPageSizeChange,
}: BudgetPaginationProps) {
  if (totalItems === 0 && !loading) return null;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = totalItems === 0 ? 0 : Math.min(start + Math.max(0, visibleCount) - 1, totalItems);
  const plural = totalItems === 1 ? noun : (pluralNoun ?? `${noun}s`);

  return (
    <footer className="eflow-accounting-pagination" aria-label={`${plural} pagination`}>
      <p role="status" className="eflow-accounting-pagination__summary">
        {loading
          ? `Loading ${plural}…`
          : `Showing ${start}–${end} of ${totalItems} ${plural}`}
      </p>
      <div className="eflow-accounting-pagination__controls">
        {onPageSizeChange && (
          <label className="eflow-accounting-pagination__size">
            <span>Rows</span>
            <select
              aria-label={`Rows per page for ${plural}`}
              value={pageSize}
              disabled={loading}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {BUDGET_PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="eflow-accounting-pagination__page">
          Page {safePage} of {totalPages}
        </span>
        <div className="eflow-accounting-pagination__buttons">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </footer>
  );
}
