// ─── Reusable DataTable Component ────────────────────────────────
import React, { useState, useMemo } from "react";
import { EmptyState, Search, Skeleton, Text } from "@vibe/core";

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (item: T) => string | number;
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  searchPlaceholder?: string;
  searchFilter?: (item: T, query: string) => boolean;
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  toolbar?: React.ReactNode;
  totalRecords?: number;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  searchPlaceholder = "Search...",
  searchFilter,
  loading,
  emptyMessage = "No data found",
  emptyIcon,
  toolbar,
  totalRecords,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-[10px] border border-border bg-card text-card-foreground shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]" aria-label="Data table">
      {/* Search */}
      {searchFilter && (
        <div className="border-b border-border px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 w-full flex-1 sm:min-w-[260px]">
              <Search
                value={search}
                onChange={setSearch}
                onClear={() => setSearch("")}
                placeholder={searchPlaceholder}
                inputAriaLabel={searchPlaceholder}
                showClearIcon
                size="small"
              />
            </div>
            {toolbar}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto" role="region" aria-label="Scrollable data table" tabIndex={0}>
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-border bg-muted">
              {columns.map((col) => (
                <th
                  key={col.key}
                  aria-sort={
                    col.sortable && sortKey === col.key
                      ? sortDir === "asc" ? "ascending" : "descending"
                      : col.sortable ? "none" : undefined
                  }
                  className={`px-5 py-3 text-left text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.08em] ${
                    col.sortable ? "select-none" : ""
                  }`}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-sm text-left transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.header}
                      {sortKey === col.key && <span aria-hidden="true">{sortDir === "asc" ? "▲" : "▼"}</span>}
                    </button>
                  ) : col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skel-${i}`} className="border-b border-border/60">
                  {columns.map((col, columnIndex) => (
                    <td key={col.key} className="px-5 py-3">
                      <div style={{ width: `${60 + ((i + columnIndex) % 4) * 10}%` }}>
                        <Skeleton type="rectangle" size="custom" height={16} fullWidth />
                      </div>
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-12 text-center">
                  <EmptyState
                    layout="compact"
                    title="Nothing to show"
                    description={emptyMessage}
                    visual={emptyIcon}
                  />
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  onKeyDown={onRowClick ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
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
                    <td key={col.key} className="px-5 py-3">
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Row count */}
      {!loading && (
        <div className="border-t border-border px-5 py-3">
          <Text type="text3" color="secondary">
            <span className="tabular-nums">{filtered.length} of {totalRecords ?? data.length}</span> records
          </Text>
        </div>
      )}
    </section>
  );
}
