import {expect,it} from 'vitest';
import {
  normalizeFinancialNotification,
  normalizeWorkUpdateNotification,
} from '../../src/app/shared/notificationWorkCopy';
import {rowToNotif} from '../../src/app/services/notificationService';

it('removes generated progress percentages while preserving the member update',()=>{
 const result=normalizeWorkUpdateNotification({title:'Subtask progress updated',message:'Chris updated "Book venue" to 0%. Called the venue · Next: Confirm booking',statusTo:'0%',reason:'Asked for a 50% deposit'});
 expect(result).toMatchObject({title:'Subtask work updated',message:'Chris updated "Book venue". Called the venue · Next: Confirm booking',statusTo:undefined,reason:'Asked for a 50% deposit'});
});
it('does not change unrelated financial messages or current work statuses',()=>{
 const cash={title:'Petty cash released',message:'Released 50% of the request',statusTo:'released'};
 expect(normalizeWorkUpdateNotification(cash)).toBe(cash);
 const current={title:'Subtask completed',message:'Chris completed "Book venue".',statusTo:'completed'};
 expect(normalizeWorkUpdateNotification(current)).toBe(current);
});

it('normalizes task-funded cash approval copy away from petty cash and department labels',()=>{
 const approved=normalizeFinancialNotification({
  type:'petty_cash_decision',
  financialRecordType:'petty_cash_request',
  title:'Petty cash approved and scheduled',
  message:'Your request was approved. Cash releases were scheduled under the department daily cap.',
 });
 expect(approved).toEqual({
  type:'petty_cash_decision',
  financialRecordType:'petty_cash_request',
  title:'Fund cash approved and scheduled',
  message:'Your fund cash request was approved and scheduled for Accounting release.',
 });

 const awaiting=normalizeFinancialNotification({
  type:'petty_cash_requested',
  financialRecordType:'petty_cash_request',
  title:'Petty cash awaiting department approval',
  message:'Your Team Leader endorsed the petty-cash request and sent it for department approval.',
 });
 expect(awaiting).toEqual({
  type:'petty_cash_requested',
  financialRecordType:'petty_cash_request',
  title:'Fund cash awaiting Project Lead approval',
  message:'Your Task Lead endorsed the fund cash request and sent it for Project Lead approval.',
 });
});

it('applies financial copy normalization in rowToNotif while preserving separate office petty cash notices',()=>{
 const mapped=rowToNotif({
  id:'notif-1',
  type:'petty_cash_decision',
  financial_record_type:'petty_cash_request',
  title:'Petty cash approved and scheduled',
  message:'Your request was approved. Cash releases were scheduled under the department daily cap.',
  created_at:'2026-11-19T00:00:00Z',
 });
 expect(mapped.title).toBe('Fund cash approved and scheduled');
 expect(mapped.message).toBe('Your fund cash request was approved and scheduled for Accounting release.');

 const officePettyCash={
  type:'petty_cash_staffing',
  financialRecordType:'office_petty_cash',
  title:'Office petty cash needs an Accounting Officer',
  message:'Separate office petty cash waiting for release.',
 };
 expect(normalizeFinancialNotification(officePettyCash)).toBe(officePettyCash);

 const blocked={
  type:'petty_cash_settlement_blocked',
  financialRecordType:'petty_cash_liquidation',
  title:'Office petty cash settlement waiting',
  message:'Assign an Accounting Officer before settling office petty cash.',
 };
 expect(normalizeFinancialNotification(blocked)).toBe(blocked);
});
