import { supabase } from "../../../../lib/supabase";
import {integerError} from '../../../shared/numericValidation';
import {attachmentError} from '../../../shared/fileValidation';
import { rowToSubtask, type Subtask } from "../../../services/subtaskService";
import {addSubtaskReviewDisplayContext,readSubtaskReviewRows} from './subtaskReviewContextService';
import type {
  SubtaskReviewItem,
  SubtaskProgressUpdate,
  SubtaskSubmission,
  SubtaskSubmissionAttachment,
} from "../types";

const missingUpgrade = (message: string) =>
  message.includes("save_subtask_progress") ||
  message.includes("submit_subtask_for_review") ||
  message.includes("decide_subtask_review");

/** Status updates preserve historical percentages and reuse the checked writer. */
export async function saveSubtaskWorkUpdate(input:{subtaskId:string;state:'in_progress'|'stuck';blocker?:string;note?:string;nextStep?:string;attachment?:File|null}):Promise<void>{
 const issue=attachmentError(input.attachment?[input.attachment]:[],{maxCount:1});
 if(issue)throw new Error(issue);
 if((input.note?.length||0)>3000||(input.blocker?.length||0)>3000||(input.nextStep?.length||0)>300)throw new Error('Work update exceeds its text limit.');
 if(input.state==='stuck'&&!input.blocker?.trim())throw new Error('Tell your lead what is blocking you.');
 let uploaded:SubtaskSubmissionAttachment|undefined;
 try{
  if(input.attachment)uploaded=await uploadFile(input.subtaskId,'updates',input.attachment);
  const {error}=await supabase.rpc('save_subtask_work_update',{p_subtask_id:input.subtaskId,p_state:input.state,p_blocker:input.blocker?.trim()||null,p_note:input.note?.trim()||null,p_next_step:input.nextStep?.trim()||null,p_attachment_path:uploaded?.filePath||null,p_attachment_name:uploaded?.fileName||null});
  if(error)throw new Error(error.message);
 }catch(reason){if(uploaded)await supabase.storage.from('task-attachments').remove([uploaded.filePath]);throw reason;}
}

