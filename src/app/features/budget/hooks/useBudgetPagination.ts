import { useEffect, useMemo, useState } from "react";

export const DEFAULT_BUDGET_PAGE_SIZE = 10;
export const BUDGET_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export function useBudgetPagination<T>(
  items: readonly T[],
  resetKey?: string | number,
  initialPageSize = DEFAULT_BUDGET_PAGE_SIZE,
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [page, safePage]);

  const startIndex = totalItems === 0 ? 0 : (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const pageItems = useMemo(
    () => items.slice(startIndex, endIndex),
    [items, startIndex, endIndex],
  );

  const changePageSize = (nextSize: number) => {
    setPageSize(nextSize);
    setPage(1);
  };

  return {
    page: safePage,
    setPage,
    pageSize,
    setPageSize: changePageSize,
    totalItems,
    totalPages,
    startIndex,
    endIndex,
    pageItems,
  };
}
