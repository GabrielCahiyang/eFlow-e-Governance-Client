import type {FundingDraft,ProjectFundingSource} from './types';
const pesos=new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'});
const overBudgetMessage=(source:string,amount:number,available:number)=>`${source}: You entered ${pesos.format(amount)}, but only ${pesos.format(available)} is available. Reduce it by ${pesos.format(amount-available)}.`;
export function fundingEntryError(lines:FundingDraft[],sources:ProjectFundingSource[],reason:string):string{
 const totals=new Map<string,number>();
 for(const line of lines){
  if(!sources.some(source=>source.id===line.partitionId))return 'Choose a budget source.';
  if(totals.has(line.partitionId))return 'Use each budget source only once.';
  if(!Number.isFinite(line.amount)||line.amount<=0)return 'Enter an amount greater than zero.';
  totals.set(line.partitionId,(totals.get(line.partitionId)||0)+line.amount);
 }
 for(const source of sources){
  const amount=totals.get(source.id)||0;
  if(amount>source.available)return overBudgetMessage(`${source.name} (FY ${source.year})`,amount,source.available);
 }
 if(!reason.trim())return 'Add a reason for this funding.';
 return '';
}
export function fundingErrorMessage(error:unknown):string{
 const message=error instanceof Error?error.message:'Could not update the budget. Try again.';
 const balance=message.match(/^Funding source (.+): requested (\d+(?:\.\d+)?), available (-?\d+(?:\.\d+)?)$/);
 if(balance)return overBudgetMessage(balance[1],Number(balance[2]),Number(balance[3]));
 if(message.startsWith('Funding source ')&&message.includes('requested')&&message.includes('available'))return 'Not enough money in this budget source. Check the available amount.';
 if(message==='Office Budget has insufficient available funding')return 'Not enough money left in the Office Budget.';
 return message;
}
