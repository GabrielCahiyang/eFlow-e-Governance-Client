import type {PettyCashLiquidation,PettyCashRequest} from '../types';

/** Receipt endorsement and financial posting are different recorded decisions. */
export function liquidationStage(request:PettyCashRequest,liquidation?:PettyCashLiquidation){
  if(request.status==='settled')return {title:'Settled',detail:'Accounting recorded the spending and cleared this cash advance.',tone:'success' as const};
  if(liquidation?.status==='approved')return {title:'Settlement status needs checking',detail:'The receipt package is approved, but the cash request is still open. Accounting must check the posting before project closeout.',tone:'error' as const};
  if(request.status==='pending_department_settlement')return {
    title:liquidation?.leaderDecidedAt?'Receipts approved · awaiting Accounting settlement':'Awaiting Accounting settlement',
    detail:`${liquidation?.leaderDecidedAt?'Receipt approval is saved.':'The receipt package was submitted.'} Accounting still needs to settle and post this cash request before project closeout.`,tone:'pending' as const,
  };
  return null;
}
