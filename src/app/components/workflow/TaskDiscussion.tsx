import { ActionBlockerGroup } from "../ui/action-blockers";
import { WorkspaceTooltip } from "../ui/workspace/WorkspaceTooltip";
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/button';
import { FeatureDialog } from '../ui/FeatureDialog';
import { BoundedTextarea } from '../ui/BoundedInput';
import { requestNavigation } from '../../shared/navigationGuard';
import { useExplicitDraft } from '../../shared/useExplicitDraft';
import { INPUT_LIMITS, textLengthError } from '../../shared/inputLimits';
// ─── TaskDiscussion ──────────────────────────────────────────────
// Threaded comments on a task. Participation is restricted to the task's
// assignees / team members and authorized reviewers. Dept Head / Admin
// may moderate (soft-delete with a reason → audit event, history preserved).

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Send, Trash2, MoreHorizontal, ShieldAlert } from "lucide-react";
import {
  subscribeToComments,
  postComment,
  moderateDeleteComment,
  mergeTaskComments,
  type TaskComment,
} from "../../services/taskDiscussionService";
import { useAuth } from "../../contexts/AuthContext";
import { formatManilaDate } from "../../shared/calendarDisplay";
import { useToast } from "../ui/Toast";
import { InitialsAvatar } from "./StatusBadges";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return formatManilaDate(ts, "");
}

