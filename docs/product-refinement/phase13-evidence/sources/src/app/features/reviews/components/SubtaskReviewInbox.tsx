import { useEffect, useMemo, useState } from "react";
import { Search as VibeSearch, Skeleton } from "@vibe/core";
import { CheckCircle2, Clock, Inbox, MessageSquareWarning, Search } from "lucide-react";
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { requestNavigation } from '../../../shared/navigationGuard';
import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../components/ui/Toast";
import {
  PageHeader,
  SectionEmpty,
  formatDate,
} from "../../../components/workflow/primitives";
import {
  decideSubtaskReview,
  subscribeToPendingSubtaskReviews,
} from "../../subtasks/services/subtaskWorkflowService";
import type { SubtaskReviewItem } from "../../subtasks/types";
import { SubtaskEvidenceLink } from "../../subtasks/components/SubtaskEvidenceLink";
import { ReviewKindSwitch } from "./ReviewKindSwitch";
import type { NotificationNavigationIntent } from "../../notifications";

export function SubtaskReviewInbox({
  onShowTasks,
  onShowBudget,
  focus,
  embedded = false,
}: {
  onShowTasks: () => void;
  onShowBudget?: () => void;
  focus?: NotificationNavigationIntent | null;
  embedded?: boolean;
}) {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<SubtaskReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [sourceError,setSourceError] = useState("");
  const [revision,setRevision] = useState(0);
  const [focusError,setFocusError] = useState("");
  const draft = useExplicitDraft("Subtask review feedback",!!feedback,deciding,()=>setFeedback(""));

  useEffect(() => {setItems([]);setFeedback("");setFocusError("");setSelectedId(null);},[user?.id]);
  useEffect(() => {
    setSourceError("");setLoading(true);
    if (!user?.id) {setLoading(false);return;}
    return subscribeToPendingSubtaskReviews(
      user.id,
      false,
      (next) => {
        setItems(next);
        setSourceError("");
        setLoading(false);
      },
      (error) => {setSourceError(error.message);setLoading(false);},
    );
  }, [user?.id, userProfile?.role, revision]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      [item.subtask.title, item.taskTitle, item.submission.submitterName, item.projectTitle]
        .some((value) => value?.toLowerCase().includes(needle)),
    );
  }, [items, query]);

  useEffect(() => {
    if (feedback || deciding || (focusError && !selectedId)) return;
    if (!filtered.length) setSelectedId(null);
    else if (!selectedId || !filtered.some((item) => item.subtask.id === selectedId)) {
      setSelectedId(filtered[0].subtask.id);
    }
  }, [filtered, selectedId, feedback, deciding, focusError]);

  const selected = filtered.find((item) => item.subtask.id === selectedId) || null;

  useEffect(() => {
    if (!focus || loading) return;
    const label = focus.entityLabel?.trim().toLowerCase();
    const matches = items.filter((item) =>
      (!focus.entityId || item.subtask.id === focus.entityId)
      && (!focus.taskId || item.subtask.taskId === focus.taskId)
      && (!label || item.subtask.title.trim().toLowerCase() === label),
    );
    if (matches.length === 1) {setSelectedId(matches[0].subtask.id);setFocusError("");}
    else {setSelectedId(null);setFocusError("The referenced submission was withdrawn, is outside your access, or has an ambiguous older label. Choose a current submission.");}
  }, [focus, items, loading]);
  const decide = async (approve: boolean) => {
    if (!selected || draft.pendingRef.current) return;
    draft.pendingRef.current = true;
    setDeciding(true);
    try {
      await decideSubtaskReview(selected.subtask.id, approve, feedback);
      setItems((current) => current.filter((item) => item.subtask.id !== selected.subtask.id));
      setFeedback("");
      draft.markClean();
      toast(approve ? "Subtask evidence approved." : "Changes sent back to the contributor.", "success");
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Review decision failed.", "error");
    } finally {
      draft.pendingRef.current = false;
      setDeciding(false);
    }
  };

  if (sourceError) return <FeedbackState tone="error" title="Subtask reviews could not be loaded" onRetry={() => setRevision(value => value + 1)}>{sourceError}</FeedbackState>;

  if (loading) return (
    <div className={embedded ? "space-y-4" : "eflow-operational-workspace min-h-full p-4 sm:p-8"} aria-live="polite" role="status">
      <Skeleton type="text" width={220} />
      <Skeleton type="text" width={340} />
      <div className="grid gap-4 lg:grid-cols-[minmax(300px,380px)_1fr]">
        <Skeleton type="rectangle" size="custom" height={280} fullWidth />
        <Skeleton type="rectangle" size="custom" height={360} fullWidth />
      </div>
    </div>
  );

  const inboxContent = (
    <div className={embedded ? "space-y-4" : "eflow-operational-workspace min-h-full p-4 sm:p-8"}>
      {!embedded && <PageHeader
        eyebrow="Leader Workspace · Reviews"
        title="Subtask Evidence"
        subtitle="Approve evidence before a subtask contributes to parent-task completion."
        actions={
          <div className="flex w-full min-w-0 max-w-full flex-wrap items-center gap-2">
            <ReviewKindSwitch
              active="subtasks"
              includeBudget={Boolean(onShowBudget)}
              onChange={(kind) => {
                if (kind === "tasks") void requestNavigation(onShowTasks);
                if (kind === "budget" && onShowBudget) void requestNavigation(onShowBudget);
              }}
            />
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] text-amber-700">
              <Inbox size={14} /> {items.length} awaiting review
            </div>
          </div>
        }
      />}

      {focusError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">{focusError}</p>}
      {items.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white">
          <SectionEmpty icon={<CheckCircle2 size={30} />} title="No subtask evidence waiting" description="New evidence submissions from your team will appear here." />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,380px)_1fr]">
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <div className="border-b border-neutral-100 p-3">
              <VibeSearch value={query} onChange={value => void requestNavigation(() => setQuery(value))} onClear={() => void requestNavigation(() => setQuery(""))} placeholder="Search subtask evidence…" inputAriaLabel="Search subtask evidence" showClearIcon size="small" />
            </div>
            <div className="max-h-[calc(100vh-260px)] divide-y divide-neutral-100 overflow-y-auto">
              {filtered.map((item) => (
                <button
                  key={item.submission.id}
                  type="button"
                  onClick={() => void requestNavigation(() => {setFeedback("");setFocusError("");setSelectedId(item.subtask.id);})}
                  className={`w-full p-3 text-left hover:bg-neutral-50 ${selectedId === item.subtask.id ? "bg-neutral-50" : ""}`}
                >
                  <div className="text-[12.5px] font-medium text-neutral-900">{item.subtask.title}</div>
                  <div className="mt-0.5 truncate text-[11px] text-neutral-500">{item.submission.submitterName} · {item.taskTitle}</div>
                  <div className="mt-1 flex items-center gap-1 text-[10.5px] text-neutral-400"><Clock size={10} /> {formatDate(item.submission.submittedAt)}</div>
                </button>
              ))}
            </div>
          </div>

          {selected ? (
            <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-neutral-400">Subtask evidence · Attempt {selected.submission.version}</div>
                <h2 className="mt-1 text-[17px] font-semibold text-neutral-900">{selected.subtask.title}</h2>
                <div className="mt-1 text-[11.5px] text-neutral-500">Parent task: {selected.taskTitle}{selected.projectTitle ? ` · ${selected.projectTitle}` : ""}</div>
              </div>

              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-[11px] text-neutral-500">Submitted by {selected.submission.submitterName}</div>
                <p className="mt-1 whitespace-pre-wrap text-[12.5px] text-neutral-800">{selected.submission.note}</p>
              </div>

              <div>
                <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-neutral-500">Evidence files</div>
                <div className="space-y-2">
                  {selected.submission.attachments.map((attachment) => (
                    <SubtaskEvidenceLink key={attachment.id || attachment.filePath} fileName={attachment.fileName} filePath={attachment.filePath} />
                  ))}
                </div>
              </div>

              <div className="border-t border-neutral-100 pt-4">
                <label className="text-[10.5px] font-medium text-neutral-500">
                  Feedback (required when requesting changes)
                  <textarea
                    value={feedback}
                    disabled={deciding}
                    onChange={(event) => setFeedback(event.target.value)}
                    placeholder="Explain what needs correction…"
                    className="mt-1 min-h-20 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[12px] outline-none focus:border-neutral-500"
                  />
                </label>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => decide(false)}
                    disabled={deciding || !feedback.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-[11.5px] text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                  >
                    <MessageSquareWarning size={13} /> Request changes
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(true)}
                    disabled={deciding}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-[11.5px] text-white hover:bg-neutral-800 disabled:opacity-40"
                  >
                    <CheckCircle2 size={13} /> {deciding ? "Saving…" : "Approve evidence"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white"><SectionEmpty icon={<Search size={26} />} title="Select evidence" /></div>
          )}
        </div>
      )}
    </div>
  );

  return inboxContent;
}
