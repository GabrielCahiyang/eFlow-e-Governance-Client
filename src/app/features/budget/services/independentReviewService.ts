import { supabase } from '../../../../lib/supabase';
import { mapLiquidation, mapReceipt, mapRequest } from './budgetMappers';
import type { PettyCashLiquidation, PettyCashRequest } from '../types';

export interface IndependentReview {
  id: string; reviewer_id: string; status: 'pending' | 'approved' | 'changes_requested' | 'rejected';
  route_reason: string; decision_reason: string | null; decided_at: string | null;
}
export interface IndependentReviewContext {
  liquidationId: string; version: number; required: boolean; current: boolean; canReview: boolean; canSettle: boolean;
  review: IndependentReview | null; candidates: Array<{ id: string; name: string; appointment: string }>;
  eligibleSettlers: number; escalationRequired: boolean;
}
export async function getIndependentReview(liquidationId: string): Promise<IndependentReviewContext> {
  const { data, error } = await supabase.rpc('get_liquidation_independent_review', { p_liquidation_id: liquidationId });
  if (error) throw new Error(error.message);
  if (!data || data.liquidationId !== liquidationId || !Number.isInteger(data.version) || typeof data.required !== 'boolean' || typeof data.canSettle !== 'boolean' || !Array.isArray(data.candidates)) throw new Error('Independent review could not be verified. Refresh before deciding.');
  return data as IndependentReviewContext;
}
export async function routeIndependentReview(id: string, version: number, reviewerId: string, reason: string, commandId: string) {
  const { error } = await supabase.rpc('route_liquidation_independent_review', {
    p_liquidation_id: id, p_version: version, p_reviewer_id: reviewerId, p_reason: reason, p_idempotency_key: commandId,
  });
  if (error) throw new Error(error.message);
}
export async function decideIndependentReview(id: string, version: number, decision: 'approved' | 'changes_requested' | 'rejected', reason: string, commandId: string) {
  const { error } = await supabase.rpc('decide_liquidation_independent_review', {
    p_liquidation_id: id, p_version: version, p_decision: decision, p_reason: reason, p_idempotency_key: commandId,
  });
  if (error) throw new Error(error.message);
}
export function independentReviewAllowsPosting(context: IndependentReviewContext, actorId: string) {
  return context.canSettle && (!context.required || (context.current && context.review?.status === 'approved' && context.review.reviewer_id !== actorId));
}
export interface IndependentReviewPackage { context: IndependentReviewContext; liquidation: PettyCashLiquidation; request: PettyCashRequest }
export async function getAssignedIndependentReviews(actorId: string): Promise<IndependentReviewPackage[]> {
  const { data, error } = await supabase.rpc('list_my_independent_liquidation_reviews');
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) throw new Error('Assigned independent reviews could not be verified.');
  return data.map(row => {
    if (!row?.context?.review || row.context.review.reviewer_id !== actorId || !row.liquidation?.id || !row.request?.id || !Array.isArray(row.receipts)) throw new Error('Invalid assigned review scope. Refresh your Inbox.');
    return { context: row.context, request: mapRequest(row.request), liquidation: mapLiquidation(row.liquidation, row.receipts.map(mapReceipt)) };
  });
}
