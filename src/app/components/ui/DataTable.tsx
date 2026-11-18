// ─── Reusable DataTable Component ────────────────────────────────
import React, { useState, useMemo } from "react";
import { EmptyState, Search, Skeleton, Text } from "@vibe/core";
import { FeedbackState } from "./FeedbackState";
import { EmptyStateIllustration, type EmptyIllustration } from './EmptyStateIllustration';
import { useResizableColumns } from "./useResizableColumns";

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (item: T) => string | number;
  width?: string;
  minWidthPx?: number;
  defaultWidthPx?: number;
  maxWidthPx?: number;
  nowrap?: boolean;
  action?: boolean;
}

export interface DataTableViewState { search: string; sortKey: string | null; sortDir: 'asc' | 'desc' }
interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  searchPlaceholder?: string;
  searchFilter?: (item: T, query: string) => boolean;
  loading?: boolean;
  renderLoadingCell?: (column: Column<T>) => React.ReactNode;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  emptyIllustration?: EmptyIllustration;
  toolbar?: React.ReactNode;
  totalRecords?: number;
  density?: "comfortable" | "compact";
  ariaLabel?: string;
  error?: string;
  onRetry?: () => void;
  viewState?: DataTableViewState;
  onViewStateChange?: (state: DataTableViewState) => void;
  resizable?: boolean;
  hideFooterCount?: boolean;
  footer?: React.ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  searchPlaceholder = "Search...",
  searchFilter,
  loading,
  renderLoadingCell,
  emptyMessage = "No data found",
  emptyIcon,
  emptyIllustration = 'empty',
  toolbar,
  totalRecords,
  density = "comfortable",
  ariaLabel = "Data table",
  error,
  onRetry,
  viewState,
  onViewStateChange,
  resizable = false,
  hideFooterCount = false,
  footer,
}: DataTableProps<T>) {
  const [localViewState, setLocalViewState] = useState<DataTableViewState>({ search: '', sortKey: null, sortDir: 'asc' });
  const { search, sortKey, sortDir } = viewState ?? localViewState;
  const updateView = (next: Partial<DataTableViewState>) => (onViewStateChange ?? setLocalViewState)({ ...(viewState ?? localViewState), ...next });
  const setSearch = (search: string) => updateView({ search });

  const columnSpecs = useMemo(
    () =>
      columns.map((col) => ({
        key: col.key,
        defaultWidth: col.defaultWidthPx ?? (col.action ? 112 : Math.max(120, col.header.length * 9 + 44)),
        minWidth: col.minWidthPx ?? (col.action ? 96 : 104),
        maxWidth: col.maxWidthPx ?? 640,
      })),
    [columns],
  );
  const { widths, totalWidth, getResizeHandleProps } = useResizableColumns(columnSpecs);

  const filtered = useMemo(() => {
    let result = data;
    if (search && searchFilter) {
      result = result.filter((item) => searchFilter(item, search.toLowerCase()));
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.sortValue) {
        const fn = col.sortValue;
        result = [...result].sort((a, b) => {
          const va = fn(a);
          const vb = fn(b);
          const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
          return sortDir === "asc" ? cmp : -cmp;
        });
      }
    }
    return result;
  }, [data, search, searchFilter, sortKey, sortDir, columns]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      updateView({ sortDir: sortDir === 'asc' ? 'desc' : 'asc' });
    } else {
      updateView({ sortKey: key, sortDir: 'asc' });
    }
  };

  return (
    <section className="eflow-data-table min-w-0 overflow-hidden rounded-[10px] border border-border bg-card text-card-foreground shadow-sm" data-density={density} aria-label={ariaLabel} aria-busy={loading || undefined}>
      {/* Search */}
      {(searchFilter || toolbar) && (
        <div className="border-b border-border px-5 py-3">
          <div className="eflow-table-toolbar">
            {searchFilter && <div className="min-w-0 w-full flex-1 sm:min-w-[260px]">
              <Search
                value={search}
                onChange={setSearch}
                onClear={() => setSearch("")}
                placeholder={searchPlaceholder}
                inputAriaLabel={searchPlaceholder}
                showClearIcon
                size="small"
              />
            </div>}
            {toolbar}
          </div>
        </div>
      )}

      {/* Table */}
      {error && <FeedbackState tone="error" title="Unable to load records" onRetry={onRetry} pending={loading}>{error}</FeedbackState>}
      <div className="eflow-scroll-region overflow-x-auto" role="region" aria-label={`Scrollable ${ariaLabel.toLowerCase()}`} tabIndex={0}>
        <table
          className={resizable ? "border-collapse" : "w-full min-w-[720px]"}
          style={resizable ? { width: `${totalWidth}px`, minWidth: "100%", tableLayout: "fixed" } : undefined}
        >
          {resizable && (
            <colgroup>
              {columns.map((col) => (
                <col key={col.key} style={{ width: `${widths[col.key]}px` }} />
              ))}
            </colgroup>
          )}
          <thead>
            <tr className="border-b border-border bg-muted">
              {columns.map((col) => {
                const headerWidthStyle = resizable
                  ? undefined
                  : {
                      ...(col.width ? { width: col.width } : {}),
                      ...(col.minWidthPx ? { minWidth: `${col.minWidthPx}px` } : {}),
                      ...(col.maxWidthPx ? { maxWidth: `${col.maxWidthPx}px` } : {}),
                    };
                return (
                  <th
                    key={col.key}
                    scope="col"
                    data-action={col.action || undefined}
                    aria-sort={
                      col.sortable && sortKey === col.key
                        ? sortDir === "asc" ? "ascending" : "descending"
                        : col.sortable ? "none" : undefined
                    }
                    className={`relative px-5 py-3 text-left text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.06em] whitespace-nowrap ${
                      col.sortable ? "select-none" : ""
                    }`}
                    style={headerWidthStyle}
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      {col.sortable ? (
                        <button
                          type="button"
                          className="flex min-w-0 items-center gap-1 rounded-sm text-left whitespace-nowrap transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          onClick={() => handleSort(col.key)}
                        >
                          {col.header}
                          {sortKey === col.key && <span aria-hidden="true">{sortDir === "asc" ? "▲" : "▼"}</span>}
                        </button>
                      ) : (
                        <span className="truncate">{col.header}</span>
                      )}
                      {resizable && !col.action && (
                        <span
                          {...getResizeHandleProps(col.key, col.header)}
                          className="absolute right-0 top-1.5 bottom-1.5 w-2 cursor-col-resize select-none border-r border-transparent hover:border-primary/60 focus-visible:border-primary focus-visible:outline-none"
                        />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skel-${i}`} className="border-b border-border/60">
                  {columns.map((col, columnIndex) => (
                    <td key={col.key} className="px-5 py-3">
                      {renderLoadingCell ? renderLoadingCell(col) : <div style={{ width: `${60 + ((i + columnIndex) % 4) * 10}%` }}>
                        <Skeleton type="rectangle" size="custom" height={16} fullWidth />
                      </div>}
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? null : filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-12 text-center">
                  <EmptyState
                    layout="compact"
                    title="Nothing to show"
                    description={emptyMessage}
                    visual={emptyIcon ?? <EmptyStateIllustration kind={search ? 'search' : emptyIllustration}/>}
                  />
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  onClick={onRowClick ? (event) => {
                    if (!(event.target as HTMLElement).closest("button,a,input,select,textarea,[role='button'],[role='checkbox']")) onRowClick(item);
                  } : undefined}
                  onKeyDown={onRowClick ? (event) => {
                    if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      onRowClick(item);
                    }
                  } : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-label={onRowClick ? "Open record" : undefined}
                  className={`border-b border-border/60 transition-colors ${
                    onRowClick ? "cursor-pointer hover:bg-accent/70 focus-visible:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ring" : ""
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      data-action={col.action || undefined}
                      className={`px-5 py-3 align-middle ${col.nowrap ? "whitespace-nowrap" : ""}`}
                      style={
                        resizable
                          ? undefined
                          : {
                              ...(col.minWidthPx ? { minWidth: `${col.minWidthPx}px` } : {}),
                              ...(col.maxWidthPx ? { maxWidth: `${col.maxWidthPx}px` } : {}),
                            }
                      }
                    >
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer / Row count */}
      {!loading && !error && (footer || !hideFooterCount) && (
        <div className="border-t border-border px-5 py-3">
          {footer || (
            <Text type="text3" color="secondary">
              <span className="tabular-nums">{filtered.length} of {totalRecords ?? data.length}</span> records
            </Text>
          )}
        </div>
      )}
    </section>
  );
}
