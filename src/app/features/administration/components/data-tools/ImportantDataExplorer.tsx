import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Database,
  Download,
  Eye,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";

import { Button } from "../../../../components/ui/button";
import { DateInput } from "../../../../components/ui/DateInput";
import { PaginationBar } from "../../../../components/ui/PaginationBar";
import { useResizableColumns } from "../../../../components/ui/useResizableColumns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog";
import { FeedbackState } from "../../../../components/ui/FeedbackState";
import {
  Card,
  SearchInput,
  WSelect,
} from "../../../../components/workflow/primitives";
import {
  QUICK_EXPLORER_TABLES,
  formatExplorerCell,
} from "../../selectors/backupSelectors";
import {
  downloadTableExport,
  fetchTableRows,
  type BackupTableRowsResponse,
  type TableExportFormat,
  type TableExportScope,
} from "../../services/backupService";

type ExplorerColumnMeta = BackupTableRowsResponse["columns"][number];

function defaultExplorerColumnWidth(col: ExplorerColumnMeta): number {
  const headerMin = col.name.length * 8.5 + 44;
  if (col.is_bool) return Math.max(headerMin, 120);
  if (col.is_uuid) return Math.max(headerMin, 185);
  if (col.is_date) return Math.max(headerMin, 180);
  if (col.is_numeric) return Math.max(headerMin, 125);
  return Math.max(headerMin, 175);
}

