import type { DepartmentBudgetBundle } from "../types";
export const PCV_HEADINGS=['PCV / version / status','Store','Receipt no.','Date','Quantity','Particulars','Amount','Total','Purpose','Expense account'];
export function buildPettyCashVoucherRows(data:DepartmentBudgetBundle,verifiedOnly=true) {
  const rows:Array<Array<string|number>>=[];
  for(const request of data.requests.filter(r=>r.pcvNumber&&(!verifiedOnly||r.status==='settled')).sort((a,b)=>(a.pcvNumber||0)-(b.pcvNumber||0))) {
    const versions=data.liquidations.filter(l=>l.requestId===request.id);
    const liquidation=versions.filter(l=>!verifiedOnly||l.status==='approved').sort((a,b)=>b.version-a.version)[0];
    const dates=liquidation?.receipts.map(r=>r.receiptDate).sort()||[];
    const ref=`PCV ${String(request.pcvNumber).padStart(2,'0')} · ${request.pcvDate||''} · ${request.status}${liquidation?' · version '+liquidation.version:''}${dates.length?' · '+dates[0]+' to '+dates[dates.length-1]:''}`;
    rows.push([ref,'','','','','','','',request.purpose,'']);
    for(const receipt of liquidation?.receipts||[]) {
      for(const [i,item] of (receipt.items||[]).entries()) rows.push(['',i?'':receipt.vendor,i?'':receipt.receiptNumber||'',i?'':receipt.receiptDate,`${item.quantity} ${item.unit}`,item.particular,item.amount,'',item.purpose,`${item.accountName||''}${item.accountLabel?' ('+item.accountLabel+')':''}`]);
      if(!receipt.items?.length)rows.push(['',receipt.vendor,receipt.receiptNumber||'',receipt.receiptDate,'—',receipt.description,receipt.amount,'',request.purpose,'Legacy receipt · account not itemized']);
      rows.push(['','','','','','Receipt subtotal','',receipt.amount,'','']);
    }
    rows.push([`TOTAL PCV ${String(request.pcvNumber).padStart(2,'0')}`,'','','','','','',liquidation?.declaredSpent||0,`Returned cash: ${liquidation?.returnedAmount||0}`,'']);
  }
  return rows;
}
