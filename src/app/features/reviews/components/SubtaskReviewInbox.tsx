import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search as VibeSearch, Skeleton } from "@vibe/core";
import { CheckCircle2, Clock, Inbox, Search } from "lucide-react";
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
  type SubtaskReviewItem,
} from "../../subtasks";
import { SubitemReviewDetail, type SubitemReviewDetailProps } from "./SubitemReviewDetail";
import { ReviewKindSwitch } from "./ReviewKindSwitch";
import {ReviewSubitemInspector} from './ReviewSubitemInspector';
import type {TaskInspectorOrigin} from '../../task-inspector';
import {useNotificationNavigationIntent,resolveNotificationSubitem,type NotificationNavigationIntent} from "../../notifications";
import {discardSubtaskReviewDraft,recoverSubtaskReviewDraft,sameSubtaskReviewTarget,writeSubtaskReviewDraft} from '../services/subtaskReviewDraftStore';

type SubtaskReviewInboxProps={onShowTasks:()=>void;onShowBudget?:()=>void;focus?:NotificationNavigationIntent|null;embedded?:boolean;readOnly?:boolean;renderDetail?:(props:SubitemReviewDetailProps)=>ReactNode};
/** Remount visible state immediately on actor/sign-in changes. The feedback-only
 * vault survives this visibility clear; recovery still requires a fresh queue.
 */
export function SubtaskReviewInbox(props:SubtaskReviewInboxProps){
  const {user}=useAuth();
  return <ActorSubtaskReviewInbox key={JSON.stringify([user?.id,user?.last_sign_in_at])} {...props}/>;
}

