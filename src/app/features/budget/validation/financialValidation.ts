import {decimalError,integerError} from '../../../shared/numericValidation';
import {historicalDateError} from '../../../shared/calendarDates';
import {attachmentError} from '../../../shared/fileValidation';
import type {BudgetLineInput,ReceiptDraft,ReceiptItem} from '../types';
// Keep quantities within both deployed numeric(16,scale) and exact scaled JS integers.
export const MAX_RECEIPT_QUANTITY=Math.floor(Number.MAX_SAFE_INTEGER/1000);
export const MAX_BUDGET_QUANTITY=Math.floor(Number.MAX_SAFE_INTEGER/100);
export const MAX_BUDGET_LINE_AMOUNT=9_999_999_999;
export const MAX_FINANCIAL_AMOUNT=90_000_000_000;
export const receiptQuantityError=(quantity:unknown)=>decimalError(quantity,'Quantity',.001,MAX_RECEIPT_QUANTITY,3);
export const budgetQuantityError=(quantity:unknown)=>decimalError(quantity,'Quantity',.01,MAX_BUDGET_QUANTITY,2);
export const financialAmountError=(amount:unknown,label='Amount',allowZero=false,max=MAX_FINANCIAL_AMOUNT)=>decimalError(amount,label,allowZero?0:.01,max,2);
export function receiptItemError(item:ReceiptItem){return receiptQuantityError(item.quantity)||financialAmountError(item.amount,'Line amount')||(!item.unit.trim()?'Unit is required.':'')||(!item.particular.trim()?'Particulars are required.':'')||(!item.purpose.trim()?'Purpose is required.':'')||(!item.allocationLineId?'Choose an approved expense source.':'');}
export function budgetLineError(line:BudgetLineInput){
 const quantity=line.quantity,unitCost=line.unitCost;
 if(unitCost===undefined)return (quantity===undefined?'':budgetQuantityError(quantity))||financialAmountError(line.amount,'Line total',false,MAX_BUDGET_LINE_AMOUNT);
 if(quantity!==undefined||unitCost!==undefined){
  const effectiveQuantity=quantity===undefined?1:quantity;
  const issue=budgetQuantityError(effectiveQuantity)||financialAmountError(unitCost,'Unit cost',false,MAX_BUDGET_LINE_AMOUNT);if(issue)return issue;
  const total=effectiveQuantity*unitCost!;
  // Quantity × price is rounded to cents once; the computed total has its own ceiling.
  return financialAmountError(Math.round((total+Number.EPSILON)*100)/100,'Line total',false,MAX_BUDGET_LINE_AMOUNT);
 }
 return financialAmountError(line.amount,'Line total',false,MAX_BUDGET_LINE_AMOUNT);
}
export function liquidationInputError(input:{spent:number;note:string;receipts:ReceiptDraft[];refundDate?:string;refundReceiptNumber?:string}){
 const amountIssue=financialAmountError(input.spent,'Actual spending',true);if(amountIssue)return amountIssue;
 if(!input.note.trim())return 'Add a liquidation note.';
 if(!Array.isArray(input.receipts)||input.receipts.length<1||input.receipts.length>100)return 'Include between 1 and 100 receipts.';
 let sum=0;
 for(const [index,receipt] of input.receipts.entries()){
  const prefix=`Receipt ${index+1}: `;
  const issue=historicalDateError(receipt.receiptDate,'Receipt date')||financialAmountError(receipt.amount,'Receipt amount',true)||(!receipt.vendor.trim()?'Vendor is required.':'');if(issue)return prefix+issue;
  if(receipt.items!==undefined){
   if(!Array.isArray(receipt.items)||receipt.items.length>100)return prefix+'Use up to 100 purchased items.';
   for(const item of receipt.items){const problem=receiptItemError(item);if(problem)return prefix+problem;}
   if(receipt.items.reduce((total,item)=>total+Math.round(item.amount*100),0)!==Math.round(receipt.amount*100))return prefix+'Purchased items must equal the receipt amount.';
  }else if(!receipt.description.trim())return prefix+'Describe the expense.';
  if(!receipt.file)return prefix+'Attach the receipt file.';
  const fileIssue=attachmentError([receipt.file],{extensions:['jpg','jpeg','png','webp','pdf']});if(fileIssue)return prefix+fileIssue;
  sum+=Math.round(receipt.amount*100);
 }
 if(sum!==Math.round(input.spent*100))return 'Receipt totals must equal actual spending.';
 if(input.refundDate){const issue=historicalDateError(input.refundDate,'Cash return date');if(issue)return issue;}
 return '';
}
export const fiscalYearError=(year:unknown)=>integerError(year,'Fiscal year',2000,2200);
export function budgetSettingsError(settings:{dailyReleaseLimit:number;perReceiptLimit:number;liquidationDueDays:number;threshold:number}){
 return financialAmountError(settings.dailyReleaseLimit,'Daily release limit',true)||financialAmountError(settings.perReceiptLimit,'Per-receipt limit',true)||integerError(settings.liquidationDueDays,'Liquidation deadline',1,90)||decimalError(settings.threshold,'Utilization target',0,100,2);
}
