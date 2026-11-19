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
import { formatManilaInstant } from '../shared/calendarDisplay';
import { getExportBrandHeader } from '../shared/systemRuntimeConfig';
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
  timezone?: string;
  title: string;
  subtitle?: string;
  filters?: Record<string, string>;
  totals?: Record<string, string | number>;
  /** Optional chart image as a data URL, rendered above the table in the PDF. */
  chartDataUrl?: string;
}

// Static official eFlow wordmark SVG matching src/pages/Login/components/EFlowMark.tsx
const EFLOW_REPORT_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 328 88.6632" fill="none" height="26" aria-label="eFlow" role="img">
  <path d="M248.957 75.7231L228.263 18.3341H243.943L261.117 67.7228H253.65L271.571 18.3341H285.652L303.039 67.7228H295.572L313.279 18.3341H328L307.199 75.7231H291.092L275.838 33.3747H280.745L264.957 75.7231H248.957Z" fill="#01006B"/>
  <path d="M139.926 75.0031V3.97116e-05H156.593V75.0031H139.926Z" fill="#01006B"/>
  <path d="M72.7346 75.0031V0.333407H129.164V14.2006H90.0153V75.0031H72.7346ZM88.7353 47.802V33.9348H124.577V47.802H88.7353Z" fill="#01006B"/>
  <path d="M32.748 75.8565C26.2055 75.8565 20.4453 74.5764 15.4673 72.0163C10.5604 69.4562 6.75583 65.9716 4.0535 61.5626C1.35117 57.0824 0 51.9977 0 46.3086C0 40.5484 1.31561 35.4637 3.94683 31.0547C6.64916 26.5745 10.3115 23.0899 14.9339 20.6009C19.5563 18.0408 24.7832 16.7608 30.6146 16.7608C36.2326 16.7608 41.2817 17.9697 45.7618 20.3876C50.3131 22.7343 53.9044 26.1478 56.5356 30.628C59.1668 35.0371 60.4824 40.335 60.4824 46.522C60.4824 47.162 60.4469 47.9087 60.3758 48.762C60.3046 49.5443 60.2335 50.291 60.1624 51.0021H13.5472V41.2951H51.4154L45.0151 44.1752C45.0151 41.1884 44.4107 38.5927 43.2017 36.3882C41.9928 34.1837 40.3216 32.4769 38.1882 31.268C36.0548 29.988 33.5658 29.3479 30.7212 29.3479C27.8767 29.3479 25.3521 29.988 23.1476 31.268C21.0142 32.4769 19.343 34.2192 18.1341 36.4949C16.9251 38.6994 16.3207 41.3306 16.3207 44.3885V46.9486C16.3207 50.0777 16.9962 52.8511 18.3474 55.269C19.7697 57.6157 21.7253 59.4291 24.2143 60.7092C26.7744 61.9181 29.7612 62.5226 33.1747 62.5226C36.2326 62.5226 38.8993 62.0604 41.175 61.1359C43.5218 60.2114 45.6552 58.8247 47.5752 56.9757L56.4289 66.5761C53.7977 69.5629 50.4909 71.8741 46.5085 73.5097C42.5262 75.0742 37.9393 75.8565 32.748 75.8565Z" fill="#01006B"/>
  <path d="M178.883 70.189C184.722 75.0887 192.354 77.3663 200.099 76.5208C207.845 75.6754 215.069 71.7762 220.184 65.6809C225.298 59.5856 227.884 51.7936 227.371 44.019C226.859 36.2444 223.291 29.1241 217.452 24.2245L215.164 31.0171L208.741 34.6053C211.943 37.2919 213.899 41.196 214.18 45.4589C214.461 49.7218 213.043 53.9942 210.239 57.3363C207.435 60.6784 203.473 62.8164 199.226 63.2799C194.98 63.7435 190.795 62.4947 187.593 59.8081L181.183 63.3406L178.883 70.189Z" fill="#0073ea"/>
  <path d="M216.136 23.0895C209.899 17.8559 201.885 15.258 193.858 15.8672C185.831 16.4765 178.449 20.2431 173.334 26.3383C168.219 32.4336 165.792 40.3583 166.586 48.3691C167.38 56.3798 171.33 63.8204 177.567 69.0541L179.774 62.1613L186.278 58.6732C182.858 55.8035 180.692 51.7238 180.257 47.3314C179.821 42.9391 181.152 38.5939 183.957 35.2518C186.761 31.9097 190.809 29.8444 195.21 29.5104C199.612 29.1763 204.005 30.6007 207.425 33.4704L213.974 30.0536L216.136 23.0895Z" fill="#01006B"/>
