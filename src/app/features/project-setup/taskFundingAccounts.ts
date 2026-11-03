import type {ProjectFlow} from './types';

export function availableTaskAccounts(data:ProjectFlow,taskId:string){
 const allocated=(data.taskFunding||[]).filter(line=>line.taskId===taskId&&line.amount>0);
 const used=new Set(allocated.map(line=>line.sourceId).filter(Boolean));
 const year=allocated[0]?.fiscalYear||data.funds.find(fund=>used.has(fund.id))?.fiscal_year;
 return data.funds.filter(source=>source.available>0&&!used.has(source.id)&&(!year||source.fiscal_year===year));
}

export const taskFundingTotal=(lines:{amount:number}[])=>lines.reduce((sum,line)=>sum+(Number.isFinite(line.amount)?Math.round(line.amount*100):0),0)/100;
