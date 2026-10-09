// ─── eFlow Task Discussion Service (Supabase) ────────────────────
// Two closely-related task collaboration surfaces, kept together because both
// hang off a task and the UI shows them in one Activity tab:
//   • task_comments          — free-form threaded discussion (moderatable)
//   • task_progress_updates  — structured progress reports (percent, blocker…)
//
// Realtime via per-task postgres_changes channels. Comment moderation soft-
// deletes (keeps the row, stamps deleted_at) and writes an audit event, so
// removal never erases history.

import { supabase } from '../../lib/supabase';
import { recordAudit } from './auditService';
import { createNotification } from './notificationService';

// ══════════════════════ Comments ══════════════════════════════════
export interface TaskComment {
  id: string;
  taskId: string;
  authorId?: string;
  authorName: string;
  body: string;
  createdAt: number;
  editedAt?: number;
  deletedAt?: number;
}

function rowToComment(row: Record<string, unknown>): TaskComment {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    authorId: (row.author_id as string) || undefined,
    authorName: (row.author_name as string) || 'User',
    body: (row.body as string) || '',
    createdAt: new Date((row.created_at as string) || Date.now()).getTime(),
    editedAt: row.edited_at ? new Date(row.edited_at as string).getTime() : undefined,
    deletedAt: row.deleted_at ? new Date(row.deleted_at as string).getTime() : undefined,
  };
}

export async function fetchComments(taskId: string): Promise<TaskComment[]> {
  try { return await fetchCommentsStrict(taskId); } catch { return []; }
}
export async function fetchCommentsStrict(taskId: string): Promise<TaskComment[]> {
  const { data, error } = await supabase
    .from('task_comments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(rowToComment);
}

export function mergeTaskComments(
  current: TaskComment[],
  incoming: TaskComment | TaskComment[],
) {
  const byId = new Map(current.map((comment) => [comment.id, comment]));
  for (const comment of Array.isArray(incoming) ? incoming : [incoming]) {
    byId.set(comment.id, comment);
  }
  return Array.from(byId.values()).sort(
    (left, right) => left.createdAt - right.createdAt,
  );
}

export function subscribeToComments(taskId: string, callback: (c: TaskComment[]) => void, onError?: (message: string) => void): () => void {
  let active = true;
  const load = () => fetchCommentsStrict(taskId).then(comments => { if (active) callback(comments); }).catch(reason => { if (!active) return; if (onError) onError(reason instanceof Error ? reason.message : 'Could not load comments.'); else callback([]); });
  void load();
  const channelId = `comments-${taskId}-${Math.random().toString(36).slice(2)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments', filter: `task_id=eq.${taskId}` }, () => load())
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') void load();
    });
  const reloadWhenVisible = () => {
    if (document.visibilityState === 'visible') void load();
  };
  window.addEventListener('focus', load);
  document.addEventListener('visibilitychange', reloadWhenVisible);
  return () => {
    active = false;
    window.removeEventListener('focus', load);
    document.removeEventListener('visibilitychange', reloadWhenVisible);
    void supabase.removeChannel(channel);
  };
}

export async function postComment(
  taskId: string,
  body: string,
  author: { id: string; name: string },
): Promise<TaskComment> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Comment cannot be empty.');
  if (!author.id) throw new Error('You must be signed in to comment.');

  const { data, error } = await supabase
    .from('task_comments')
    .insert({ task_id: taskId, author_id: author.id, author_name: author.name, body: trimmed })
    .select()
    .single();
  if (error) throw error;

  // Notify other participants (assignee + creator) — deep-linked to the task.
  const { data: task } = await supabase
    .from('tasks')
    .select('title, assigned_to, created_by')
    .eq('id', taskId)
    .maybeSingle();
  if (task) {
    const recipients = new Set<string>();
    if (task.assigned_to && task.assigned_to !== author.id) recipients.add(task.assigned_to as string);
    if (task.created_by && task.created_by !== author.id) recipients.add(task.created_by as string);
    await Promise.all(
      Array.from(recipients).map((uid) =>
        createNotification(uid, {
          type: 'comment',
          title: 'New comment',
          message: `${author.name} commented on "${task.title || 'a task'}".`,
          taskId,
          taskTitle: (task.title as string) || '',
          actorId: author.id,
          actorName: author.name,
        }),
      ),
    );
  }

  await recordAudit({ entityType: 'task_comment', entityId: data.id, action: 'comment.posted', metadata: { taskId } });
  return rowToComment(data as Record<string, unknown>);
}

export async function editComment(commentId: string, body: string): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Comment cannot be empty.');
  const { error } = await supabase
    .from('task_comments')
    .update({ body: trimmed, edited_at: new Date().toISOString() })
    .eq('id', commentId);
  if (error) throw error;
}

// Moderation: soft-delete keeps history; requires a reason for the audit trail.
export async function moderateDeleteComment(
  commentId: string,
  moderator: { id: string },
  reason: string,
): Promise<void> {
  if (!reason.trim()) throw new Error('A reason is required to remove a comment.');
  const { data: before } = await supabase.from('task_comments').select('*').eq('id', commentId).maybeSingle();
  const { error } = await supabase
    .from('task_comments')
    .update({ deleted_at: new Date().toISOString(), deleted_by: moderator.id })
    .eq('id', commentId);
  if (error) throw error;

  await recordAudit({
    entityType: 'task_comment',
    entityId: commentId,
    action: 'comment.moderated',
    reason,
    beforeData: before ? { body: before.body, author: before.author_name } : undefined,
    afterData: { deleted: true },
  });
}

// ══════════════════════ Progress updates ══════════════════════════
export interface ProgressUpdate {
  id: string;
  taskId: string;
  authorId?: string;
  authorName: string;
  percentComplete?: number;
  blockerCategory?: string;
  blocker?: string;
  nextStep?: string;
  note?: string;
  attachmentPath?: string;
  attachmentName?: string;
  createdAt: number;
}

function rowToProgress(row: Record<string, unknown>): ProgressUpdate {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    authorId: (row.author_id as string) || undefined,
    authorName: (row.author_name as string) || 'User',
    percentComplete: row.percent_complete == null ? undefined : (row.percent_complete as number),
    blockerCategory: (row.blocker_category as string) || undefined,
    blocker: (row.blocker as string) || undefined,
    nextStep: (row.next_step as string) || undefined,
    note: (row.note as string) || undefined,
    attachmentPath: (row.attachment_path as string) || undefined,
    attachmentName: (row.attachment_name as string) || undefined,
    createdAt: new Date((row.created_at as string) || Date.now()).getTime(),
  };
}

export async function fetchProgressUpdates(taskId: string): Promise<ProgressUpdate[]> {
  try { return await fetchProgressUpdatesStrict(taskId); } catch { return []; }
}
export async function fetchProgressUpdatesStrict(taskId: string): Promise<ProgressUpdate[]> {
  const { data, error } = await supabase
    .from('task_progress_updates')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(rowToProgress);
}

export function subscribeToProgressUpdates(taskId: string, callback: (p: ProgressUpdate[]) => void, onError?: (message: string) => void): () => void {
  let active = true, sequence = 0;
  const load = async () => {
    const current = ++sequence;
    try { const updates = await fetchProgressUpdatesStrict(taskId); if(active && current === sequence) callback(updates); }
    catch(reason) { if(active && current === sequence) { if(onError) onError(reason instanceof Error ? reason.message : 'Could not load progress.'); else callback([]); } }
  };
  load();
  const channelId = `progress-${taskId}-${Math.random().toString(36).slice(2)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'task_progress_updates', filter: `task_id=eq.${taskId}` }, () => load())
    .subscribe(status => { if(status === 'SUBSCRIBED') void load(); });
  window.addEventListener('focus', load);
  return () => { active = false; ++sequence; window.removeEventListener('focus', load); supabase.removeChannel(channel); };
}

