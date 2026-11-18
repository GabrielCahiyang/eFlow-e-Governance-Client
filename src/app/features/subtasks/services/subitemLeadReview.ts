import { supabase } from '../../../../lib/supabase';
import { assertActionActor } from '../../../shared/actionActor';
import { isCommandId, pendingActionKey, readPendingAction, removePendingAction, withPendingActionLock, writePendingAction } from '../../../shared/pendingActionStore';
import { MutationRejectedError } from '../../../shared/MutationRejectedError';
import { attachmentError } from '../../../shared/fileValidation';

const bucket = 'm7-work-evidence';
export type ReviewKind = 'progress' | 'completion';
type Evidence = { filePath: string; fileName: string; fileSize: number; mimeType: string };
export type LeadSubmission = {
  id: string; kind: ReviewKind; state: 'pending' | 'approved' | 'changes_requested';
  author_id: string; reviewer_id: string; canDecide: boolean; decision_note?: string;
  submitted_as_lead?: boolean;
  supersedes?: string | null;
  terms: { note: string; blocker?: string; next_step?: string; progress?: number; attachments?: Evidence[] };
};
export type LeadReview = { canProposeProgress: boolean; canProposeCompletion: boolean; items: LeadSubmission[] };
export type ReviewAttempt = { id: string; uploaded: Evidence[]; sent?: boolean };
export type SavedProposal = {
  id: string; kind: ReviewKind; note: string; files: File[]; uploaded: Evidence[];
  supersedes?: string; blocker?: string; nextStep?: string; progress?: number;
};
export type SavedProposalDecision = { id: string; approve: boolean; note: string };
export const proposalActionKey = (actor: string, root: string, node?: string | null) =>
  pendingActionKey(actor, 'work-proposal', root, node ?? '');
export const proposalDecisionKey = (actor: string, root: string, node: string | null, proposal: string) =>
  pendingActionKey(actor, 'work-proposal-decision', root, node ?? '', proposal);

function pendingChanged(key: string) {
  window.dispatchEvent(new CustomEvent('eflow:pending-action', { detail: key }));
}

function rejected(error: { code?: string; message: string }) {
  return /^(22|23|28|42|P0)/.test(error.code || '')
    ? new MutationRejectedError(error.message, error.code ?? 'P0001')
    : new Error('The review outcome could not be confirmed. Check the saved action.');
}

export async function fetchSubitemLeadReview(root: string, node?: string | null): Promise<LeadReview> {
  const { data, error } = await supabase.rpc('m7_work_proposals', { p_root: root, p_node: node ?? null });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data?.items)) throw new Error('Could not verify Lead review.');
  return data;
}

async function sendProposal(root: string, node: string | null, actor: string, key: string, saved: SavedProposal) {
  if (!isCommandId(saved.id) || !['progress', 'completion'].includes(saved.kind) || !Array.isArray(saved.files) || !Array.isArray(saved.uploaded)) {
    throw new Error('The saved proposal could not be verified.');
  }
  await assertActionActor(actor);
  const current = await fetchSubitemLeadReview(root, node);
  const receipt = current.items.find(item => item.id === saved.id && item.author_id === actor && item.kind === saved.kind);
  if (receipt) return receipt;
  if (!(saved.kind === 'completion' ? current.canProposeCompletion === true : current.canProposeProgress === true)) {
    throw new MutationRejectedError('Submission access changed. Reload the Lead review before submitting.', '42501');
  }
  if (saved.supersedes && !current.items.some(item => item.id === saved.supersedes && item.author_id === actor &&
      item.kind === saved.kind && item.state === 'changes_requested' && !current.items.some(row => row.supersedes === item.id))) {
    throw new MutationRejectedError('This returned proposal already has a replacement or is no longer available.', '22023');
  }
  const uploaded = [...saved.uploaded];
  for (let index = uploaded.length; index < saved.files.length; index++) {
    const file = saved.files[index];
    const filePath = [actor, root, node ?? 'root', saved.id, `${index}.${file.name.split('.').pop()?.toLowerCase()}`].join('/');
    await assertActionActor(actor);
    const storage = supabase.storage.from(bucket);
    const { error } = await storage.upload(filePath, file, { upsert: false });
    if (error) {
      const existing = await storage.info(filePath);
      if (existing.error || existing.data?.size !== file.size) throw new Error('Could not verify the proposal attachment. Check the saved action.');
    }
    uploaded.push({ filePath, fileName: file.name, fileSize: file.size, mimeType: file.type });
    await writePendingAction(key, { ...saved, uploaded });
  }
  await assertActionActor(actor);
  const { data, error } = await supabase.rpc('m7_propose_work', {
    p_root: root, p_node: node, p_request: saved.id, p_kind: saved.kind,
    p_terms: { note: saved.note, attachments: uploaded,
      ...(saved.blocker !== undefined ? { blocker: saved.blocker } : {}),
      ...(saved.nextStep !== undefined ? { next_step: saved.nextStep } : {}),
      ...(saved.progress !== undefined ? { progress: saved.progress } : {}) },
    p_supersedes: saved.supersedes ?? null,
  });
  if (error) throw rejected(error);
  if (data?.id !== saved.id || data.author_id !== actor || data.kind !== saved.kind) {
    throw new Error('Submission could not be verified. Check the saved proposal.');
  }
  return data as LeadSubmission;
}

