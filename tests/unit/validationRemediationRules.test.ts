import {describe,expect,it,vi} from 'vitest';
import {announcementExpiryError,announcementExpiryTimestamp} from '../../src/app/shared/expiryDates';
import {decimalError,integerError} from '../../src/app/shared/numericValidation';
import {duplicateWorkNameError} from '../../src/app/shared/workNames';
import {budgetLineError,receiptQuantityError,budgetSettingsError} from '../../src/app/features/budget/validation/financialValidation';
import {getBudgetLineAmount,getProposalBudgetReadiness} from '../../src/app/features/budget/selectors/budgetSelectors';
import {accountSkillsError} from '../../src/app/features/account-activation/validation';
import {recurringTemplateError} from '../../src/app/features/tasks/validation/recurringValidation';
import {parsePdsFile} from '../../src/app/features/members/services/pds-parser/pdsParser';
import {assertWorkbookBytes,MAX_PDS_BYTES} from '../../src/app/features/members/services/pds-parser/workbookLimits';
const line={id:'line',expenseClass:'MOOE',category:'Supplies',particular:'Rice',quantity:1.25,unitCost:10,amount:12.5,fundSource:'Office',position:0};
describe('remaining validation contracts',()=>{
 it('allows optional expiry and today until the end of the Philippine day',()=>{
  const midnight=new Date('2026-10-17T16:00:00Z');
  expect(announcementExpiryError('',midnight)).toBe('');expect(announcementExpiryError('2026-10-17',midnight)).toMatch(/past/);
  expect(announcementExpiryError('2026-10-18',midnight)).toBe('');expect(announcementExpiryError('2026-02-30',midnight)).toMatch(/valid/);
  vi.useFakeTimers();vi.setSystemTime(midnight);try{expect(announcementExpiryTimestamp('2026-10-18')).toBe('2026-10-18T15:59:59.999Z');}finally{vi.useRealTimers();}
 });
 it.each([NaN,Infinity,-Infinity,-1,0,.0001,1e30])('rejects receipt quantity %s',quantity=>expect(receiptQuantityError(quantity)).not.toBe(''));
 it('preserves fractional quantity and cent arithmetic',()=>{
  expect(receiptQuantityError(1.125)).toBe('');expect(budgetLineError(line)).toBe('');expect(getBudgetLineAmount(line)).toBe(12.5);
  expect(decimalError(.29,'Amount',.01,100,2)).toBe('');
  expect(receiptQuantityError(1_000_000_000_000.0001)).not.toBe('');
  expect(receiptQuantityError(1.0000000000000002)).not.toBe('');
 });
 it.each([NaN,Infinity,0,-1,.001,1e30])('blocks invalid budget quantities in readiness %s',quantity=>{
  const bad={...line,quantity};expect(budgetLineError(bad)).not.toBe('');expect(getBudgetLineAmount(bad)).toBe(0);
  expect(getProposalBudgetReadiness([{key:'task',title:'Task',budgetDecision:'funded',budgetLines:[bad]}]).ready).toBe(false);
 });
 it('checks computed totals independently of quantity and price',()=>expect(budgetLineError({...line,quantity:999999999,unitCost:9999999999})).toMatch(/total/i));
 it('checks numeric domains without silently clamping them',()=>{
  expect(integerError(365,'Interval',1,365)).toBe('');expect(integerError(366,'Interval',1,365)).not.toBe('');expect(integerError(50.5,'Progress',0,99)).not.toBe('');
  const settings={dailyReleaseLimit:100,perReceiptLimit:100,liquidationDueDays:90,threshold:75};expect(budgetSettingsError(settings)).toBe('');expect(budgetSettingsError({...settings,liquidationDueDays:91})).toMatch(/deadline/i);
 });
 it('mirrors account skill count, length and invisible-character rules',()=>{
  const hundred=Object.fromEntries(Array.from({length:100},(_,i)=>['Skill '+i,true]));expect(accountSkillsError(hundred)).toBe('');expect(accountSkillsError({...hundred,Extra:true})).toMatch(/100/);
  expect(accountSkillsError({['x'.repeat(100)]:true})).toBe('');expect(accountSkillsError({['x'.repeat(101)]:true})).not.toBe('');expect(accountSkillsError({'Excel\u200b':true})).not.toBe('');
 });
 it('enforces approved recurring text limits',()=>{
  const input={title:'Work',description:'',priority:'medium' as const,tags:[],acceptanceCriteria:[],recurrenceRule:{frequency:'daily' as const,interval:365},nextRunAt:Date.now()+86400000,isActive:true};
  expect(recurringTemplateError(input)).toBe('');expect(recurringTemplateError({...input,title:'x'.repeat(201)})).toMatch(/200/);expect(recurringTemplateError({...input,description:'x'.repeat(20001)})).toMatch(/20,000/);expect(recurringTemplateError({...input,acceptanceCriteria:['x'.repeat(1001)]})).toMatch(/1,000/);
 });
 it('rejects oversized and empty PDS files without reading them',async()=>{
  for(const size of [0,MAX_PDS_BYTES+1]){const arrayBuffer=vi.fn();await expect(parsePdsFile({name:'PDS.xlsx',type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',size,arrayBuffer} as unknown as File)).rejects.toThrow(/workbook/i);expect(arrayBuffer).not.toHaveBeenCalled();}
 });
 it('rejects a ZIP with excessive expanded content before workbook parsing',()=>{
  const bytes=new ArrayBuffer(68),view=new DataView(bytes);view.setUint16(0,0x4b50,true);view.setUint32(0,0x02014b50,true);view.setUint32(24,MAX_PDS_BYTES*5,true);view.setUint32(46,0x06054b50,true);view.setUint16(56,1,true);view.setUint32(62,0,true);
  expect(()=>assertWorkbookBytes(bytes)).toThrow(/large/);
 });
 it('blocks duplicate names after trimming, capitalization and spacing changes',()=>{
  const siblings=[{id:'a',title:'Set up meeting'}];expect(duplicateWorkNameError(' SET  UP MEETING ',siblings,'Task')).toMatch(/already exists/);expect(duplicateWorkNameError('Set up meeting',siblings,'Task','a')).toBe('');expect(duplicateWorkNameError('Set up venue',siblings)).toBe('');
 });
});