async function uploadFile(
  subtaskId: string,
  segment: string,
  file: File,
): Promise<SubtaskSubmissionAttachment> {
  const safeName = (file.name?.trim() || "evidence").replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `subtasks/${subtaskId}/${segment}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from("task-attachments")
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  return {
    fileName: file.name || safeName,
    filePath: path,
    fileSize: file.size || 0,
    mimeType: file.type || "",
  };
}

export async function saveSubtaskProgress(input: {
  subtaskId: string;
  percentComplete: number;
  blockerCategory?: string;
  blocker?: string;
  nextStep?: string;
  note?: string;
  attachment?: File | null;
}): Promise<void> {
  const issue=integerError(input.percentComplete,'Progress',0,99);if(issue)throw new Error(issue);
  let uploaded: SubtaskSubmissionAttachment | undefined;
  try {
    if (input.attachment) {
      uploaded = await uploadFile(input.subtaskId, "progress", input.attachment);
    }
    const { error } = await supabase.rpc("save_subtask_progress", {
      p_subtask_id: input.subtaskId,
      p_percent_complete: input.percentComplete,
      p_blocker_category: input.blockerCategory || null,
      p_blocker: input.blocker?.trim() || null,
      p_next_step: input.nextStep?.trim() || null,
      p_note: input.note?.trim() || null,
      p_attachment_path: uploaded?.filePath || null,
      p_attachment_name: uploaded?.fileName || null,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    if (uploaded) await supabase.storage.from("task-attachments").remove([uploaded.filePath]);
    const message = error instanceof Error ? error.message : "Subtask progress failed.";
    if (missingUpgrade(message)) throw new Error("Apply the subtask evidence-review database migration, then try again.");
    throw error;
  }
}

export async function submitSubtaskForReview(input: {
  subtaskId: string;
  note: string;
  evidence: File[];
}): Promise<void> {
  const issue=attachmentError(input.evidence);
  if(issue)throw new Error(issue);
  if(input.note.length>5000)throw new Error('Completion note must be 5,000 characters or fewer.');
  if (!input.note.trim()) throw new Error("A completion note is required.");
  if (input.evidence.length === 0) throw new Error("Attach at least one evidence file.");

  const submissionId = crypto.randomUUID();
  const uploaded: SubtaskSubmissionAttachment[] = [];
  try {
    for (const file of input.evidence) {
      uploaded.push(await uploadFile(input.subtaskId, submissionId, file));
    }
    const { error } = await supabase.rpc("submit_subtask_for_review", {
      p_subtask_id: input.subtaskId,
      p_submission: {
        id: submissionId,
        note: input.note.trim(),
        attachments: uploaded,
      },
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    if (uploaded.length) {
      await supabase.storage.from("task-attachments").remove(uploaded.map((file) => file.filePath));
    }
    const message = error instanceof Error ? error.message : "Subtask submission failed.";
    if (missingUpgrade(message)) throw new Error("Apply the subtask evidence-review database migration, then try again.");
    throw error;
  }
}

const timestamp = (value: unknown): number =>
  typeof value === "string" && value ? new Date(value).getTime() : Date.now();

function mapSubmission(
  row: Record<string, unknown>,
  attachments: SubtaskSubmissionAttachment[],
): SubtaskSubmission {
  return {
    id: row.id as string,
    subtaskId: row.subtask_id as string,
    taskId: row.task_id as string,
    version: Number(row.version || 1),
    submitterId: row.submitter_id as string,
    submitterName: (row.submitter_name as string) || "User",
    reviewerId: row.reviewer_id as string,
    note: (row.note as string) || "",
    status: row.status as SubtaskSubmission["status"],
    decisionFeedback: (row.decision_feedback as string) || undefined,
    decidedByName: (row.decided_by_name as string) || undefined,
    decidedById: (row.decided_by as string) || undefined,
    decidedAt: row.decided_at ? timestamp(row.decided_at) : undefined,
    submittedAt: timestamp(row.submitted_at),
    attachments,
  };
}

async function readSubtaskSubmissions(subtaskId: string, rootId?: string): Promise<SubtaskSubmission[]> {
  let query = supabase
    .from("subtask_submissions")
    .select("*")
    .eq("subtask_id", subtaskId);
  if (rootId) query = query.eq("task_id", rootId);
  const { data: rows, error } = await query.order("version", { ascending: false });
  if (error && rootId) throw new Error(error.message);
  if (error) return [];
  const ids = (rows || []).map((row) => row.id as string);
  const { data: attachmentRows, error: attachmentError } = ids.length
    ? await supabase.from("subtask_submission_attachments").select("*").in("submission_id", ids)
    : { data: [] as Record<string, unknown>[], error: null };
  if (attachmentError && rootId) throw new Error(attachmentError.message);
  return (rows || []).map((row) =>
    mapSubmission(
      row,
      (attachmentRows || [])
        .filter((attachment) => attachment.submission_id === row.id)
        .map((attachment) => ({
          id: attachment.id as string,
          fileName: (attachment.file_name as string) || "Evidence",
          filePath: attachment.file_path as string,
          fileSize: Number(attachment.file_size || 0),
          mimeType: (attachment.mime_type as string) || "",
        })),
    ),
  );
}

async function readSubtaskProgressUpdates(
  subtaskId: string, rootId?: string,
): Promise<SubtaskProgressUpdate[]> {
  let query = supabase
    .from("subtask_progress_updates")
    .select("*")
    .eq("subtask_id", subtaskId);
  if (rootId) query = query.eq("task_id", rootId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error && rootId) throw new Error(error.message);
  if (error) return [];
  return (data || []).map((row) => ({
    id: row.id as string,
    subtaskId: row.subtask_id as string,
    taskId: row.task_id as string,
    authorId: row.author_id as string,
    authorName: (row.author_name as string) || "Team member",
    percentComplete: Number(row.percent_complete || 0),
    blockerCategory: (row.blocker_category as string) || undefined,
    blocker: (row.blocker as string) || undefined,
    nextStep: (row.next_step as string) || undefined,
    note: (row.note as string) || undefined,
    attachmentPath: (row.attachment_path as string) || undefined,
    attachmentName: (row.attachment_name as string) || undefined,
    createdAt: timestamp(row.created_at),
  }));
}

// Existing public reads retain their historical return values and error behavior.
export function fetchSubtaskSubmissions(subtaskId: string): Promise<SubtaskSubmission[]> {
  return readSubtaskSubmissions(subtaskId);
}
export function fetchSubtaskProgressUpdates(subtaskId: string): Promise<SubtaskProgressUpdate[]> {
  return readSubtaskProgressUpdates(subtaskId);
}

/** Strict canonical Inspector read. RLS still decides access; no parent lookup. */
export async function fetchSubitemInspectorRecord(rootId: string, itemId: string) {
  const {data, error} = await supabase.from('subtasks').select('*').eq('task_id', rootId).eq('id', itemId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.id !== itemId || data.task_id !== rootId) throw new Error('Subitem unavailable. It was removed or is no longer accessible.');
  const [submissions, progressUpdates] = await Promise.all([
    readSubtaskSubmissions(itemId, rootId), readSubtaskProgressUpdates(itemId, rootId),
  ]);
  if (submissions.some(row => row.taskId !== rootId || row.subtaskId !== itemId)
    || progressUpdates.some(row => row.taskId !== rootId || row.subtaskId !== itemId)) throw new Error('Could not verify subitem history.');
  return {subtask: rowToSubtask(data), submissions, progressUpdates};
}

async function readPendingSubtaskReviews(
  reviewerId: string,
  includeAll = false,
  strict = false,
): Promise<SubtaskReviewItem[]> {
  let request = supabase
    .from("subtask_submissions")
    .select("*")
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });
  if (!includeAll) request = request.eq("reviewer_id", reviewerId);
  let response;
  if(!includeAll){
    response=await supabase.rpc('r7_pending_subtask_reviews');
    if(response.error?.code==='PGRST202')response=await request;
  }else response=await request;
  const error=response.error;
  const submissionRows=response.data as Record<string,unknown>[] | null;
  if(submissionRows&&!Array.isArray(submissionRows))throw new Error('Invalid current-reviewer response.');
  if (error && strict) throw new Error(error.message);
  if (error || !submissionRows?.length) return [];

  const subtaskIds = submissionRows.map((row) => row.subtask_id as string);
  const submissionIds = submissionRows.map((row) => row.id as string);
  const [{ data: subtaskRows, error: subtaskError }, { data: attachmentRows, error: attachmentError }] = await Promise.all([
    readSubtaskReviewRows('subtasks','*','id',subtaskIds),
    readSubtaskReviewRows('subtask_submission_attachments','*','submission_id',submissionIds),
  ]);
  if (strict && (subtaskError || attachmentError)) throw new Error((subtaskError || attachmentError)!.message);
  const taskIds = Array.from(new Set((subtaskRows || []).map((row) => row.task_id as string)));
  const { data: taskRows, error: taskError } = taskIds.length
    ? await readSubtaskReviewRows('tasks','id,title,project_title,linked_project_id','id',taskIds)
    : { data: [] as Record<string, unknown>[] };
  const projectIds = Array.from(new Set(
    (taskRows || []).map((row) => row.linked_project_id as string).filter(Boolean),
  ));
  const { data: projectRows, error: projectError } = projectIds.length
    ? await readSubtaskReviewRows('projects','id,title','id',projectIds)
    : { data: [] as Record<string, unknown>[] };

  if (strict && (taskError || projectError)) throw new Error((taskError || projectError)!.message);
  const items=submissionRows.flatMap((submissionRow) => {
    const rawSubtask = (subtaskRows || []).find((row) => row.id === submissionRow.subtask_id && row.task_id === submissionRow.task_id);
    if (!rawSubtask) return [];
    const task = (taskRows || []).find((row) => row.id === rawSubtask.task_id);
    const attachments = (attachmentRows || [])
      .filter((row) => row.submission_id === submissionRow.id)
      .map((row) => ({
        id: row.id as string,
        fileName: (row.file_name as string) || "Evidence",
        filePath: row.file_path as string,
        fileSize: Number(row.file_size || 0),
        mimeType: (row.mime_type as string) || "",
      }));
    return [{
      subtask: rowToSubtask(rawSubtask),
      submission: mapSubmission(submissionRow, attachments),
      taskTitle: (task?.title as string) || "Parent task",
      projectTitle:
        ((projectRows || []).find((project) => project.id === task?.linked_project_id)?.title as string) ||
        (task?.project_title as string) ||
        undefined,
    }];
  });
  try {return await addSubtaskReviewDisplayContext(items,taskRows||[]);}
  catch(caught){if(strict)throw caught;return [];}
}

export function fetchPendingSubtaskReviews(reviewerId: string, includeAll = false): Promise<SubtaskReviewItem[]> {
  return readPendingSubtaskReviews(reviewerId, includeAll);
}
/** Personal discovery never opts into an all-reviewers query. */
export function fetchPersonalSubtaskReviews(reviewerId: string): Promise<SubtaskReviewItem[]> {
  return readPendingSubtaskReviews(reviewerId, false, true);
}

export function subscribeToPendingSubtaskReviews(
  reviewerId: string,
  includeAll: boolean,
  callback: (items: SubtaskReviewItem[]) => void,
  onError?: (error: Error) => void,
): () => void {
  let active = true, sequence = 0;
  const load = async () => {
    const current = ++sequence;
    try {const rows = await readPendingSubtaskReviews(reviewerId,includeAll,!!onError); if(active && sequence === current) callback(rows);}
    catch(caught) {if(active && sequence === current) onError?.(caught instanceof Error ? caught : new Error('Subtask reviews could not be loaded.'));}
  };
  load();
  const channel = supabase
    .channel(`subtask-reviews-${reviewerId}-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "subtask_submissions" }, load)
    .on("postgres_changes", { event: "*", schema: "public", table: "subtasks" }, load)
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, load)
    .subscribe();
  const poll=window.setInterval(load,15_000);
  window.addEventListener('focus',load);
  window.addEventListener('eflow-project-access-changed',load);
  const auth=supabase.auth?.onAuthStateChange?.(()=>{void load();});
  return () => { active = false; ++sequence;window.clearInterval(poll);window.removeEventListener('focus',load);window.removeEventListener('eflow-project-access-changed',load);auth?.data.subscription.unsubscribe();supabase.removeChannel(channel); };
}