export function TaskDiscussion({
  taskId,
  canParticipate = true,
}: {
  taskId: string;
  canParticipate?: boolean;
}) {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(''), [retry, setRetry] = useState(0);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const draftGuard = useExplicitDraft('Task discussion', !!draft.trim(), sending, () => setDraft(''));
  const currentTask = useRef(taskId); currentTask.current = taskId;
  const [moderating, setModerating] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const [removing, setRemoving] = useState(false);
  const moderationReasonId = useId();
  const moderationGuard = useExplicitDraft('Comment moderation reason', !!moderating && !!reason.trim(), removing, () => {
    setReason('');
    setReasonTouched(false);
  });
  const closeModeration = () => {
    if (!moderationGuard.pendingRef.current) {
      void requestNavigation(() => {
        setModerating(null);
        setReason('');
        setReasonTouched(false);
      });
    }
  };
  const canModerate = userProfile?.role === "head";

  const MIN_MODERATION_REASON = 5;
  const trimmedReason = reason.trim();
  const reasonError = textLengthError(reason, "Reason", {
    required: true,
    min: MIN_MODERATION_REASON,
    max: INPUT_LIMITS.REASON,
  });
  const visibleReasonError = (reasonTouched || reason.length > 0) && reasonError ? reasonError : undefined;
  const removeDisabled = removing || Boolean(reasonError);
  const removeBlocker =
    !trimmedReason
      ? `Enter a removal reason (at least ${MIN_MODERATION_REASON} characters) before removing.`
      : trimmedReason.length < MIN_MODERATION_REASON
        ? `Reason must be at least ${MIN_MODERATION_REASON} characters (${MIN_MODERATION_REASON - trimmedReason.length} more needed).`
        : reasonError;

  const sendDisabled = !draft.trim() || sending;

  useEffect(() => {
    setComments([]); setLoading(true); setLoadError('');
    const unsub = subscribeToComments(taskId, next => { if (currentTask.current === taskId) { setComments(next); setLoading(false); setLoadError(''); } }, message => { if (currentTask.current === taskId) { setLoading(false); setLoadError(message); } });
    return unsub;
  }, [taskId, retry]);

  const visible = useMemo(() => comments.filter((c) => !c.deletedAt || canModerate), [comments, canModerate]);

  const send = async () => {
    if (!draft.trim() || !user?.id || !canParticipate || draftGuard.pendingRef.current) return;
    draftGuard.pendingRef.current = true;
    setSending(true);
    try {
      const posted = await postComment(taskId, draft, { id: user.id, name: userProfile?.full_name || "You" });
      setComments((current) => mergeTaskComments(current, posted));
      setDraft("");
      draftGuard.markClean();
    } catch (e: any) {
      toast(e?.message || "We couldn't post your comment. Check the discussion before posting it again.", "error");
    } finally {
      draftGuard.pendingRef.current = false;
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    if (!canModerate || !user?.id || moderationGuard.pendingRef.current) return;
    if (reasonError) {
      setReasonTouched(true);
      toast(reasonError, "error");
      return;
    }
    moderationGuard.pendingRef.current = true; setRemoving(true);
    try {
      await moderateDeleteComment(id, { id: user!.id }, reason);
      setMenuFor(null); setModerating(null); setReason(''); setReasonTouched(false); moderationGuard.markClean();
      toast("Comment removed. History preserved in the audit log.", "success");
    } catch (e: any) {
      toast(e?.message || "We couldn't remove this comment. Check the discussion before trying again.", "error");
    } finally { moderationGuard.pendingRef.current = false; setRemoving(false); }
  };

  return (
    <><div className="flex flex-col">
      <div className="space-y-3 mb-3">
        {loading && <p role="status">Loading discussion…</p>}
        {loadError && <div role="alert"><p>{loadError}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Retry discussion</button></div>}
        {!loading && !loadError && visible.length === 0 && (
          <EmptyState illustration="chat" size="compact" title="No comments yet. Start the discussion."/>
        )}
        {visible.map((c) => {
          const mine = c.authorId === user?.id;
          return (
            <div key={c.id} className="flex gap-2.5 group">
              <InitialsAvatar name={c.authorName} size={28} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] font-medium text-neutral-900">
                    {c.authorName}
                  </span>
                  {mine && (
                    <span className="text-[9.5px] font-medium text-neutral-400 uppercase tracking-wide">
                      You
                    </span>
                  )}
                  <span className="text-[10.5px] text-neutral-400">{timeAgo(c.createdAt)}</span>
                  {c.editedAt && <span className="text-[10px] text-neutral-300">· edited</span>}
                  {canModerate && !c.deletedAt && (
                    <div className="relative ml-auto opacity-0 group-hover:opacity-100 transition">
                      <WorkspaceTooltip content="Comment actions"><button type="button" aria-label="Comment actions"
                        onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}
                        className="text-neutral-400 hover:text-neutral-700 p-0.5"
                      >
                        <MoreHorizontal size={14} />
                      </button></WorkspaceTooltip>
                      {menuFor === c.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                          <div className="absolute right-0 top-6 z-20 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 w-40">
                            <button
                              type="button"
                              onClick={() => { setModerating(c.id); setReason(''); setReasonTouched(false); setMenuFor(null); }}
                              className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={12} /> Remove comment
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {c.deletedAt ? (
                  <div className="text-[12px] font-normal text-neutral-400 italic flex items-center gap-1.5 mt-0.5">
                    <ShieldAlert size={12} /> Comment removed by a moderator (kept in audit log)
                  </div>
                ) : (
                  <div className="text-[12.5px] font-normal text-neutral-700 whitespace-pre-wrap mt-0.5">
                    {c.body}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {canParticipate ? (
        <div className="border-t border-neutral-100 pt-3">
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <BoundedTextarea
                aria-label="Task discussion comment"
                disabled={sending}
                maxLength={INPUT_LIMITS.COMMENT}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
                }}
                rows={2}
                placeholder="Write a comment…  (⌘/Ctrl + Enter to send)"
                className="resize-none rounded-lg border border-neutral-200 px-3 py-2 text-[12.5px] font-normal text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-200"
              />
            </div>
            <ActionBlockerGroup
              actionLabel="Send comment"
              blockers={!draft.trim() ? "Enter a comment before sending." : []}
              busy={sending}
              compact
              size="sm"
              className="shrink-0"
            >
              <button
                type="button"
                onClick={send}
                disabled={sendDisabled}
                className="h-9 px-3 rounded-lg bg-neutral-900 text-white text-[12px] font-medium flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none hover:bg-neutral-800 shrink-0"
              >
                <Send size={13} /> Send
              </button>
            </ActionBlockerGroup>
          </div>
        </div>
      ) : (
        <div className="border-t border-neutral-100 pt-3 text-[11.5px] font-normal text-neutral-400 text-center">
          You have read-only access to this discussion.
        </div>
      )}
    </div>
    {moderating && <FeatureDialog title="Remove comment" description="The reason is recorded in the audit log and comment history is preserved." onClose={closeModeration} preventClose={removing} contentClassName="max-w-md">
      <form
        className="p-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void remove(moderating);
        }}
      >
        <h2 className="text-lg font-semibold">Remove comment</h2>
        <div className="space-y-1">
          <label htmlFor={moderationReasonId} className="block text-sm font-medium text-neutral-800">
            Reason <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
          </label>
          <BoundedTextarea
            id={moderationReasonId}
            aria-label="Comment removal reason"
            aria-required
            rows={3}
            maxLength={INPUT_LIMITS.REASON}
            className="w-full rounded-md border border-neutral-200 p-2 text-sm text-neutral-900 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-200"
            value={reason}
            disabled={removing}
            error={visibleReasonError}
            placeholder="Explain why this comment is being removed (at least 5 characters)…"
            onBlur={() => setReasonTouched(true)}
            onChange={(event) => {
              setReason(event.target.value);
              if (!reasonTouched) setReasonTouched(true);
            }}
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="outline" type="button" onClick={closeModeration} disabled={removing}>
            Cancel
          </Button>
          <ActionBlockerGroup
            actionLabel="Remove comment"
            blockers={removeDisabled ? removeBlocker : []}
            busy={removing}
            size="md"
          >
            <WorkspaceTooltip
              content="Removes this comment from the discussion while keeping its record in the audit log."
              disabled={removeDisabled}
            >
              <Button variant="destructive" type="submit" pending={removing} disabled={removeDisabled}>
                Remove comment
              </Button>
            </WorkspaceTooltip>
          </ActionBlockerGroup>
        </div>
      </form>
    </FeatureDialog>}
    </>
  );
}
