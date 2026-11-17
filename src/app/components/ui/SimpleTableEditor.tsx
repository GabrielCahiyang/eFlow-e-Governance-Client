import { WorkspaceTooltip } from "./workspace/WorkspaceTooltip";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

export function escapeTableCellHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function SimpleTableEditor({ onChange }: { onChange: (html: string) => void }) {
  const [rows, setRows] = useState<string[][]>([
    ["", ""],
    ["", ""],
  ]);

  const emitHtml = (data: string[][]) => {
    const html = `<table style="border-collapse:collapse;width:100%">${data
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td style="border:1px solid #e5e5e5;padding:4px 8px;">${escapeTableCellHtml(cell)}</td>`).join("")}</tr>`,
      )
      .join("")}</table>`;
    onChange(html);
  };

  const updateCell = (r: number, c: number, value: string) => {
    const next = rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row));
    setRows(next);
    emitHtml(next);
  };

  const addRow = () => {
    const next = [...rows, rows[0].map(() => "")];
    setRows(next);
    emitHtml(next);
  };

  const addCol = () => {
    const next = rows.map((row) => [...row, ""]);
    setRows(next);
    emitHtml(next);
  };

  const removeRow = (idx: number) => {
    if (rows.length <= 1) return;
    const next = rows.filter((_, i) => i !== idx);
    setRows(next);
    emitHtml(next);
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-2">
      <table aria-label="Completion note table" className="w-full border-collapse">
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="border border-neutral-200 p-0">
                  <input
                    aria-label={`Row ${r + 1}, column ${c + 1}`}
                    value={cell}
                    onChange={(e) => updateCell(r, c, e.target.value)}
                    className="w-full px-2 py-1.5 text-[12px] outline-none"
                  />
                </td>
              ))}
              <td className="w-6 text-center">
                <WorkspaceTooltip content={`Remove row ${r + 1}`}><button aria-label={`Remove row ${r + 1}`} type="button" onClick={() => removeRow(r)} className="text-neutral-300 hover:text-red-500">
                  <Trash2 size={12} />
                </button></WorkspaceTooltip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-3 mt-2">
        <button type="button" onClick={addRow} className="text-[11px] flex items-center gap-1 text-neutral-500 hover:text-neutral-800">
          <Plus size={11} /> Row
        </button>
        <button type="button" onClick={addCol} className="text-[11px] flex items-center gap-1 text-neutral-500 hover:text-neutral-800">
          <Plus size={11} /> Column
        </button>
      </div>
    </div>
  );
}
