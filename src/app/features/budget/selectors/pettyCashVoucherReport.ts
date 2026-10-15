import type { DepartmentBudgetBundle } from "../types";
export const PCV_HEADINGS=['PCV / version / status','Store','Receipt no.','Date','Quantity','Particulars','Amount','Total','Purpose','Expense account'];
export function buildPettyCashVoucherRows(data:DepartmentBudgetBundle,verifiedOnly=true) {
  const rows:Array<Array<string|number>>=[];
  const authorizedStates=['approved','scheduled_for_release','partially_released','released','liquidation_submitted','pending_leader_liquidation_review','pending_department_settlement','changes_requested','overdue_liquidation','settled'];
  for(const request of data.requests.filter(r=>(r.pcvNumber||r.pcvLegacy!==false&&authorizedStates.includes(r.status))&&(!verifiedOnly||r.status==='settled')).sort((a,b)=>(a.pcvNumber||Number.MAX_SAFE_INTEGER)-(b.pcvNumber||Number.MAX_SAFE_INTEGER))) {
    const versions=data.liquidations.filter(l=>l.requestId===request.id);
    const liquidation=versions.filter(l=>!verifiedOnly||l.status==='approved').sort((a,b)=>b.version-a.version)[0];
    const dates=liquidation?.receipts.map(r=>r.receiptDate).sort()||[];
    const reference=request.pcvNumber?`PCV ${String(request.pcvNumber).padStart(2,'0')}`:`Legacy · unnumbered · request ${request.requestNumber||request.id}`;
    const ref=`${reference} · ${request.pcvDate||'PCV date not recorded'} · ${request.status}${liquidation?' · version '+liquidation.version:''}${dates.length?' · '+dates[0]+' to '+dates[dates.length-1]:''}`;
    rows.push([ref,'','','','','','','',request.purpose,'']);
    for(const receipt of liquidation?.receipts||[]) {
      for(const [i,item] of (receipt.items||[]).entries()) rows.push(['',i?'':receipt.vendor,i?'':receipt.receiptNumber||'',i?'':receipt.receiptDate,`${item.quantity} ${item.unit}`,item.particular,item.amount,'',item.purpose,`${item.accountName||''}${item.accountLabel?' ('+item.accountLabel+')':''}`]);
      if(!receipt.items?.length)rows.push(['',receipt.vendor,receipt.receiptNumber||'',receipt.receiptDate,'—',receipt.description,receipt.amount,'',request.purpose,'Legacy receipt · account not itemized']);
      rows.push(['','','','','','Receipt subtotal','',receipt.amount,'','']);
    }
    rows.push([`TOTAL ${reference}`,'','','','','','',liquidation?.declaredSpent||0,`Returned cash: ${liquidation?.returnedAmount||0}`,'']);
  }
  return rows;
}
