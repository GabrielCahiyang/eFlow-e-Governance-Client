import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export interface AnalysisColumn<T> {
  label: string;
  value: (row: T) => string | number | null | undefined;
  render?: (row: T) => ReactNode;
}

export function ProjectAnalysisTable<T>({ label, rows, columns, rowKey }: {
  label: string;
  rows: T[];
  columns: AnalysisColumn<T>[];
  rowKey: (row: T) => string;
}) {
  const [sort, setSort] = useState({ column: 0, direction: 1 });
  const { value } = columns[sort.column];
  const sorted = [...rows].sort((a, b) => {
    const first = value(a), second = value(b);
    if (first == null) return second == null ? 0 : 1;
    if (second == null) return -1;
    const order = typeof first === "number" && typeof second === "number"
      ? first - second : String(first).localeCompare(String(second));
    return order * sort.direction;
  });

  return (
    <div className="ea-table-wrap" role="region" aria-label={`${label} table scroll area`} tabIndex={0}>
      <table className="ea-table ea-analysis-table" aria-label={label}>
        <thead><tr>{columns.map((column, index) => {
          const active = sort.column === index;
          const direction = sort.direction === 1 ? "ascending" : "descending";
          const Icon = active ? sort.direction === 1 ? ArrowUp : ArrowDown : ArrowUpDown;
          return (
            <th key={column.label} scope="col" aria-sort={active ? direction : undefined}>
              <button type="button" onClick={() => setSort({ column: index, direction: active ? -sort.direction : 1 })}>
                {column.label} <Icon size={13} aria-hidden="true" />
              </button>
            </th>
          );
        })}</tr></thead>
        <tbody>{sorted.map(row => (
          <tr key={rowKey(row)}>{columns.map(column => (
            <td key={column.label}>{column.render ? column.render(row) : column.value(row) ?? "—"}</td>
          ))}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}
