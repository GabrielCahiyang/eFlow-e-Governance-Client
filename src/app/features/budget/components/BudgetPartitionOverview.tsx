import type { DepartmentBudgetBundle } from "../types";
import { sectionTotal } from "../selectors/budgetSections";
import { downloadBudgetCsv,printBudgetTable } from "../services/budgetReportExport";
import { peso } from "./budgetUi";
import { Button } from '@vibe/core';
import { Download, Printer } from 'lucide-react';
import { BudgetTableRegion } from './BudgetTableRegion';
const headings=['Account','Appropriated','For later release','Budget released','Obligated','% of total appropriation','% of account','Balance'];
export function BudgetPartitionOverview({data}:{data:DepartmentBudgetBundle}) {
  if(!data.sectionsAvailable||!data.summary)return null;
  const sections=data.sections||[],annual=sectionTotal(sections);
  const percentage=(numerator:number,denominator:number)=>denominator>0?`${(numerator/denominator*100).toFixed(2)}%`:'—';
  const rows:Array<Array<string|number>>=[];
  const visit=(parentId?:string,depth=0)=>{for(const s of sections.filter(x=>!x.retired&&x.parentId===parentId).sort((a,b)=>a.position-b.position)){
    const amount=sectionTotal(sections,s.id),hold=sectionTotal(sections,s.id,'heldAmount'),committed=sectionTotal(sections,s.id,'committedAmount');
    rows.push([`${'  '.repeat(depth)}${s.name}${s.accountCode?' ('+s.accountCode+')':''}`,amount,hold,amount-hold,committed,percentage(committed,annual),percentage(committed,amount),amount-hold-committed]);
    if(depth<6)visit(s.id,depth+1);
  }};visit();
  const totalHold=sectionTotal(sections,undefined,'heldAmount'),obligated=data.summary.committedAmount;
  const totalRow=['TOTAL',annual,totalHold,annual-totalHold,obligated,percentage(obligated,annual),percentage(obligated,annual),annual-totalHold-obligated];
  const report=`Office Budget Utilization · FY ${data.summary.fiscalYear}`;
  const renderCells = (row: Array<string | number>) => row.map((value, index) => (
    <td key={index} className={`${index ? 'eflow-budget-number' : 'whitespace-pre-wrap break-words'} ${index === 7 && Number(value) < 0 ? 'text-destructive' : ''}`}>
      {typeof value === 'number' ? peso.format(value) : value}
    </td>
  ));
  return <section className="overflow-hidden rounded-[10px] border border-border bg-card">
    <header className="eflow-budget-section-heading">
      <div><h2>Budget accounts</h2><p>Appropriation, releases and commitments by account.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button kind="secondary" size="small" onClick={()=>downloadBudgetCsv(`budget-utilization-${data.summary!.fiscalYear}.csv`,headings,[...rows,totalRow])}><Download size={14} /> Export CSV</Button>
        <Button kind="tertiary" size="small" onClick={()=>printBudgetTable(report,headings,[...rows,totalRow])}><Printer size={14} /> Print / PDF</Button>
      </div>
    </header>
    <BudgetTableRegion label="Budget accounts table">
      <table className="eflow-budget-record-table min-w-[850px] text-left">
        <thead><tr>{headings.map((label, index) => <th key={label} scope="col" className={index ? 'text-right' : 'min-w-36'}>{label}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>{renderCells(row)}</tr>)}</tbody>
        <tfoot><tr className="border-t bg-muted font-semibold">{renderCells(totalRow)}</tr></tfoot>
      </table>
    </BudgetTableRegion>
  </section>;
}
