// ─── eFlow Report Service ────────────────────────────────────────
// Client-side export of the EXACT rows already on screen. No export may contain
// data the user cannot see — callers pass their already-filtered, already-
// scoped rows here.
//
// CSV  → Blob download (Excel-friendly, UTF-8 BOM).
// PDF  → styled print window (dependency-free; the browser's "Save as PDF").
//        Includes report title, applied filters, generated time, totals, the
//        table, and an optional chart snapshot (SVG/canvas dataURL).

import { recordAudit } from './auditService';
import {
  escapeCsv as formatCsvValue,
  escapeHtml as formatHtmlValue,
  safeFilename as formatFilename,
} from "../features/reports/services/formatting";

export interface ReportColumn<T> {
  key: string;
  header: string;
  value: (row: T) => string | number;
}

export interface ReportMeta {
  title: string;
  subtitle?: string;
  filters?: Record<string, string>;
  totals?: Record<string, string | number>;
  /** Optional chart image as a data URL, rendered above the table in the PDF. */
  chartDataUrl?: string;
}

function escapeCsv(value: string | number): string {
  return formatCsvValue(value);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(title: string, ext: string): string {
  return formatFilename(title, ext);
}

export function recordReportExport(meta: ReportMeta, format: "csv" | "pdf", rowCount: number): void {
  recordAudit({
    entityType: 'report',
    entityId: meta.title,
    action: 'report.exported',
    metadata: { format, rows: rowCount, filters: meta.filters },
  });
}

// ─── CSV ─────────────────────────────────────────────────────────
export function exportCsv<T>(rows: T[], columns: ReportColumn<T>[], meta: ReportMeta): void {
  const header = columns.map((c) => escapeCsv(c.header)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCsv(c.value(row))).join(','));
  const csv = '﻿' + [header, ...lines].join('\r\n');
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), safeFilename(meta.title, 'csv'));

  recordReportExport(meta, 'csv', rows.length);
}

// ─── PDF preview document ───────────────────────────────────────
// The same document powers the in-app preview and the legacy print action.
export function buildReportHtml<T>(rows: T[], columns: ReportColumn<T>[], meta: ReportMeta): string {
  const generatedAt = new Date().toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const filtersHtml = meta.filters && Object.keys(meta.filters).length
    ? `<div class="filters">${Object.entries(meta.filters)
        .map(([k, v]) => `<span class="chip"><b>${escapeHtml(k)}:</b> ${escapeHtml(String(v))}</span>`)
        .join('')}</div>`
    : '';

  const totalsHtml = meta.totals && Object.keys(meta.totals).length
    ? `<div class="totals">${Object.entries(meta.totals)
        .map(([k, v]) => `<div class="total"><div class="tlabel">${escapeHtml(k)}</div><div class="tval">${escapeHtml(String(v))}</div></div>`)
        .join('')}</div>`
    : '';

  const chartHtml = meta.chartDataUrl
    ? `<div class="chart"><img src="${meta.chartDataUrl}" /></div>`
    : '';

  const thead = `<tr>${columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join('')}</tr>`;
  const tbody = rows
    .map((row) => `<tr>${columns.map((c) => `<td>${escapeHtml(String(c.value(row)))}</td>`).join('')}</tr>`)
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
  <title>${escapeHtml(meta.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #171717; margin: 32px; }
    .brand { display:flex; align-items:center; gap:10px; margin-bottom: 4px; }
    .brand .mark { width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#0085FF,#0066CC);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px; }
    .brand .name { font-weight:700; font-size:14px; letter-spacing:.02em; }
    h1 { font-size: 20px; margin: 8px 0 2px; }
    .subtitle { color:#6b7280; font-size: 12px; margin-bottom: 2px; }
    .meta { color:#9ca3af; font-size: 11px; margin-bottom: 14px; }
    .filters { margin: 10px 0; display:flex; flex-wrap:wrap; gap:6px; }
    .chip { background:#f3f4f6; border:1px solid #e5e7eb; border-radius:999px; padding:3px 10px; font-size:11px; }
    .chip b { font-weight:600; }
    .totals { display:flex; gap:10px; flex-wrap:wrap; margin: 12px 0 18px; }
    .total { border:1px solid #e5e7eb; border-radius:10px; padding:10px 14px; min-width:120px; }
    .tlabel { font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:#9ca3af; }
    .tval { font-size:20px; font-weight:700; margin-top:2px; }
    .chart { margin: 6px 0 18px; }
    .chart img { max-width:100%; border:1px solid #e5e7eb; border-radius:10px; }
    table { width:100%; border-collapse:collapse; font-size:11px; }
    th { text-align:left; text-transform:uppercase; font-size:9.5px; letter-spacing:.05em; color:#6b7280; border-bottom:2px solid #e5e7eb; padding:8px 8px; }
    td { border-bottom:1px solid #f0f0f0; padding:7px 8px; }
    tr:nth-child(even) td { background:#fafafa; }
    .footer { margin-top:18px; color:#9ca3af; font-size:10px; }
    @media print { body { margin: 12mm; } @page { size: A4 landscape; } }
  </style></head>
  <body>
    <div class="brand"><div class="mark">eF</div><div class="name">eFlow · Ormoc City e-Governance</div></div>
    <h1>${escapeHtml(meta.title)}</h1>
    ${meta.subtitle ? `<div class="subtitle">${escapeHtml(meta.subtitle)}</div>` : ''}
    <div class="meta">Generated ${escapeHtml(generatedAt)} · ${rows.length} row(s)</div>
    ${filtersHtml}
    ${totalsHtml}
    ${chartHtml}
    <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
    <div class="footer">This report contains only records visible to the exporting user. Confidential — internal use only.</div>
  </body></html>`;

  return html;
}

// ─── PDF (legacy print window) ──────────────────────────────────
export function exportPdf<T>(rows: T[], columns: ReportColumn<T>[], meta: ReportMeta): void {
  const html = buildReportHtml(rows, columns, meta);

  const win = window.open('', '_blank', 'width=1100,height=800');
  if (!win) {
    // Popup blocked — fall back to CSV so the action still produces output.
    exportCsv(rows, columns, meta);
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.addEventListener('load', () => win.print(), { once: true });

  recordReportExport(meta, 'pdf', rows.length);
}

function escapeHtml(s: string): string {
  return formatHtmlValue(s);
}
