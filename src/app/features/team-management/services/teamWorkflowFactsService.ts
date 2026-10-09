import { supabase } from "../../../../lib/supabase";
import {readAllRows} from '../../../shared/readAllRows';
import { rowToSubtask } from "../../subtasks";
import type {
  TaskStatusFact,
  TeamWorkflowFacts,
  WorkflowEvidenceFact,
  WorkflowProgressFact,
  WorkflowSubmissionFact,
  WorkflowSubmissionStatus,
} from "../types";

const emptyFacts = (): TeamWorkflowFacts => ({
  subtasks: [],
  progress: [],
  submissions: [],
  statusHistory: [],
  evidence: [],
});

const toTime = (value: unknown): number | undefined => {
  if (!value) return undefined;
  const time = new Date(value as string).getTime();
  return Number.isFinite(time) ? time : undefined;
};

function toProgress(row: Record<string, unknown>, kind: "task" | "subtask"): WorkflowProgressFact {
  return {
    id: row.id as string,
    kind,
    taskId: row.task_id as string,
    subtaskId: kind === "subtask" ? row.subtask_id as string : undefined,
    authorId: row.author_id as string || undefined,
    authorName: row.author_name as string || "User",
    percentComplete: row.percent_complete == null ? undefined : Number(row.percent_complete),
    blockerCategory: row.blocker_category as string || undefined,
    blocker: row.blocker as string || undefined,
    nextStep: row.next_step as string || undefined,
    note: row.note as string || undefined,
    createdAt: toTime(row.created_at) || Date.now(),
  };
}

function toSubmission(row: Record<string, unknown>, kind: "task" | "subtask"): WorkflowSubmissionFact {
  return {
    id: row.id as string,
    kind,
    taskId: row.task_id as string,
    subtaskId: kind === "subtask" ? row.subtask_id as string : undefined,
    version: Number(row.version || 1),
    submitterId: row.submitter_id as string,
    submitterName: row.submitter_name as string || "User",
    reviewerId: row.reviewer_id as string || row.decided_by as string || undefined,
    status: row.status as WorkflowSubmissionStatus,
    feedback: row.decision_feedback as string || undefined,
    submittedAt: toTime(row.submitted_at) || Date.now(),
    decidedAt: toTime(row.decided_at),
  };
}

function toStatusFact(row: Record<string, unknown>): TaskStatusFact {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    fromStatus: row.from_status as string || undefined,
    toStatus: row.to_status as string,
    actorId: row.actor_id as string || undefined,
    actorName: row.actor_name as string || undefined,
    note: row.note as string || undefined,
    createdAt: toTime(row.created_at) || Date.now(),
  };
}

function toEvidence(row: Record<string, unknown>, kind: "task" | "subtask"): WorkflowEvidenceFact {
  return {
    id: row.id as string,
    kind,
    taskId: row.task_id as string,
    submissionId: row.submission_id as string || undefined,
    fileName: row.file_name as string || "Attachment",
    filePath: row.file_path as string || "",
    fileSize: Number(row.file_size || 0),
    mimeType: row.mime_type as string || "",
    createdAt: toTime(row.created_at) || Date.now(),
  };
}

export async function fetchTeamWorkflowFacts(taskIds: string[]): Promise<TeamWorkflowFacts> {
  const uniqueTaskIds = Array.from(new Set(taskIds.filter(Boolean)));
  if (uniqueTaskIds.length === 0) return emptyFacts();

  const tables=['subtasks','task_progress_updates','subtask_progress_updates','task_submissions','subtask_submissions','task_status_history','task_attachments','subtask_submission_attachments'];
  // Chunk identifiers as well as result pages to keep PostgREST URLs bounded.
  const sources=await Promise.all(tables.map(async table=>{
   const rows:Record<string,unknown>[]=[];
   for(let offset=0;offset<uniqueTaskIds.length;offset+=100)rows.push(...await readAllRows<Record<string,unknown>>((from,to)=>supabase.from(table).select('*',{count:'exact'}).in('task_id',uniqueTaskIds.slice(offset,offset+100)).order('id',{ascending:true}).range(from,to)));
   return {data:rows};
  }));
  const [subtasksResult,taskProgressResult,subtaskProgressResult,taskSubmissionResult,subtaskSubmissionResult,historyResult,taskEvidenceResult,subtaskEvidenceResult]=sources;

  return {
    subtasks: (subtasksResult.data || []).map((row: Record<string, unknown>) => rowToSubtask(row)),
    progress: [
      ...(taskProgressResult.data || []).map((row: Record<string, unknown>) => toProgress(row, "task")),
      ...(subtaskProgressResult.data || []).map((row: Record<string, unknown>) => toProgress(row, "subtask")),
    ].sort((a, b) => b.createdAt - a.createdAt),
    submissions: [
      ...(taskSubmissionResult.data || []).map((row: Record<string, unknown>) => toSubmission(row, "task")),
      ...(subtaskSubmissionResult.data || []).map((row: Record<string, unknown>) => toSubmission(row, "subtask")),
    ].sort((a, b) => b.submittedAt - a.submittedAt),
    statusHistory: (historyResult.data || []).map((row: Record<string, unknown>) => toStatusFact(row)),
    evidence: [
      ...(taskEvidenceResult.data || []).map((row: Record<string, unknown>) => toEvidence(row, "task")),
      ...(subtaskEvidenceResult.data || []).map((row: Record<string, unknown>) => toEvidence(row, "subtask")),
    ].sort((a, b) => b.createdAt - a.createdAt),
  };
}

export function subscribeToTeamWorkflowFacts(
  taskIds: string[],
  onChange: (facts: TeamWorkflowFacts) => void,
  onError: (message: string) => void,
): () => void {
  let disposed = false;
  let reloadTimer = 0;
  const load = async () => {
    try {
      const facts = await fetchTeamWorkflowFacts(taskIds);
      if (!disposed) onChange(facts);
    } catch (error) {
      if (!disposed) onError(error instanceof Error ? error.message : "Unable to load team workflow analytics.");
    }
  };
  const queueLoad = () => {
    window.clearTimeout(reloadTimer);
    reloadTimer = window.setTimeout(load, 120);
  };

  void load();
  // Refresh against current RLS even when an expired recipient receives no row event.
  const poll=window.setInterval(queueLoad,15_000);
  window.addEventListener('focus',queueLoad);
  window.addEventListener('eflow-project-access-changed',queueLoad);

  return () => {
    disposed = true;
    window.clearTimeout(reloadTimer);
    window.clearInterval(poll);
    window.removeEventListener('focus',queueLoad);
    window.removeEventListener('eflow-project-access-changed',queueLoad);
  };
}