function ActorSubtaskReviewInbox({
  onShowTasks,
  onShowBudget,
  focus,
  embedded = false,
  readOnly = false,
  renderDetail,
}: SubtaskReviewInboxProps) {
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
  const [detailOpen,setDetailOpen]=useState(!!focus||embedded);
  const [opened,setOpened]=useState<{item:SubtaskReviewItem;origin:TaskInspectorOrigin}>();
  const decidedTargets=useRef(new Set<string>());
  const retained = useRef<{actorId: string | undefined; item: SubtaskReviewItem} | null>(null);
  const queueActor = useRef(user?.id);
  const queueReadOnly=useRef<boolean|undefined>(undefined);
  const recovering=useRef(true),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const draft = useExplicitDraft("Subtask review feedback",!!feedback,deciding,()=>{if(user?.id&&retained.current?.actorId===user.id)discardSubtaskReviewDraft(user.id,retained.current.item);setFeedback("");});

  useEffect(() => {queueActor.current=undefined;retained.current=null;setDetailOpen(!!focus||embedded);setItems([]);setFeedback("");setFocusError("");setSelectedId(null);},[user?.id]);
  useEffect(() => {
    setSourceError("");setLoading(true);
    if (!user?.id) {setLoading(false);return;}
    return subscribeToPendingSubtaskReviews(
      user.id,
      false,
      (next) => {
        queueActor.current=user.id;
        queueReadOnly.current=readOnly;
        setItems(next);
        setSourceError("");
        setLoading(false);
      },
      (error) => {setSourceError(error.message);setLoading(false);},
    );
  }, [user?.id, userProfile?.role, revision,readOnly]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const currentItems=queueActor.current===user?.id?items:[];
    if (!needle) return currentItems;
    return currentItems.filter((item) =>
      [item.subtask.title, item.taskTitle, item.submission.submitterName, item.projectTitle,item.subtask.workContext?.pathLabel,item.subtask.workContext?.leadName,...(item.subtask.workContext?.contributors.map(person=>person.name)||[])]
        .some((value) => value?.toLowerCase().includes(needle)),
    );
  }, [items, query, user?.id]);

  useEffect(() => {
    if (feedback || deciding || (focusError && !selectedId)) return;
    if (!filtered.length) setSelectedId(null);
    else if (!selectedId || !filtered.some((item) => item.subtask.id === selectedId)) {
      setSelectedId(filtered[0].subtask.id);
    }
  }, [filtered, selectedId, feedback, deciding, focusError]);

  const currentSelected = filtered.find((item) => item.subtask.id === selectedId) || null;
  const holdFeedback = !!(feedback || deciding) && retained.current?.actorId === user?.id && retained.current?.item.subtask.id === selectedId;
  const selected = holdFeedback ? retained.current!.item : currentSelected;
  if (selected && !holdFeedback) retained.current={actorId:user?.id,item:selected};
  const queueCurrent = !loading && !sourceError && queueReadOnly.current===readOnly && !!currentSelected && !!selected && sameSubtaskReviewTarget(currentSelected,selected);
  const decisionReadOnly = readOnly || !queueCurrent;

  useEffect(()=>{
    if(!user?.id||loading||sourceError||queueActor.current!==user.id||queueReadOnly.current!==readOnly||readOnly||feedback||deciding)return;
    const label=focus?.entityLabel?.trim().toLowerCase();
    const candidates=focus?filtered.filter(item=>(!focus.entityId||item.subtask.id===focus.entityId)&&(!focus.taskId||item.subtask.taskId===focus.taskId)&&(focus.entityId||!label||item.subtask.title.trim().toLowerCase()===label)):recovering.current?filtered:currentSelected?[currentSelected]:[];
    const restored=recoverSubtaskReviewDraft(user.id,focus&&candidates.length!==1?[]:candidates);
    recovering.current=false;
    if(restored){retained.current={actorId:user.id,item:restored.item};setSelectedId(restored.item.subtask.id);setFeedback(restored.feedback);setDetailOpen(true);}
  },[user?.id,loading,sourceError,readOnly,feedback,deciding,filtered,currentSelected,focus]);

  useEffect(() => {
    if (!focus || loading || feedback || deciding || focus.entityId && decidedTargets.current.has(focus.entityId)) return;
    const label = focus.entityLabel?.trim().toLowerCase();
    const matches = items.filter((item) =>
      (!focus.entityId || item.subtask.id === focus.entityId)
      && (!focus.taskId || item.subtask.taskId === focus.taskId)
      && (focus.entityId || !label || item.subtask.title.trim().toLowerCase() === label),
    );
    if (matches.length === 1) {setSelectedId(matches[0].subtask.id);setFocusError("");}
    else {setSelectedId(null);setFocusError("The referenced submission was withdrawn, is outside your access, or has an ambiguous older label. Choose a current submission.");}
  }, [focus, items, loading, feedback, deciding]);
  useNotificationNavigationIntent(
    intent=>!renderDetail&&intent.kind==='subtask_review'&&focus?.notificationId===intent.notificationId,
    async(intent,isCurrent)=>{
      if(loading||deciding)return false;
      const target=resolveNotificationSubitem(intent,sourceError?[]:items.map(item=>item.subtask));
      if(target.status!=='resolved')return true;
      if(!queueCurrent||!selected||selected.subtask.id!==target.item.id)return false;
      // Retained private feedback takes priority over an automatic clean entrance.
      if(intent.inspectorSection!=='review'||feedback||user?.id&&recoverSubtaskReviewDraft(user.id,[selected]))return true;
      if(isCurrent()&&mounted.current){setSelectedId(target.item.id);setFocusError('');setDetailOpen(true);}
      return true;
    },
    [focus,items,loading,sourceError,queueCurrent,selected,feedback,deciding,renderDetail,user?.id],
  );
  const decide = async (approve: boolean) => {
    if (decisionReadOnly || !selected || draft.pendingRef.current) return;
    draft.pendingRef.current = true;
    setDeciding(true);
    try {
      await decideSubtaskReview(selected.subtask.id, approve, feedback,user?.id);
      if(user?.id)discardSubtaskReviewDraft(user.id,selected);
      if(!mounted.current)return;
      decidedTargets.current.add(selected.subtask.id);
      setFocusError('');setSelectedId(null);setDetailOpen(false);
      window.dispatchEvent(new CustomEvent('eflow:work-updated'));
      setItems((current) => current.filter((item) => item.subtask.id !== selected.subtask.id));
      setFeedback("");
      draft.markClean();
      toast(approve ? "Subtask evidence approved." : "Changes sent back to the contributor.", "success");
    } catch (caught) {
      if(mounted.current)toast(caught instanceof Error ? caught.message : "Review decision failed.", "error");
    } finally {
      if(mounted.current){draft.pendingRef.current = false;setDeciding(false);}
    }
  };

  const openedInspector=opened?<ReviewSubitemInspector item={opened.item} origin={opened.origin} readOnly={readOnly} onClose={()=>setOpened(undefined)}/>:null;
  // Keep the canonical work owner mounted through queue refresh/failure. It
  // verifies its own current authority; it replaces the review page visually.
  if(openedInspector)return openedInspector;
  if (sourceError && !selected) return <><FeedbackState tone="error" title="Subtask reviews could not be loaded" onRetry={() => setRevision(value => value + 1)}>{sourceError}</FeedbackState>{openedInspector}</>;

  if (loading && !selected) return (
    <><div className={embedded ? "space-y-4" : "eflow-operational-workspace min-h-full p-4 sm:p-8"} aria-live="polite" role="status">
      <Skeleton type="text" width={220} />
      <Skeleton type="text" width={340} />
      <div className="grid gap-4 lg:grid-cols-[minmax(300px,380px)_1fr]">
        <Skeleton type="rectangle" size="custom" height={280} fullWidth />
        <Skeleton type="rectangle" size="custom" height={360} fullWidth />
      </div>
    </div>{openedInspector}</>
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

      {sourceError && <FeedbackState tone="error" title="Subtask reviews could not be loaded" onRetry={() => setRevision(value => value + 1)}>{sourceError}</FeedbackState>}
      {focusError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">{focusError}</p>}
      {items.length === 0 && !selected ? (
        <div className="rounded-xl border border-neutral-200 bg-white">
          <SectionEmpty illustration="complete" icon={<CheckCircle2 size={30} />} title="No subtask evidence waiting" description="New evidence submissions from your team will appear here." />
        </div>
      ) : (
        <div className="review-page-content">
          <div hidden={detailOpen} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <div className="border-b border-neutral-100 p-3">
              <VibeSearch value={query} onChange={value => void requestNavigation(() => setQuery(value))} onClear={() => void requestNavigation(() => setQuery(""))} placeholder="Search subtask evidence…" inputAriaLabel="Search subtask evidence" showClearIcon size="small" />
            </div>
            <div className="max-h-[calc(100vh-260px)] divide-y divide-neutral-100 overflow-y-auto">
              {filtered.map((item) => (
                <button
                  key={item.submission.id}
                  type="button"
                  onClick={() => void requestNavigation(() => {setFeedback("");setFocusError("");setSelectedId(item.subtask.id);setDetailOpen(true);})}
                  className={`w-full p-3 text-left hover:bg-neutral-50 ${selectedId === item.subtask.id ? "bg-neutral-50" : ""}`}
                >
                  <div className="text-[12.5px] font-medium text-neutral-900">{item.subtask.title}</div>
                  <div className="mt-0.5 truncate text-[11px] text-neutral-500">{item.submission.submitterName} · {item.taskTitle}</div>
                  <div className="mt-1 flex items-center gap-1 text-[10.5px] text-neutral-400"><Clock size={10} /> {formatDate(item.submission.submittedAt)}</div>
                  {item.subtask.workContext&&<div className="mt-1 break-words text-[11px] text-neutral-500">{item.subtask.workContext.pathLabel}</div>}
                </button>
              ))}
            </div>
          </div>

          {selected && detailOpen ? (<div>
            {!renderDetail&&<div className="flex items-center justify-between gap-3"><button className="task-page__back" type="button" onClick={()=>void requestNavigation(()=>setDetailOpen(false))}>← Back to review queue</button><button type="button" data-review-open-work disabled={!queueCurrent||deciding} onClick={event=>{const element=event.currentTarget;void requestNavigation(()=>setOpened({item:selected,origin:{view:'Review',section:'work',returnFocus:element,restoreFocus:()=>{const target=document.querySelector<HTMLButtonElement>('[data-review-open-work]')||document.querySelector<HTMLInputElement>('[aria-label="Search subtask evidence"]');target?.focus();}}}));}}>Open work</button></div>}
            {
            (renderDetail || (props => <SubitemReviewDetail {...props}/>))({
              item:queueCurrent&&currentSelected?{...selected,subtask:{...selected.subtask,workContext:currentSelected.subtask.workContext}}:selected, feedback, pending:deciding, readOnly:decisionReadOnly,evidenceAvailable:queueCurrent,
              currentReviewerName:queueCurrent ? userProfile?.full_name || 'You' : undefined,
              onFeedbackChange:value=>{if(!decisionReadOnly&&!deciding&&!draft.pendingRef.current&&user?.id){writeSubtaskReviewDraft(user.id,selected,value);setFeedback(value);}}, onApprove:() => void decide(true), onRequestChanges:() => void decide(false),
            })}</div>
          ) : filtered.length ? null : (
            <div className="rounded-xl border border-neutral-200 bg-white"><SectionEmpty illustration="files" icon={<Search size={26} />} title="Select evidence" /></div>
          )}
        </div>
      )}
    </div>
  );

  return inboxContent;
}
