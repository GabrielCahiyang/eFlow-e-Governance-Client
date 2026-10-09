import type { DepartmentBudgetBundle } from "../types";
import { sectionTotal } from "../selectors/budgetSections";
import { downloadBudgetCsv,printBudgetTable } from "../services/budgetReportExport";
import { peso } from "./budgetUi";
const headings=['Section / expense account','Appropriated','For later release','Budget released','Obligated','% of total appropriation','% of account','Balance'];
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
  return <section className="rounded-xl border border-border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-[14px] font-semibold">Budget partitions · Total Budget {peso.format(annual)}</h3><div className="flex gap-2"><button onClick={()=>downloadBudgetCsv(`budget-utilization-${data.summary!.fiscalYear}.csv`,headings,[...rows,totalRow])} className="rounded-lg border px-3 py-2 text-[12px]">Export CSV</button><button onClick={()=>printBudgetTable(report,headings,[...rows,totalRow])} className="rounded-lg border px-3 py-2 text-[12px]">Print / PDF</button></div></div>
    <p className="mt-2 text-[12px] text-muted-foreground">Budget release is spending authority, not cash handed out. Obligated money includes approved work; verified spending is shown separately.</p>
    <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[980px] text-[12px]"><thead><tr>{headings.map((h,i)=><th key={h} className={`border-b p-2 ${i?'text-right':'text-left'}`}>{h}</th>)}</tr></thead><tbody>{[...rows,totalRow].map((row,i)=><tr key={i} className={i===rows.length?'bg-muted font-semibold':''}>{row.map((c,j)=><td key={j} className={`whitespace-pre border-b p-2 ${j?'text-right tabular-nums':''} ${j===7&&Number(c)<0?'text-destructive':''}`}>{typeof c==='number'?peso.format(c):c}</td>)}</tr>)}</tbody></table></div>
  </section>;
}
