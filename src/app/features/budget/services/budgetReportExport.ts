import { buildReportHtml, type ReportColumn } from "../../../services/reportService";

export function downloadBudgetCsv(name: string, headings: string[], rows: Array<Array<string|number>>) {
  const cell=(value:string|number)=>{let s=String(value);if(typeof value==='string'&&/^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const blob=new Blob(['\uFEFF'+[headings,...rows].map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
export function printBudgetTable(title:string,headings:string[],rows:Array<Array<string|number>>) {
  const page=window.open('','_blank');if(!page)return;
  page.opener=null;
  const columns: ReportColumn<Array<string|number>>[] = headings.map((header, index) => ({
    key: `col_${index}`,
    header,
    value: (row) => row[index] ?? '',
  }));
  const html = buildReportHtml(rows, columns, {
    title,
    subtitle: 'Office Budget · Financial statement',
  }).replace(
    '</head>',
    `<style>.print-toolbar{display:flex;justify-content:flex-end;margin-bottom:18px}.print-toolbar button{border:1px solid #0c6f6b;background:#0c6f6b;color:#fff;border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer}@media print{.print-toolbar{display:none}}</style></head>`,
  ).replace(
    '<body>',
    `<body><div class="print-toolbar"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>`,
  );
  page.document.write(html);
  page.document.close();
}
