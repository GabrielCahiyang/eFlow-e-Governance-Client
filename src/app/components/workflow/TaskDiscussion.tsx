// ─── TaskDiscussion ──────────────────────────────────────────────
// Threaded comments on a task. Participation is restricted to the task's
// assignees / team members and authorized reviewers. Dept Head / Admin
// may moderate (soft-delete with a reason → audit event, history preserved).

import { useEffect, useMemo, useState } from "react";
import { Send, Trash2, MoreHorizontal, ShieldAlert } from "lucide-react";
import {
  subscribeToComments,
  postComment,
  moderateDeleteComment,
  mergeTaskComments,
  type TaskComment,
} from "../../services/taskDiscussionService";
import { useAuth } from "../../contexts/AuthContext";
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
  return new Date(ts).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
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
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const canModerate = userProfile?.role === "head";

  useEffect(() => {
    const unsub = subscribeToComments(taskId, setComments);
    return unsub;
  }, [taskId]);

  const visible = useMemo(() => comments.filter((c) => !c.deletedAt || canModerate), [comments, canModerate]);

  const send = async () => {
    if (!draft.trim() || !user?.id) return;
    setSending(true);
    try {
      const posted = await postComment(taskId, draft, { id: user.id, name: userProfile?.full_name || "You" });
      setComments((current) => mergeTaskComments(current, posted));
      setDraft("");
    } catch (e: any) {
      toast(e?.message || "Failed to post comment.", "error");
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    const reason = window.prompt("Reason for removing this comment (recorded in the audit log):");
    if (reason == null) return;
    if (!reason.trim()) {
      toast("A reason is required to remove a comment.", "error");
      return;
    }
    try {
      await moderateDeleteComment(id, { id: user!.id }, reason);
      setMenuFor(null);
      toast("Comment removed. History preserved in the audit log.", "success");
    } catch (e: any) {
      toast(e?.message || "Failed to remove comment.", "error");
    }
  };

  return (
    <div className="flex flex-col">
      <div className="space-y-3 mb-3">
        {visible.length === 0 && (
          <div className="text-center py-6 text-[12px] font-normal text-neutral-400">
            No comments yet. Start the discussion.
          </div>
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
                      <button
                        onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}
                        className="text-neutral-400 hover:text-neutral-700 p-0.5"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      {menuFor === c.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                          <div className="absolute right-0 top-6 z-20 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 w-40">
                            <button
                              onClick={() => remove(c.id)}
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
        <div className="flex items-end gap-2 border-t border-neutral-100 pt-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
            }}
            rows={2}
            placeholder="Write a comment…  (⌘/Ctrl + Enter to send)"
            className="flex-1 resize-none rounded-lg border border-neutral-200 px-3 py-2 text-[12.5px] font-normal text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-200"
          />
          <button
            onClick={send}
            disabled={!draft.trim() || sending}
            className="h-9 px-3 rounded-lg bg-neutral-900 text-white text-[12px] font-medium flex items-center gap-1.5 disabled:opacity-40 hover:bg-neutral-800"
          >
            <Send size={13} /> Send
          </button>
        </div>
      ) : (
        <div className="border-t border-neutral-100 pt-3 text-[11.5px] font-normal text-neutral-400 text-center">
          You have read-only access to this discussion.
        </div>
      )}
    </div>
  );
}