export function ImportantDataExplorer({
  active,
  availableTables,
  safeExcludedTables,
  selectedTable,
  onSelectTable,
  onStageTableDump,
  onNotify,
}: {
  active: boolean;
  availableTables: string[];
  safeExcludedTables: string[];
  selectedTable: string;
  onSelectTable: (table: string) => void;
  onStageTableDump: (tables: string[]) => void;
  onNotify: (message: string, tone?: "success" | "error") => void;
}) {
  const sensitiveSet = useMemo(
    () => new Set(safeExcludedTables),
    [safeExcludedTables],
  );

  const browsableTables = useMemo(
    () => availableTables.filter((name) => !sensitiveSet.has(name)),
    [availableTables, sensitiveSet],
  );

  const quickChips = useMemo(() => {
    const tableSet = new Set(browsableTables);
    return QUICK_EXPLORER_TABLES.filter(
      (entry) => tableSet.size === 0 || tableSet.has(entry.table),
    );
  }, [browsableTables]);

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filterCol, setFilterCol] = useState("__none__");
  const [filterVal, setFilterVal] = useState("");
  const [appliedFilterCol, setAppliedFilterCol] = useState("__none__");
  const [appliedFilterVal, setAppliedFilterVal] = useState("");
  const [dateCol, setDateCol] = useState("__auto__");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("__auto__");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [exportScope, setExportScope] = useState<TableExportScope>("filtered");
  const [exportingFormat, setExportingFormat] = useState<TableExportFormat | null>(
    null,
  );
  const [data, setData] = useState<BackupTableRowsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inspectedRow, setInspectedRow] = useState<Record<string, unknown> | null>(
    null,
  );

  // Debounce free-text search and filter value so typing feels responsive without hammering the gateway.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(searchInput);
      setAppliedFilterCol(filterCol);
      setAppliedFilterVal(filterVal);
      setPage(1);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [searchInput, filterCol, filterVal]);

  const resetFiltersForTable = useCallback(() => {
    setSearchInput("");
    setAppliedSearch("");
    setFilterCol("__none__");
    setFilterVal("");
    setAppliedFilterCol("__none__");
    setAppliedFilterVal("");
    setDateCol("__auto__");
    setDateFrom("");
    setDateTo("");
    setSortBy("__auto__");
    setSortDir("desc");
    setPage(1);
  }, []);

  const handleSelectTable = (table: string) => {
    onSelectTable(table);
    resetFiltersForTable();
  };

  const loadRows = useCallback(async () => {
    if (!active || !selectedTable) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetchTableRows(selectedTable, {
        page,
        pageSize,
        search: appliedSearch,
        sortBy: sortBy === "__auto__" ? undefined : sortBy,
        sortDir,
        filterCol:
          appliedFilterCol !== "__none__" ? appliedFilterCol : undefined,
        filterVal:
          appliedFilterCol !== "__none__" ? appliedFilterVal : undefined,
        dateCol: dateCol === "__auto__" ? undefined : dateCol,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setData(response);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : `Could not load rows for ${selectedTable}.`,
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [
    active,
    selectedTable,
    page,
    pageSize,
    appliedSearch,
    sortBy,
    sortDir,
    appliedFilterCol,
    appliedFilterVal,
    dateCol,
    dateFrom,
    dateTo,
  ]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const columns = data?.columns || [];
  const filterableColumns = useMemo(
    () => columns.filter((col) => col.filterable),
    [columns],
  );
  const sortableColumns = useMemo(
    () => columns.filter((col) => col.sortable),
    [columns],
  );
  const dateColumns = useMemo(
    () => columns.filter((col) => col.is_date),
    [columns],
  );

  // Show up to 8 key columns in the table grid to stay readable, while keeping all fields in Inspect & Export.
  const visibleColumns = useMemo(() => {
    if (columns.length <= 8) return columns;
    const priorityNames = new Set([
      "id",
      "title",
      "name",
      "full_name",
      "email",
      "purpose",
      "action",
      "entity_type",
      "actor_name",
      "status",
      "role",
      "fiscal_year",
      "approved_amount",
      "requested_amount",
      "declared_spent",
      "created_at",
      "updated_at",
    ]);
    const prioritized = columns.filter((col) => priorityNames.has(col.name));
    const remaining = columns.filter((col) => !priorityNames.has(col.name));
    return [...prioritized, ...remaining].slice(0, 8);
  }, [columns]);

  const explorerColumnSpecs = useMemo(
    () => [
      ...visibleColumns.map((col) => ({
        key: col.name,
        defaultWidth: defaultExplorerColumnWidth(col),
        minWidth: Math.max(104, Math.ceil(col.name.length * 8 + 36)),
        maxWidth: 560,
      })),
      { key: "__record__", defaultWidth: 108, minWidth: 96, maxWidth: 160 },
    ],
    [visibleColumns],
  );
  const {
    widths: colWidths,
    totalWidth: tableTotalWidth,
    getResizeHandleProps,
  } = useResizableColumns(explorerColumnSpecs);

  const hasFilters = Boolean(
    searchInput.trim() ||
      (filterCol !== "__none__" && filterVal.trim()) ||
      dateFrom ||
      dateTo ||
      sortBy !== "__auto__",
  );

  const handleExport = async (format: TableExportFormat) => {
    if (!selectedTable || exportingFormat) return;
    setExportingFormat(format);
    try {
      const result = await downloadTableExport(
        selectedTable,
        format,
        exportScope,
        {
          page,
          pageSize,
          search: appliedSearch,
          sortBy: sortBy === "__auto__" ? undefined : sortBy,
          sortDir,
          filterCol:
            appliedFilterCol !== "__none__" ? appliedFilterCol : undefined,
          filterVal:
            appliedFilterCol !== "__none__" ? appliedFilterVal : undefined,
          dateCol: dateCol === "__auto__" ? undefined : dateCol,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
      );
      onNotify(
        `Exported ${result.rowCount.toLocaleString()} row(s) from ${selectedTable} as ${format.toUpperCase()}${result.truncated ? " (capped at 50,000 rows; use DB Dump for full unsplit table)" : ""}.`,
        "success",
      );
    } catch (caught) {
      onNotify(
        caught instanceof Error ? caught.message : "Export failed.",
        "error",
      );
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <Card
        title="Data explorer"
        subtitle="Browse, filter, paginate, and export operational tables without altering live records."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!selectedTable}
              onClick={() => onStageTableDump([selectedTable])}
            >
              <Database size={13} aria-hidden="true" />
              Dump this table (.sql/.zip)
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => void loadRows()}
            >
              <RefreshCw
                size={13}
                aria-hidden="true"
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-[var(--eflow-text-muted)]">
              Key datasets
            </span>
            {quickChips.map((chip) => {
              const isSelected = selectedTable === chip.table;
              return (
                <Button
                  key={chip.table}
                  type="button"
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => handleSelectTable(chip.table)}
                >
                  {chip.label}
                </Button>
              );
            })}
          </div>

          <div className="space-y-3 rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-subtle)]/50 p-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
              <div className="min-w-0 xl:col-span-3">
                <label className="mb-1 block text-xs font-medium text-[var(--eflow-text-muted)]">
                  Table
                </label>
                <WSelect
                  ariaLabel="Select database table"
                  value={selectedTable}
                  onChange={handleSelectTable}
                  options={(browsableTables.length
                    ? browsableTables
                    : [selectedTable]
                  ).map((table) => ({
                    value: table,
                    label: table,
                  }))}
                  className="w-full !min-w-0"
                />
              </div>

              <div className="min-w-0 xl:col-span-4">
                <label className="mb-1 block text-xs font-medium text-[var(--eflow-text-muted)]">
                  Search
                </label>
                <SearchInput
                  value={searchInput}
                  onChange={setSearchInput}
                  placeholder={`Search in ${selectedTable}…`}
                />
              </div>

              <div className="min-w-0 xl:col-span-2">
                <label className="mb-1 block text-xs font-medium text-[var(--eflow-text-muted)]">
                  Column filter
                </label>
                <WSelect
                  ariaLabel="Filter by column"
                  value={filterCol}
                  onChange={(value) => {
                    setFilterCol(value);
                    if (value === "__none__") setFilterVal("");
                  }}
                  options={[
                    { value: "__none__", label: "Any column" },
                    ...filterableColumns.map((col) => ({
                      value: col.name,
                      label: col.name,
                    })),
                  ]}
                  className="w-full !min-w-0"
                />
              </div>

              <div className="min-w-0 xl:col-span-3">
                <label className="mb-1 block text-xs font-medium text-[var(--eflow-text-muted)]">
                  Filter value
                </label>
                <input
                  type="text"
                  disabled={filterCol === "__none__"}
                  value={filterVal}
                  onChange={(event) => setFilterVal(event.target.value)}
                  placeholder={
                    filterCol === "__none__"
                      ? "Choose a column first"
                      : `Contains in ${filterCol}…`
                  }
                  aria-label="Column filter value"
                  className="h-9 w-full rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-3 text-xs text-[var(--eflow-text)] outline-none disabled:opacity-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 items-end">
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-[var(--eflow-text-muted)]">
                  Date field
                </label>
                <WSelect
                  ariaLabel="Date filter column"
                  value={dateCol}
                  onChange={(value) => {
                    setDateCol(value);
                    setPage(1);
                  }}
                  options={[
                    {
                      value: "__auto__",
                      label: dateColumns.length
                        ? `Auto (${dateColumns[0].name})`
                        : "No date field",
                    },
                    ...dateColumns.map((col) => ({
                      value: col.name,
                      label: col.name,
                    })),
                  ]}
                  className="w-full !min-w-0"
                />
              </div>

              <label className="min-w-0 text-xs font-medium text-[var(--eflow-text-muted)]">
                From
                <DateInput
                  aria-label="Filter rows from date"
                  disabled={dateColumns.length === 0}
                  value={dateFrom}
                  onChange={(event) => {
                    setDateFrom(event.target.value);
                    setPage(1);
                  }}
                  className="mt-1 h-9 w-full rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-3 text-xs"
                />
              </label>

              <label className="min-w-0 text-xs font-medium text-[var(--eflow-text-muted)]">
                Through
                <DateInput
                  aria-label="Filter rows through date"
                  disabled={dateColumns.length === 0}
                  value={dateTo}
                  onChange={(event) => {
                    setDateTo(event.target.value);
                    setPage(1);
                  }}
                  className="mt-1 h-9 w-full rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-3 text-xs"
                />
              </label>

              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-[var(--eflow-text-muted)]">
                  Sort by
                </label>
                <WSelect
                  ariaLabel="Sort rows by column"
                  value={sortBy}
                  onChange={(value) => {
                    setSortBy(value);
                    setPage(1);
                  }}
                  options={[
                    {
                      value: "__auto__",
                      label: data?.sort_by ? `Default (${data.sort_by})` : "Default",
                    },
                    ...sortableColumns.map((col) => ({
                      value: col.name,
                      label: col.name,
                    })),
                  ]}
                  className="w-full !min-w-0"
                />
              </div>

              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-[var(--eflow-text-muted)]">
                  Order
                </label>
                <WSelect
                  ariaLabel="Sort direction"
                  value={sortDir}
                  onChange={(value) => {
                    setSortDir(value as "asc" | "desc");
                    setPage(1);
                  }}
                  options={[
                    { value: "desc", label: "Newest / Desc" },
                    { value: "asc", label: "Oldest / Asc" },
                  ]}
                  className="w-full !min-w-0"
                />
              </div>

              <div className="min-w-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!hasFilters}
                  onClick={resetFiltersForTable}
                  className="h-9 w-full whitespace-nowrap"
                >
                  <RotateCcw size={13} aria-hidden="true" />
                  Clear filters
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-[var(--eflow-text)] whitespace-nowrap">
                Export
              </span>
              <WSelect
                ariaLabel="Export scope"
                value={exportScope}
                onChange={(value) => setExportScope(value as TableExportScope)}
                options={[
                  { value: "filtered", label: "All matching rows" },
                  { value: "page", label: "Current page only" },
                  { value: "all", label: "All rows in table" },
                ]}
                className="!min-w-[175px] h-8 text-xs"
              />
            </div>
            <div
              role="group"
              aria-label={`Export ${selectedTable}`}
              className="flex flex-wrap items-center gap-1.5"
            >
              {(["csv", "xlsx", "json", "jsonl", "sql"] as TableExportFormat[]).map(
                (fmt) => (
                  <Button
                    key={fmt}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={loading || exportingFormat !== null || Boolean(error)}
                    onClick={() => void handleExport(fmt)}
                  >
                    {exportingFormat === fmt ? (
                      <LoaderCircle
                        size={12}
                        aria-hidden="true"
                        className="animate-spin"
                      />
                    ) : (
                      <Download size={12} aria-hidden="true" />
                    )}
                    {fmt === "xlsx" ? "Excel" : fmt.toUpperCase()}
                  </Button>
                ),
              )}
            </div>
          </div>

          {error && (
            <FeedbackState
              tone="error"
              title={`Could not inspect ${selectedTable}`}
              onRetry={() => void loadRows()}
            >
              {error}
            </FeedbackState>
          )}

          {data && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--eflow-text-muted)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-semibold text-[var(--eflow-text)]">
                  {data.name}
                </span>
                <span className="rounded-full bg-[var(--eflow-subtle)] px-2 py-0.5 text-[11px]">
                  {data.domain_label}
                </span>
                {data.important && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    Key data
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {columns.some((col) => col.redacted) && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-700">
                    <ShieldAlert size={12} aria-hidden="true" />
                    Sensitive columns masked
                  </span>
                )}
                <span className="hidden text-[11px] sm:inline">
                  Drag column edges to resize · Double-click to reset
                </span>
              </div>
            </div>
          )}

          <div
            className="eflow-scroll-region min-w-0 overflow-x-auto rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-surface)]"
            role="region"
            aria-label={`${selectedTable} table rows`}
            tabIndex={0}
          >
            <table
              className="border-collapse text-left text-xs"
              style={{
                width: `${tableTotalWidth}px`,
                minWidth: "100%",
                tableLayout: "fixed",
              }}
            >
              <colgroup>
                {visibleColumns.map((col) => (
                  <col
                    key={col.name}
                    style={{ width: `${colWidths[col.name]}px` }}
                  />
                ))}
                <col style={{ width: `${colWidths.__record__ ?? 108}px` }} />
              </colgroup>
              <thead>
                <tr className="border-b border-[var(--eflow-border)] bg-[var(--eflow-subtle)]">
                  {visibleColumns.map((col) => (
                    <th
                      key={col.name}
                      scope="col"
                      className="relative whitespace-nowrap px-3.5 py-2.5 font-mono text-[11px] font-semibold text-[var(--eflow-text-muted)] select-none"
                    >
                      <span className="block truncate pr-2" title={col.name}>
                        {col.name}
                      </span>
                      <span
                        {...getResizeHandleProps(col.name, col.name)}
                        className="absolute right-0 top-1.5 bottom-1.5 w-2 cursor-col-resize select-none border-r border-transparent hover:border-primary/60 focus-visible:border-primary focus-visible:outline-none"
                      />
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="sticky right-0 z-10 whitespace-nowrap bg-[var(--eflow-subtle)] px-3.5 py-2.5 text-right text-[11px] font-semibold text-[var(--eflow-text-muted)] shadow-[-1px_0_0_var(--eflow-border)]"
                  >
                    Record
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, rowIdx) => (
                    <tr
                      key={`skeleton-${rowIdx}`}
                      className="border-b border-[var(--eflow-border)]/60"
                    >
                      {Array.from({
                        length: Math.max(2, visibleColumns.length + 1),
                      }).map((__, colIdx) => (
                        <td key={colIdx} className="px-3.5 py-2.5">
                          <div className="h-4 w-24 animate-pulse rounded bg-neutral-200/70" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !data || data.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={Math.max(1, visibleColumns.length + 1)}
                      className="px-4 py-10 text-center text-xs text-[var(--eflow-text-muted)]"
                    >
                      {error
                        ? "Table records could not be loaded."
                        : hasFilters
                          ? `No rows in ${selectedTable} match these filters.`
                          : `${selectedTable} has no records yet.`}
                    </td>
                  </tr>
                ) : (
                  data.rows.map((row, rowIndex) => (
                    <tr
                      key={String(row.id ?? rowIndex)}
                      className="border-b border-[var(--eflow-border)]/60 hover:bg-[var(--eflow-subtle)]/60"
                    >
                      {visibleColumns.map((col) => (
                        <td
                          key={col.name}
                          className="truncate px-3.5 py-2.5 font-mono text-[11.5px] text-[var(--eflow-text)]"
                          title={
                            row[col.name] === null || row[col.name] === undefined
                              ? ""
                              : typeof row[col.name] === "object"
                                ? JSON.stringify(row[col.name])
                                : String(row[col.name])
                          }
                        >
                          {formatExplorerCell(row[col.name])}
                        </td>
                      ))}
                      <td className="sticky right-0 bg-[var(--eflow-surface)] px-3.5 py-2 text-right shadow-[-1px_0_0_var(--eflow-border)]">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setInspectedRow(row)}
                          aria-label={`Inspect row ${rowIndex + 1} in ${selectedTable}`}
                          className="whitespace-nowrap"
                        >
                          <Eye size={13} aria-hidden="true" />
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data && (
            <PaginationBar
              page={data.page}
              pageSize={data.page_size}
              total={data.total}
              totalPages={data.total_pages}
              itemLabel="rows"
              disabled={loading}
              onPageChange={setPage}
              onPageSizeChange={(nextSize) => {
                setPageSize(nextSize);
                setPage(1);
              }}
            />
          )}
        </div>
      </Card>

      <Dialog
        open={Boolean(inspectedRow)}
        onOpenChange={(open) => {
          if (!open) setInspectedRow(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">
              {selectedTable} record
            </DialogTitle>
            <DialogDescription>
              Read-only view. Sensitive secrets and tokens remain masked.
            </DialogDescription>
          </DialogHeader>
          {inspectedRow && (
            <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
              <div className="overflow-hidden rounded-lg border border-[var(--eflow-border)]">
                <table className="w-full border-collapse text-left text-xs">
                  <tbody className="divide-y divide-[var(--eflow-border)]/70">
                    {Object.entries(inspectedRow).map(([field, value]) => (
                      <tr key={field}>
                        <th
                          scope="row"
                          className="w-44 whitespace-nowrap bg-[var(--eflow-subtle)]/60 px-3 py-2 align-top font-mono text-[11px] font-medium text-[var(--eflow-text-muted)]"
                        >
                          {field}
                        </th>
                        <td className="break-all px-3 py-2 font-mono text-[11.5px] text-[var(--eflow-text)]">
                          {formatExplorerCell(value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details className="rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-subtle)]/50 px-3 py-2">
                <summary className="cursor-pointer text-xs font-medium text-[var(--eflow-text-muted)]">
                  Raw JSON
                </summary>
                <pre className="mt-2 max-h-48 overflow-auto font-mono text-[11px] text-[var(--eflow-text)]">
                  {JSON.stringify(inspectedRow, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