</svg>`;

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
  const csv = '\uFEFF' + [header, ...lines].join('\r\n');
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), safeFilename(meta.title, 'csv'));

  recordReportExport(meta, 'csv', rows.length);
}

// ─── PDF preview document ───────────────────────────────────────
// The same document powers the in-app preview and the legacy print action.
export function buildReportHtml<T>(rows: T[], columns: ReportColumn<T>[], meta: ReportMeta): string {
  const generatedAt = formatManilaInstant(new Date());

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

  const cellMatrix = rows.map((row) => columns.map((c) => String(c.value(row))));
  const isNumericValue = (raw: string) => {
    const trimmed = raw.trim();
    return Boolean(trimmed) && (/^-?₱[\d,]+(?:\.\d+)?$/.test(trimmed) || /^-?[\d,]+(?:\.\d+)?%?$/.test(trimmed));
  };
  const numericCols = columns.map((_, colIdx) => {
    const nonEmpty = cellMatrix.map((r) => r[colIdx].trim()).filter((v) => v && v !== '—');
    return nonEmpty.length > 0 && nonEmpty.every(isNumericValue);
  });

  const thead = `<tr>${columns.map((c, idx) => `<th${numericCols[idx] ? ' class="num"' : ''}>${escapeHtml(c.header)}</th>`).join('')}</tr>`;
  const tbody = cellMatrix
    .map((cells) => {
      const isTotal = String(cells[0] ?? '').trim().toUpperCase().startsWith('TOTAL');
      return `<tr${isTotal ? ' class="total-row"' : ''}>${cells.map((val, idx) => `<td${numericCols[idx] ? ' class="num"' : ''}>${escapeHtml(val)}</td>`).join('')}</tr>`;
    })
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
  <title>${escapeHtml(meta.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Figtree', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #182626; margin: 0 auto; padding: 32px 36px; max-width: 1120px; background: #ffffff; line-height: 1.45; }
    .masthead { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-bottom: 16px; border-bottom: 2px solid #0c6f6b; margin-bottom: 20px; }
    .brand { display: flex; align-items: center; gap: 14px; min-width: 0; }
    .brand-logo { display: flex; align-items: center; flex-shrink: 0; }
    .brand-org { border-left: 1px solid #d7dfdf; padding-left: 14px; min-width: 0; }
    .brand-org .name { font-weight: 600; font-size: 13px; color: #182626; }
    .brand-org .sub { font-size: 11.5px; color: #5d706c; margin-top: 1px; }
    .doc-meta { text-align: right; font-size: 11.5px; color: #5d706c; white-space: nowrap; }
    .doc-meta strong { display: block; color: #182626; font-weight: 600; }
    .title-block { margin-bottom: 16px; }
    h1 { font-size: 21px; font-weight: 600; color: #182626; margin: 0; letter-spacing: -0.01em; }
    .filters { margin: 14px 0 18px; display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { background: #f7f9f9; border: 1px solid #d7dfdf; border-radius: 6px; padding: 4px 10px; font-size: 11.5px; color: #526161; }
    .chip b { font-weight: 600; color: #182626; }
    .totals { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 0 0 22px; }
    .total { border: 1px solid #d7dfdf; border-radius: 10px; padding: 12px 16px; background: #ffffff; }
    .tlabel { font-size: 11.5px; font-weight: 500; color: #5d706c; }
    .tval { font-size: 20px; font-weight: 600; color: #182626; margin-top: 4px; font-variant-numeric: tabular-nums; }
    .chart { margin: 0 0 22px; }
    .chart img { max-width: 100%; border: 1px solid #d7dfdf; border-radius: 10px; padding: 8px; background: #ffffff; }
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; border: 1px solid #d7dfdf; }
    th { text-align: left; font-size: 11px; font-weight: 600; color: #526161; background: #f7f9f9; border-bottom: 1px solid #d7dfdf; padding: 10px 10px; }
    td { border-bottom: 1px solid #e9eeee; padding: 9px 10px; color: #182626; vertical-align: top; font-variant-numeric: tabular-nums; }
    th.num, td.num { text-align: right; white-space: nowrap; }
    tr.total-row td { font-weight: 600; background: #f2f6f6 !important; border-top: 1px solid #b9cbcb; }
    tr:last-child td { border-bottom: 0; }
    tr:nth-child(even) td { background: #fbfcfc; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e9eeee; display: flex; justify-content: space-between; gap: 12px; color: #5d706c; font-size: 10.5px; }
    thead { display: table-header-group; } tr { break-inside: avoid; }
    @media print { body { padding: 0; max-width: none; } @page { size: A4 landscape; margin: 14mm 14mm 16mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 9pt; color: #5d706c; } } }
  </style></head>
  <body>
    <header class="masthead">
      <div class="brand">
        <div class="brand-logo">${EFLOW_REPORT_LOGO_SVG}</div>
        <div class="brand-org">
          <div class="name">${escapeHtml(getExportBrandHeader())}</div>
          ${meta.subtitle ? `<div class="sub">${escapeHtml(meta.subtitle)}</div>` : '<div class="sub">eFlow e-Governance Workspace</div>'}
        </div>
      </div>
      <div class="doc-meta">
        <strong>Generated ${escapeHtml(generatedAt)}</strong>
        <span>${rows.length} ${rows.length === 1 ? 'record' : 'records'}</span>
      </div>
    </header>
    <div class="title-block">
      <h1>${escapeHtml(meta.title)}</h1>
    </div>
    ${filtersHtml}
    ${totalsHtml}
    ${chartHtml}
    <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
    <footer class="footer">
      <span>This report contains only records visible to the exporting user.</span>
      <span>Confidential — internal LGU use only</span>
    </footer>
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