export const BLOCKER_CATEGORIES = [
  'None',
  'Waiting on approval',
  'Waiting on someone',
  'Missing information',
  'Technical issue',
  'Resource / budget',
  'External dependency',
  'Other',
] as const;

export interface ProgressUpdateInput {
  taskId: string;
  author: { id: string; name: string };
  percentComplete?: number;
  blockerCategory?: string;
  blocker?: string;
  nextStep?: string;
  note?: string;
  attachment?: File | null;
}

// Progress never bypasses review to mark a task completed. The first non-zero
// update does, however, advance To Do -> In Progress through the authoritative
// lifecycle RPC so a task cannot display meaningful progress while remaining
// in the untouched queue.
export async function submitProgressUpdate(input: ProgressUpdateInput): Promise<void> {
  if (!input.author.id) throw new Error('You must be signed in.');
  if (
    input.percentComplete != null &&
    (!Number.isFinite(input.percentComplete) ||
      input.percentComplete < 0 ||
      input.percentComplete > 100)
  ) {
    throw new Error('Progress must be between 0 and 100.');
  }

  let attachmentPath: string | null = null;
  let attachmentName: string | null = null;
  if (input.attachment) {
    const safeName = input.attachment.name?.trim() || 'attachment';
    const path = `${input.taskId}/${input.author.id}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from('task-comment-attachments')
      .upload(path, input.attachment, { upsert: false });
    if (upErr) throw upErr;
    attachmentPath = path;
    attachmentName = safeName;
  }

  const hasBlocker = !!input.blocker?.trim() && input.blockerCategory !== 'None';

  const { error } = await supabase.rpc('submit_task_progress', {
    p_task_id: input.taskId,
    p_percent_complete: input.percentComplete ?? null,
    p_blocker_category: hasBlocker
      ? input.blockerCategory || null
      : null,
    p_blocker: hasBlocker ? input.blocker?.trim() || null : null,
    p_next_step: input.nextStep?.trim() || null,
    p_note: input.note?.trim() || null,
    p_attachment_path: attachmentPath,
    p_attachment_name: attachmentName,
  });
  if (error) {
    // The upload belongs only to this attempted progress record. Remove it if
    // the atomic database command rejects the update so no orphan is left.
    if (attachmentPath) {
      await supabase.storage
        .from('task-comment-attachments')
        .remove([attachmentPath]);
    }
    throw new Error(error.message);
  }

  // Notify reviewer/creator when a blocker is raised.
  if (hasBlocker) {
    const { data: task } = await supabase
      .from('tasks')
      .select('title, created_by')
      .eq('id', input.taskId)
      .maybeSingle();
    if (task?.created_by && task.created_by !== input.author.id) {
      await createNotification(task.created_by as string, {
        type: 'status_change',
        title: 'Blocker raised',
        message: `${input.author.name} reported a blocker on "${task.title || 'a task'}": ${input.blocker}`,
        taskId: input.taskId,
        taskTitle: (task.title as string) || '',
        actorId: input.author.id,
        actorName: input.author.name,
      });
    }
  }

}

// Fresh signed URL for a private progress/comment attachment.
export async function getAttachmentSignedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from('task-comment-attachments')
    .createSignedUrl(path, 60 * 10); // 10 min
  if (error) return null;
  return data.signedUrl;
}
