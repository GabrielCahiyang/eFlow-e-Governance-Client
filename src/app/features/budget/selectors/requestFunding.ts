import type {CashFundingLine,TaskFundingContext} from '../types';
const cents=(value:number)=>Math.max(0,Math.round(value*100));
/** Divide a request only across funding already allocated to this work. */
export function requestFunding(context:TaskFundingContext,amount:number,preferred:string[]=[]){
 const sources=context.lines.filter(line=>line.available>0&&(!context.cap||line.id===context.cap.allocationLineId));
 const ordered=[...sources].sort((a,b)=>{
  const rank=(id:string)=>preferred.includes(id)?preferred.indexOf(id):preferred.length;
  return rank(a.id)-rank(b.id);
 });
 const available=Math.min(cents(context.available),context.cap?cents(context.cap.available):Infinity,ordered.reduce((sum,line)=>sum+cents(line.available),0))/100;
 let remaining=cents(amount);const lines:CashFundingLine[]=[];
 for(const source of ordered){const portion=Math.min(remaining,cents(source.available));if(portion>0)lines.push({allocationLineId:source.id,amount:portion/100});remaining-=portion;}
 return {available,lines,covered:Number.isFinite(amount)&&amount>0&&amount<=available&&remaining===0};
}