export async function decideSubtaskReview(
  subtaskId: string,
  approve: boolean,
  feedback?: string,
  expectedActorId?: string,
): Promise<void> {
  if (!approve && !feedback?.trim()) throw new Error("Feedback is required when requesting changes.");
  // Bind this explicit draft decision to its originating account. Session data
  // rejects client identity changes; the server still validates JWT/authority.
  let token:string|undefined;
  if(expectedActorId){
    const {data,error}=await supabase.auth.getSession();
    if(error||data.session?.user.id!==expectedActorId||!data.session.access_token)throw new Error('Your account changed. Revalidate this review before deciding.');
    token=data.session.access_token;
  }
  const request = supabase.rpc("decide_subtask_review", {
    p_subtask_id: subtaskId,
    p_approve: approve,
    p_feedback: feedback?.trim() || null,
  });
  const {error}=await (token?request.setHeader('Authorization',`Bearer ${token}`):request);
  if (error) {
    if (error.code === "PGRST202" || missingUpgrade(error.message)) {
      throw new Error("Apply the subtask evidence-review database migration, then try again.");
    }
    throw new Error(error.message);
  }
}

export async function getSubtaskEvidenceUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("task-attachments").createSignedUrl(path, 600);
  return error ? null : data.signedUrl;
}

export async function fetchSubtask(subtaskId: string): Promise<Subtask | null> {
  const { data } = await supabase.from("subtasks").select("*").eq("id", subtaskId).maybeSingle();
  return data ? rowToSubtask(data) : null;
}
