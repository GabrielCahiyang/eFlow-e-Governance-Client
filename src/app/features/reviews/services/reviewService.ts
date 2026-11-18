import { supabase } from "../../../../lib/supabase";
import type { ReviewAttachment, ReviewSubmission } from "../types";

const timestamp = (value: unknown): number | undefined =>
  typeof value === "string" && value ? new Date(value).getTime() : undefined;

export async function fetchDecidedSubmissionIds(ids: string[]): Promise<Set<string>> {
  const decided = new Set<string>();
  for (let offset = 0; offset < ids.length; offset += 50) {
    const { data, error } = await supabase.from('task_submissions').select('id')
      .in('id', ids.slice(offset, offset + 50)).in('status', ['approved', 'changes_requested']);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) decided.add(row.id);
  }
  return decided;
}

export async function fetchTaskSubmissions(
  taskId: string,
): Promise<ReviewSubmission[]> {
  const { data, error } = await supabase
    .from("task_submissions")
    .select("*")
    .eq("task_id", taskId)
    .order("version", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    id: row.id as string,
    taskId: row.task_id as string,
    version: row.version as number,
    submitterId: row.submitter_id as string,
    submitterName: (row.submitter_name as string) || "User",
    note: (row.note as string) || "",
    status: row.status as ReviewSubmission["status"],
    decidedBy: (row.decided_by as string) || undefined,
    decidedByName: (row.decided_by_name as string) || undefined,
    decisionFeedback: (row.decision_feedback as string) || undefined,
    decidedAt: timestamp(row.decided_at),
    submittedAt: timestamp(row.submitted_at) || Date.now(),
  }));
}

export async function fetchSubmissionAttachments(
  taskId: string,
  submissionId?: string,
): Promise<ReviewAttachment[]> {
  let query = supabase
    .from("task_attachments")
    .select("*")
    .eq("task_id", taskId);

  query = submissionId
    ? query.eq("submission_id", submissionId)
    : query.is("submission_id", null);

  const { data, error } = await query.order("created_at", {
    ascending: false,
  });
  if (error) throw new Error(error.message);

  return (data || []).map((row) => ({
    id: row.id as string,
    submissionId: (row.submission_id as string) || undefined,
    fileName: (row.file_name as string) || "Attachment",
    filePath: row.file_path as string,
    fileSize: Number(row.file_size || 0),
    mimeType: (row.mime_type as string) || "",
    createdAt: timestamp(row.created_at) || Date.now(),
  }));
}
