export function downloadBudgetCsv(name: string, headings: string[], rows: Array<Array<string|number>>) {
  const cell=(value:string|number)=>{let s=String(value);if(typeof value==='string'&&/^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const blob=new Blob(['\uFEFF'+[headings,...rows].map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
export function printBudgetTable(title:string,headings:string[],rows:Array<Array<string|number>>) {
  const escape=(value:string|number)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  const page=window.open('','_blank');if(!page)return;
  page.opener=null;
  page.document.write(`<!doctype html><html><head><title>${escape(title)}</title><style>@page{size:A4 landscape;margin:12mm}body{font:11px Arial;color:#111}table{border-collapse:collapse;width:100%}th,td{border:1px solid #777;padding:6px;text-align:left;white-space:pre-wrap}thead{display:table-header-group}tr{break-inside:avoid}h1{font-size:18px}.tools{margin-bottom:16px}@media print{.tools{display:none}}</style></head><body><div class="tools"><button onclick="window.print()">Print / Save as PDF</button></div><h1>${escape(title)}</h1><table><thead><tr>${headings.map(h=>`<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(c=>`<td>${escape(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`);
  page.document.close();
}
