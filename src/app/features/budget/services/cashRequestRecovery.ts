import { supabase } from '../../../../lib/supabase';
import { assertActionActor } from '../../../shared/actionActor';
import { isCommandId, pendingActionKey } from '../../../shared/pendingActionStore';
import type { CashFundingLine } from '../types';
import { createContextualCashRequest, resubmitContextualCashRequest } from './budgetService';
import { createVoucherCashRequest } from './pettyCashVoucherService';

export const cashRequestActionKey = (actor: string, office: string, task: string, node?: string) =>
  pendingActionKey(actor, 'cash-request', office, task, node ?? '');

export interface CashRequestAttempt {
  key: string;
  itemized: boolean;
  lines: CashFundingLine[];
  purpose: string;
  neededBy: string;
  existingId?: string;
  requestId?: string;
  attachment?: File;
}

export async function saveCashRequest(actor: string, taskId: string, subtaskId: string | undefined,
  attempt: CashRequestAttempt, recovering: boolean, readOnly = false) {
  if (!isCommandId(attempt.key) || !attempt.lines.length) throw new Error('The saved cash request could not be verified.');
  await assertActionActor(actor);
  const { allocationLineId, amount } = attempt.lines[0];
  if (recovering && !attempt.existingId) {
    const query = supabase.from('petty_cash_requests').select('id,requested_amount,purpose,needed_by')
      .eq('task_id', taskId).eq('requester_id', actor).eq('idempotency_key', attempt.key);
    const { data, error } = await (subtaskId ? query.eq('subtask_id', subtaskId) : query.is('subtask_id', null)).maybeSingle();
    if (error) throw new Error('The original cash request could not be verified.');
    const total = attempt.lines.reduce((sum, line) => sum + Math.round(line.amount * 100), 0);
    if (data) {
      if (Math.round(Number(data.requested_amount) * 100) !== total || data.purpose !== attempt.purpose || data.needed_by !== attempt.neededBy) {
        throw new Error('The stored cash request does not match the saved terms.');
      }
      return data.id as string;
    }
  }
  if (readOnly && (!attempt.existingId || attempt.itemized)) throw new Error('Current funding access is required to continue this saved request.');
  if (attempt.itemized) return createVoucherCashRequest({ taskId, subtaskId, ...attempt, recovering });
  if (!attempt.existingId) return createContextualCashRequest({
    taskId, subtaskId, allocationLineId, amount, purpose: attempt.purpose, neededBy: attempt.neededBy,
    idempotencyKey: attempt.key, recovering,
  });
  if (recovering) {
    const query = supabase.from('petty_cash_requests').select('id,status,allocation_line_id,requested_amount,purpose,needed_by')
      .eq('id', attempt.existingId).eq('requester_id', actor).eq('task_id', taskId);
    const { data, error } = await (subtaskId ? query.eq('subtask_id', subtaskId) : query.is('subtask_id', null)).maybeSingle();
    if (error || !data) throw new Error('The original cash request could not be verified.');
    if (!['leader_changes_requested', 'department_changes_requested'].includes(data.status)) {
      if (data.allocation_line_id === allocationLineId && Number(data.requested_amount) === amount &&
          data.purpose === attempt.purpose && data.needed_by === attempt.neededBy) return data.id as string;
      throw new Error('The original request changed. Check its current details before submitting another correction.');
    }
  }
  if (readOnly) throw new Error('Current funding access is required to send this correction.');
  await assertActionActor(actor);
  await resubmitContextualCashRequest({ requestId: attempt.existingId, allocationLineId, amount,
    purpose: attempt.purpose, neededBy: attempt.neededBy });
  return attempt.existingId;
}
