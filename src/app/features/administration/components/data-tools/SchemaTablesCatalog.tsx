import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Database,
  Download,
  Eye,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

import { Button } from "../../../../components/ui/button";
import { FeedbackState } from "../../../../components/ui/FeedbackState";
import { PaginationBar } from "../../../../components/ui/PaginationBar";
import { useResizableColumns } from "../../../../components/ui/useResizableColumns";
import {
  Card,
  SearchInput,
  WSelect,
} from "../../../../components/workflow/primitives";
import {
  downloadTableExport,
  fetchBackupTables,
  type BackupTableListResponse,
} from "../../services/backupService";

export function SchemaTablesCatalog({
  active,
  selectedTables,
  onSelectedTablesChange,
  onStageDumpWithSelected,
  onBrowseTable,
  onNotify,
}: {
  active: boolean;
  selectedTables: string[];
  onSelectedTablesChange: (tables: string[]) => void;
  onStageDumpWithSelected: () => void;
  onBrowseTable: (table: string) => void;
  onNotify: (message: string, tone?: "success" | "error") => void;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [importance, setImportance] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [catalog, setCatalog] = useState<BackupTableListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exportingKey, setExportingKey] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(searchInput);
      setPage(1);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadCatalog = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetchBackupTables({
        search: appliedSearch,
        category,
        importance,
        page,
        pageSize,
        includeCounts: true,
      });
      setCatalog(response);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not inspect database tables.",
      );
    } finally {
      setLoading(false);
    }
  }, [active, appliedSearch, category, importance, page, pageSize]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const toggleTable = (tableName: string) => {
    if (selectedTables.includes(tableName)) {
      onSelectedTablesChange(selectedTables.filter((t) => t !== tableName));
    } else {
      onSelectedTablesChange([...selectedTables, tableName].sort());
    }
  };

  const quickExport = async (tableName: string, format: "csv" | "sql") => {
    const key = `${tableName}:${format}`;
    setExportingKey(key);
    try {
      const res = await downloadTableExport(tableName, format, "all");
      onNotify(
        `Exported ${res.rowCount.toLocaleString()} row(s) from ${tableName} as ${format.toUpperCase()}.`,
        "success",
      );
    } catch (caught) {
      onNotify(
        caught instanceof Error ? caught.message : `Export failed for ${tableName}.`,
        "error",
      );
    } finally {
      setExportingKey("");
    }
  };

  const hasFilters = Boolean(
    searchInput.trim() || category !== "all" || importance !== "all",
  );

  const catalogColumnSpecs = useMemo(
    () => [
      { key: "select", defaultWidth: 48, minWidth: 44, maxWidth: 64 },
      { key: "table", defaultWidth: 230, minWidth: 160, maxWidth: 420 },
      { key: "domain", defaultWidth: 180, minWidth: 140, maxWidth: 320 },
      { key: "scope", defaultWidth: 150, minWidth: 120, maxWidth: 220 },
      { key: "columns", defaultWidth: 108, minWidth: 96, maxWidth: 160 },
      { key: "rows", defaultWidth: 132, minWidth: 108, maxWidth: 200 },
      { key: "actions", defaultWidth: 245, minWidth: 220, maxWidth: 320 },
    ],
    [],
  );
  const {
    widths: catalogColWidths,
    totalWidth: catalogTotalWidth,
    getResizeHandleProps,
  } = useResizableColumns(catalogColumnSpecs);

  return (
    <div className="min-w-0 space-y-4">
      <Card
        title="Database tables"
        subtitle="Check live row counts, browse tables, export records, or select tables for a scoped database dump."
        right={
          <div className="flex flex-wrap items-center gap-2">
            {selectedTables.length > 0 && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={onStageDumpWithSelected}
                >
                  <Database size={13} aria-hidden="true" />
                  Dump selected ({selectedTables.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onSelectedTablesChange([])}
                >
                  Clear selection
                </Button>
              </>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => void loadCatalog()}
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 items-end">
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-[var(--eflow-text-muted)]">
                Search tables
              </label>
              <SearchInput
                value={searchInput}
                onChange={setSearchInput}
                placeholder="Search table or domain…"
              />
            </div>

            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-[var(--eflow-text-muted)]">
                Domain
              </label>
              <WSelect
                ariaLabel="Filter tables by domain"
                value={category}
                onChange={(value) => {
                  setCategory(value);
                  setPage(1);
                }}
                options={[
                  { value: "all", label: "All domains" },
                  ...(catalog?.domains || []).map((domain) => ({
                    value: domain.id,
                    label: domain.label,
                  })),
                ]}
                className="w-full !min-w-0"
              />
            </div>

            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-[var(--eflow-text-muted)]">
                Importance
              </label>
              <WSelect
                ariaLabel="Filter tables by importance"
                value={importance}
                onChange={(value) => {
                  setImportance(value);
                  setPage(1);
                }}
                options={[
                  { value: "all", label: "All tables" },
                  { value: "important", label: "Key operational data" },
                  { value: "supporting", label: "Supporting tables" },
                  { value: "excluded", label: "Protected config tables" },
                ]}
                className="w-full !min-w-0"
              />
            </div>

            <div className="min-w-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!hasFilters}
                onClick={() => {
                  setSearchInput("");
                  setAppliedSearch("");
                  setCategory("all");
                  setImportance("all");
                  setPage(1);
                }}
                className="h-9 w-full whitespace-nowrap"
              >
                <RotateCcw size={13} aria-hidden="true" />
                Reset table filters
              </Button>
            </div>
          </div>

          {error && (
            <FeedbackState
              tone="error"
              title="Could not inspect public tables"
              onRetry={() => void loadCatalog()}
            >
              {error}
            </FeedbackState>
          )}

          <div
            className="eflow-scroll-region min-w-0 overflow-x-auto rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-surface)]"
            role="region"
            aria-label="Database tables inventory"
            tabIndex={0}
          >
            <table
              className="border-collapse text-left text-xs"
              style={{
                width: `${catalogTotalWidth}px`,
                minWidth: "100%",
                tableLayout: "fixed",
              }}
            >
              <colgroup>
                {catalogColumnSpecs.map((spec) => (
                  <col
                    key={spec.key}
                    style={{ width: `${catalogColWidths[spec.key]}px` }}
                  />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-[var(--eflow-border)] bg-[var(--eflow-subtle)]">
                  <th scope="col" className="px-3 py-2.5 whitespace-nowrap">
                    <span className="sr-only">Select</span>
                  </th>
                  {[
                    { key: "table", label: "Table" },
                    { key: "domain", label: "Domain" },
                    { key: "scope", label: "Scope" },
                    { key: "columns", label: "Columns" },
                    { key: "rows", label: "Rows" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      className="relative whitespace-nowrap px-3 py-2.5 font-semibold text-[var(--eflow-text-muted)] select-none"
                    >
                      <span className="block truncate pr-2">{col.label}</span>
                      <span
                        {...getResizeHandleProps(col.key, col.label)}
                        className="absolute right-0 top-1.5 bottom-1.5 w-2 cursor-col-resize select-none border-r border-transparent hover:border-primary/60 focus-visible:border-primary focus-visible:outline-none"
                      />
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="sticky right-0 z-10 whitespace-nowrap bg-[var(--eflow-subtle)] px-3 py-2.5 text-right font-semibold text-[var(--eflow-text-muted)] shadow-[-1px_0_0_var(--eflow-border)]"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr
                      key={`tbl-skel-${idx}`}
                      className="border-b border-[var(--eflow-border)]/60"
                    >
                      {Array.from({ length: 7 }).map((__, colIdx) => (
                        <td key={colIdx} className="px-3 py-2.5">
                          <div className="h-4 w-20 animate-pulse rounded bg-neutral-200/70" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !catalog || catalog.items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-xs text-[var(--eflow-text-muted)]"
                    >
                      No tables match your current search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  catalog.items.map((item) => (
                    <tr
                      key={item.name}
                      className="border-b border-[var(--eflow-border)]/60 hover:bg-[var(--eflow-subtle)]/60"
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          disabled={item.sensitive}
                          checked={selectedTables.includes(item.name)}
                          onChange={() => toggleTable(item.name)}
                          aria-label={`Select ${item.name} for custom DB dump`}
                          className="h-4 w-4 rounded border-neutral-300"
                        />
                      </td>
                      <td className="px-3 py-2.5 truncate font-mono text-[12px] font-medium text-[var(--eflow-text)]" title={item.name}>
                        {item.name}
                      </td>
                      <td className="px-3 py-2.5 truncate text-[var(--eflow-text-muted)]" title={item.domain_label}>
                        {item.domain_label}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {item.sensitive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                            <LockKeyhole size={10} aria-hidden="true" />
                            Protected
                          </span>
                        ) : item.important ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            Key data
                          </span>
                        ) : (
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600">
                            Supporting
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap eflow-tabular text-[var(--eflow-text-muted)]">
                        {item.column_count}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap eflow-tabular font-medium text-[var(--eflow-text)]">
                        {item.sensitive
                          ? "Encrypted only"
                          : item.row_count === null
                            ? item.api_readable
                              ? "—"
                              : "SQL dump only"
                            : item.row_count.toLocaleString()}
                      </td>
                      <td className="sticky right-0 bg-[var(--eflow-surface)] px-3 py-2 text-right shadow-[-1px_0_0_var(--eflow-border)]">
                        <div className="inline-flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={item.sensitive || !item.api_readable}
                            onClick={() => onBrowseTable(item.name)}
                          >
                            <Eye size={12} aria-hidden="true" />
                            Browse
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={
                              item.sensitive ||
                              !item.api_readable ||
                              exportingKey !== ""
                            }
                            onClick={() => void quickExport(item.name, "csv")}
                          >
                            <Download size={12} aria-hidden="true" />
                            CSV
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={
                              item.sensitive ||
                              !item.api_readable ||
                              exportingKey !== ""
                            }
                            onClick={() => void quickExport(item.name, "sql")}
                          >
                            <Download size={12} aria-hidden="true" />
                            SQL
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {catalog && (
            <PaginationBar
              page={catalog.page}
              pageSize={catalog.page_size}
              total={catalog.total}
              totalPages={catalog.total_pages}
              pageSizeOptions={[15, 25, 50]}
              itemLabel="tables"
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
    </div>
  );
}
