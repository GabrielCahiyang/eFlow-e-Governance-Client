import { EmptyState } from '../../../components/ui/EmptyState';
import { useState } from "react";
import type { DepartmentBudgetBundle } from "../types";
import { buildPettyCashVoucherRows,PCV_HEADINGS } from "../selectors/pettyCashVoucherReport";
import { downloadBudgetCsv,printBudgetTable } from "../services/budgetReportExport";
import { peso } from "./budgetUi";
import { Button } from '@vibe/core';
import { Download, Printer, Search } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { BudgetTableRegion } from './BudgetTableRegion';
export function PettyCashVoucherRegister({data}:{data:DepartmentBudgetBundle}) {
  const [verifiedOnly,setVerifiedOnly]=useState(true),[query,setQuery]=useState("");
  const filtered={...data,requests:data.requests.filter(r=>`${r.pcvNumber||''} ${r.requestNumber||r.id} ${!r.pcvNumber&&r.pcvLegacy!==false?'legacy unnumbered':''} ${r.purpose} ${r.requesterName||''}`.toLowerCase().includes(query.toLowerCase()))};
  const rows=buildPettyCashVoucherRows(filtered,verifiedOnly);
  const title=`${verifiedOnly?'Summary of Task-funded Cash Expenses':'Task Cash Voucher Register · includes unverified packages'} · FY ${data.summary?.fiscalYear}`;
  return (
    <section className="overflow-hidden rounded-[10px] border border-border bg-card">
      <header className="eflow-budget-section-heading">
        <div><h2>Task Cash Vouchers</h2><p>Task-funded vouchers, receipt items and correction history.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button kind="secondary" size="small" onClick={() => downloadBudgetCsv('petty-cash-vouchers.csv', PCV_HEADINGS, rows)}><Download size={14} /> CSV</Button>
          <Button kind="tertiary" size="small" onClick={() => printBudgetTable(title, PCV_HEADINGS, rows)}><Printer size={14} /> Print / PDF</Button>
        </div>
      </header>
      <div className="eflow-budget-register-filters">
        <div className="eflow-budget-register-search relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Find voucher" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find PCV, request, purpose or recipient" className="pl-9" />
        </div>
        <label className="flex min-h-10 items-center gap-2 text-xs">
          <input type="checkbox" checked={verifiedOnly} onChange={event => setVerifiedOnly(event.target.checked)} /> Verified expenses only
        </label>
      </div>
      {rows.length ? <BudgetTableRegion label="Task cash voucher records">
        <table className="eflow-budget-record-table min-w-[1050px] text-left">
          <thead><tr>{PCV_HEADINGS.map((label, index) => <th scope="col" className={index === 6 || index === 7 ? 'text-right' : undefined} key={label}>{label}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={index} className={row[0] ? 'bg-muted font-medium' : undefined}>
            {row.map((value, column) => <td key={column} className={column === 6 || column === 7 ? 'eflow-budget-number' : undefined}>{typeof value === 'number' ? peso.format(value) : value}</td>)}
          </tr>)}</tbody>
        </table>
      </BudgetTableRegion> : <EmptyState illustration={query ? 'search' : 'budget'} title={verifiedOnly ? 'No settled expenses in this selection.' : 'No authorized vouchers in this selection.'} />}
      <p className="border-t p-4 text-xs text-muted-foreground">Vouchers keep their reference through corrections. Older requests without a reference appear as “Legacy · unnumbered”. Receipts become verified when Accounting settles them.</p>
    </section>
  );
}