async function runProposal(root: string, node: string | null, actor: string, initial?: SavedProposal) {
  const key = proposalActionKey(actor, root, node);
  return withPendingActionLock(key, async () => {
    await assertActionActor(actor);
    const original = await readPendingAction<SavedProposal>(key);
    const saved = original ?? initial;
    if (!saved) throw new Error('There is no saved proposal to check.');
    if (!original) {
      await writePendingAction(key, saved, true);
      pendingChanged(key);
    }
    try {
      const item = await sendProposal(root, node, actor, key, saved);
      await removePendingAction(key);
      pendingChanged(key);
      return item;
    } catch (error) {
      if (!original && error instanceof MutationRejectedError) {
        await removePendingAction(key);
        pendingChanged(key);
      }
      throw error;
    }
  });
}

export async function proposeSubitemWork(input: {
  root: string; node?: string | null; actor: string; kind: ReviewKind; note: string; files: File[];
  attempt: ReviewAttempt; supersedes?: string; blocker?: string; nextStep?: string; currentProgress?: number | null;
}) {
  const { root, node, actor, kind, note, files, attempt, supersedes, blocker, nextStep } = input;
  const issue = attachmentError(files);
  if (issue) throw new Error(issue);
  if (!note.trim() || note.trim().length > 3000 || (nextStep?.trim().length ?? 0) > 300) throw new Error('Check the proposal note and next step.');
  const progress = kind === 'progress' && !node ? Math.min(99, Math.max(0, Math.round(input.currentProgress ?? 0))) : undefined;
  attempt.sent = true;
  try {
    return await runProposal(root, node ?? null, actor, { id: attempt.id, kind, note: note.trim(), files, uploaded: [], supersedes, blocker, nextStep, progress });
  } catch (error) {
    if (error instanceof MutationRejectedError) attempt.sent = false;
    throw error;
  }
}

export const recoverSubitemProposal = (root: string, node: string | null, actor: string) => runProposal(root, node, actor);

export async function decideSubitemWork(id: string, request: string, approve: boolean, note: string) {
  const { data, error } = await supabase.rpc('m7_decide_work', {
    p_proposal: id, p_request: request, p_approve: approve, p_note: note || null,
  });
  if (error) throw rejected(error);
  if (data?.id !== id || data.state !== (approve ? 'approved' : 'changes_requested'))
    throw new Error('Decision could not be verified. Check the saved decision.');
  return data as LeadSubmission;
}

export async function saveSubitemDecision(root: string, node: string | null, actor: string, item: LeadSubmission, initial?: SavedProposalDecision) {
  const key = proposalDecisionKey(actor, root, node, item.id);
  return withPendingActionLock(key, async () => {
    await assertActionActor(actor);
    const original = await readPendingAction<SavedProposalDecision>(key);
    const attempt = original ?? initial;
    if (!attempt || !isCommandId(attempt.id) || typeof attempt.approve !== 'boolean' ||
        typeof attempt.note !== 'string' || (!attempt.approve && !attempt.note.trim())) {
      throw new Error('The saved review decision could not be verified.');
    }
    const latest = (await fetchSubitemLeadReview(root, node)).items.find(row => row.id === item.id);
    if (!latest || latest.author_id === actor || latest.author_id !== item.author_id ||
        (latest.state === 'pending' && latest.canDecide !== true) ||
        (latest.state !== 'pending' && (!original || latest.reviewer_id !== actor ||
          latest.state !== (attempt.approve ? 'approved' : 'changes_requested')))) {
      throw new Error('This proposal or your review access changed. Refresh before continuing.');
    }
    if (!original) {
      await writePendingAction(key, attempt, true);
      pendingChanged(key);
    }
    try {
      await assertActionActor(actor);
      const result = await decideSubitemWork(item.id, attempt.id, attempt.approve, attempt.note);
      await removePendingAction(key);
      pendingChanged(key);
      return result;
    } catch (error) {
      if (!original && error instanceof MutationRejectedError) {
        await removePendingAction(key);
        pendingChanged(key);
      }
      throw error;
    }
  });
}

export async function openSubitemReviewEvidence(path: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) throw new Error('Could not open this evidence file.');
  return data.signedUrl;
}
