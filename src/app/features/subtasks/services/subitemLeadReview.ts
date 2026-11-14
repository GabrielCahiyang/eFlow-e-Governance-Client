import { supabase } from '../../../../lib/supabase';

const bucket = 'm7-work-evidence';
export type ReviewKind = 'progress' | 'completion';
type Evidence = { filePath: string; fileName: string; fileSize: number; mimeType: string };
export type LeadSubmission = {
  id: string; kind: ReviewKind; state: 'pending' | 'approved' | 'changes_requested';
  author_id: string; reviewer_id: string; canDecide: boolean; decision_note?: string;
  terms: { note: string; attachments?: Evidence[] };
};
export type LeadReview = { canProposeProgress: boolean; canProposeCompletion: boolean; items: LeadSubmission[] };
export type ReviewAttempt = { id: string; uploaded: Evidence[] };

export async function fetchSubitemLeadReview(root: string, node: string): Promise<LeadReview> {
  const { data, error } = await supabase.rpc('m7_work_proposals', { p_root: root, p_node: node });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data?.items)) throw new Error('Could not verify Lead review.');
  return data;
}

export async function proposeSubitemWork(input: {
  root: string; node: string; actor: string; kind: ReviewKind; note: string; files: File[];
  attempt: ReviewAttempt; supersedes?: string;
}) {
  const { root, node, actor, kind, note, files, attempt, supersedes } = input;
  const { data: session } = await supabase.auth.getSession();
  if (session.session?.user.id !== actor) throw new Error('Sign in again to submit this work.');
  for (let index = attempt.uploaded.length; index < files.length; index++) {
    const file = files[index];
    const filePath = [actor, root, node, attempt.id, `${index}.${file.name.split('.').pop()?.toLowerCase()}`].join('/');
    const { error } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: false });
    if (error && !/already exists|duplicate/i.test(error.message)) throw new Error(error.message);
    attempt.uploaded.push({ filePath, fileName: file.name, fileSize: file.size, mimeType: file.type });
  }
  const { data, error } = await supabase.rpc('m7_propose_work', {
    p_root: root, p_node: node, p_request: attempt.id, p_kind: kind,
    p_terms: { note, attachments: attempt.uploaded }, p_supersedes: supersedes ?? null,
  });
  if (error) throw new Error(error.message);
  if (data?.id !== attempt.id) throw new Error('Submission could not be verified. Retry the same submission.');
  return data as LeadSubmission;
}

export async function decideSubitemWork(id: string, request: string, approve: boolean, note: string) {
  const { data, error } = await supabase.rpc('m7_decide_work', {
    p_proposal: id, p_request: request, p_approve: approve, p_note: note || null,
  });
  if (error) throw new Error(error.message);
  if (data?.id !== id || data.state !== (approve ? 'approved' : 'changes_requested'))
    throw new Error('Decision could not be verified. Retry the same decision.');
  return data as LeadSubmission;
}

export async function openSubitemReviewEvidence(path: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) throw new Error('Could not open this evidence file.');
  return data.signedUrl;
}
