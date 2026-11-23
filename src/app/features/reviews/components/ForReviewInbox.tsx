// ─── ForReviewInbox ──────────────────────────────────────────────
// A dedicated review workspace, not a filtered Kanban column.
// Single inbox for all review work across eFlow:
// 1. Work Plan Reviews (incoming proposals & collaborative plans)
// 2. Project Task Reviews (submitted tasks & completion evidence)
// 3. Governance / Approval (formal approvals and governance commits)
// 4. Subtasks & Budget reviews

import { requestNavigation } from '../../../shared/navigationGuard';
import { writeNavigationLocation } from '../../navigation';
import { resolveReviewView } from '../reviewView';
import '../reviewWorkspace.css';
import { NAVIGATION_LOCATION_EVENT } from '../../../shared/navigationHistory';
import { useEffect, useMemo, useState } from "react";
import { Dropdown, Search as VibeSearch } from "@vibe/core";
import {
  Inbox,
  Clock,
  CheckCircle2,
  Search,
  Building2,
  Layers,
  ChevronRight,
  Gauge,
  ClipboardCheck,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useTasks } from "../../../hooks/useFirebaseData";
import { useProjectsData, useScopedOrgIds } from "../../../hooks/useSupabaseData";
import { notifyTaskListeners } from "../../tasks";
import type { Task } from "../../../services/taskService";
import {
  canUserReviewTask,
  getInitialReviewWorkspaceKind,
  isTaskVisibleInReviewQueue,
} from "../selectors";
import {
  fetchProgressUpdates,
  type ProgressUpdate,
} from "../../../services/taskDiscussionService";
import {
  PageHeader,
  SectionEmpty,
  formatDate,
} from "../../../components/workflow/primitives";
import { InitialsAvatar, PriorityPill } from "../../../components/workflow/StatusBadges";
import { TaskReviewPanel } from "./TaskReviewPanel";
import { fetchDecidedSubmissionIds } from '../services/reviewService';
import { TaskActivityTimeline } from "../../../components/workflow/TaskActivityTimeline";
import { getHeadWorkspaceLabel } from "../../../shared/roles";
import { canOpenBudgetReviewWorkspace } from "../selectors";
import { BudgetReviewInbox, type CashReviewFocus } from "../../budget";
import { SubtaskReviewInbox } from "./SubtaskReviewInbox";
import { ReviewKindSwitch, type ReviewKind } from "./ReviewKindSwitch";
import { TaskSubtaskEvidenceSection } from "./TaskSubtaskEvidenceSection";
import { ReadyToCompleteInbox } from "./ReadyToCompleteInbox";
import { ProjectCompletionReviewQueue } from "./ProjectCompletionReviewQueue";
import { PendingProjectApprovalsQueue } from "./PendingProjectApprovalsQueue";
import { useReadyToCompleteTasks } from "../hooks/useReadyToCompleteTasks";
import { useTaskReviewEvidence } from "../hooks/useTaskReviewEvidence";
import {
  useNotificationNavigationIntent,
  type NotificationNavigationIntent,
} from "../../notifications";

const reviewSortOptions = [
  { value: "oldest", label: "Oldest first" },
  { value: "newest", label: "Newest first" },
];

function timeAgo(ts: number): string {
  const h = Math.floor((Date.now() - ts) / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function TaskReviewsSplitSkeleton() {
  const pulse = "animate-pulse rounded bg-muted";
  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-[minmax(300px,380px)_1fr] gap-4"
      role="status"
      aria-label="Loading task submissions for review…"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading task submissions for review…</span>
      {/* Queue column skeleton */}
      <div
        aria-hidden="true"
        className="flex flex-col overflow-hidden rounded-[10px] border border-border bg-card shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]"
      >
        <div className="flex flex-col gap-2 border-b border-border bg-muted/40 px-4 py-3">
          <div className={`h-8 w-full rounded-md ${pulse}`} />
          <div className={`h-8 w-full rounded-md ${pulse}`} />
        </div>
        <div className="divide-y divide-border">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex w-full gap-3 p-3.5">
              <div className={`h-8 w-8 shrink-0 rounded-full ${pulse}`} />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className={`h-4 flex-1 ${pulse}`} />
                  <div className={`h-4 w-14 rounded-full ${pulse}`} />
                </div>
                <div className={`h-3 w-3/4 ${pulse}`} />
                <div className={`h-2.5 w-24 ${pulse}`} />
              </div>
              <div className={`h-3.5 w-3.5 self-center shrink-0 ${pulse}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Detail column skeleton */}
      <div aria-hidden="true" className="min-w-0 space-y-4">
        <div className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)] space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 flex-1">
              <div className={`h-5 w-1/2 ${pulse}`} />
              <div className="flex flex-wrap gap-3">
                <div className={`h-3.5 w-28 ${pulse}`} />
                <div className={`h-3.5 w-32 ${pulse}`} />
                <div className={`h-3.5 w-24 ${pulse}`} />
              </div>
            </div>
            <div className={`h-5 w-16 rounded-full ${pulse}`} />
          </div>
          <div className={`h-3.5 w-4/5 ${pulse}`} />
          <div className="rounded-[14px] border border-border bg-muted/30 p-3 space-y-1.5">
            <div className={`h-3 w-28 ${pulse}`} />
            <div className={`h-3.5 w-3/5 ${pulse}`} />
          </div>
        </div>
        <div className="rounded-[10px] border border-border bg-card px-4 py-3">
          <div className={`h-4 w-40 ${pulse}`} />
        </div>
        <div className="rounded-[10px] border border-border bg-card px-4 py-3">
          <div className={`h-4 w-48 ${pulse}`} />
        </div>
        <div className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)] space-y-3">
          <div className="flex items-start gap-2.5">
            <div className={`h-8 w-8 rounded-lg ${pulse}`} />
            <div className="space-y-1.5 flex-1">
              <div className={`h-3.5 w-40 ${pulse}`} />
              <div className={`h-3 w-72 max-w-full ${pulse}`} />
            </div>
          </div>
          <div className={`h-20 w-full rounded-lg ${pulse}`} />
        </div>
        <div className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)] space-y-3">
          <div className={`h-3.5 w-32 ${pulse}`} />
          <div className={`h-16 w-full rounded-lg ${pulse}`} />
          <div className="flex gap-2">
            <div className={`h-9 w-28 rounded-lg ${pulse}`} />
            <div className={`h-9 w-36 rounded-lg ${pulse}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

export type ReviewInboxScope = "department" | "leading";

export interface ForReviewInboxProps {
  scope?: ReviewInboxScope;
}

export function ForReviewInbox({ scope = "department" }: ForReviewInboxProps) {
  const { user, userProfile, can } = useAuth();
  const canVerifyTasks = typeof can === "function" ? can("tasks.verify") : true;
  const { tasks, loading: tasksLoading } = useTasks();
  const { includeAllAccessibleWork } = useScopedOrgIds();
  const { projects, loading: projectsLoading } = useProjectsData();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("oldest");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate[]>([]);
  const [reviewKind, setReviewKindState] = useState<ReviewKind>(() => {
    if (typeof window !== "undefined") {
      const view = new URLSearchParams(window.location.search).get("view");
      return resolveReviewView(view, scope, userProfile?.role);
    }
    return getInitialReviewWorkspaceKind(scope);
  });
  const [subtaskFocus, setSubtaskFocus] = useState<NotificationNavigationIntent | null>(null);
  const [budgetFocus, setBudgetFocus] = useState<NotificationNavigationIntent | null>(null);
  const [cashReviewFocus, setCashReviewFocus] = useState<CashReviewFocus | null>(null);
  const [projectApprovalFocusId, setProjectApprovalFocusId] = useState<string | undefined>();
  const [completionReviewFocusId, setCompletionReviewFocusId] = useState<string | undefined>();

  const canReviewBudget = canOpenBudgetReviewWorkspace(scope, userProfile?.role);

  const setReviewKind = (next: ReviewKind) => { void requestNavigation(() => {
    const view = resolveReviewView(next, scope, userProfile?.role);
    setReviewKindState(view);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    writeNavigationLocation('reviews', scope === 'leading' ? 'Leader Reviews' : 'For Review', 'push', { parameters: { ...Object.fromEntries(url.searchParams), view } });
  }); };

  useEffect(() => {
    const onPopState = () => {
      if (window.location.pathname !== '/reviews') return;
      const url = new URL(window.location.href), view = url.searchParams.get("view");
      const resolved = resolveReviewView(view, scope, userProfile?.role);
      setReviewKindState(resolved);
      if (userProfile?.role && view && view !== resolved) {
        writeNavigationLocation('reviews', scope === 'leading' ? 'Leader Reviews' : 'For Review', 'replace', { parameters: { ...Object.fromEntries(url.searchParams), view: resolved } });
      }
    };
    onPopState();
    window.addEventListener("popstate", onPopState);
    window.addEventListener(NAVIGATION_LOCATION_EVENT, onPopState);
    return () => { window.removeEventListener("popstate", onPopState); window.removeEventListener(NAVIGATION_LOCATION_EVENT, onPopState); };
  }, [scope, user?.id, userProfile?.role]);

  const [decided, setDecided] = useState<{ actor?: string; ids: Set<string> }>({ ids: new Set() });
  const candidateIds = useMemo(() => tasks.filter(task => isTaskVisibleInReviewQueue(task, user?.id, userProfile?.role))
    .flatMap(task => task.latestSubmission?.id ? [task.latestSubmission.id] : []), [tasks, user?.id, userProfile?.role]);
  useEffect(() => {
    let active = true;
    if (user?.id && candidateIds.length) void fetchDecidedSubmissionIds(candidateIds).then(ids => {
      if (active) setDecided(previous => ({ actor: user.id, ids: new Set([...(previous.actor === user.id ? previous.ids : []), ...ids]) }));
    }).catch(() => {});
    return () => { active = false; };
  }, [candidateIds, user?.id]);

  const queue = useMemo(() => {
    let rows = tasks.filter(
      (task) => isTaskVisibleInReviewQueue(
        task,
        user?.id,
        userProfile?.role,
      ) && (!task.latestSubmission?.id || decided.actor !== user?.id || !decided.ids.has(task.latestSubmission.id)),
    );
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.assigneeName || "").toLowerCase().includes(q) ||
          (projects.find((project) => project.id === t.linkedProjectId)?.title || t.projectTitle || "").toLowerCase().includes(q),
      );
    }
    const submitAt = (t: Task) => t.latestSubmission?.submittedAt || t.updatedAt;
    rows.sort((a, b) =>
      sort === "oldest" ? submitAt(a) - submitAt(b) : submitAt(b) - submitAt(a),
    );
    return rows;
  }, [
    tasks,
    scope,
    user?.id,
    userProfile?.role,
    query,
    sort,
    projects,
    decided,
  ]);

  const closedProjectIds = useMemo(
    () =>
      new Set(
        projects
          .filter((project) => ["completed", "archived"].includes(project.status))
          .map((project) => project.id),
      ),
    [projects],
  );
  const clearanceCandidates = useMemo(
    () =>
      tasks.filter(
        (task) => !task.linkedProjectId || !closedProjectIds.has(task.linkedProjectId),
      ),
    [closedProjectIds, tasks],
  );
  const clearanceQueue = useReadyToCompleteTasks(clearanceCandidates, user?.id);

  const reviewCounts = useMemo(() => ({
    tasks: queue.length,
    clearance: clearanceQueue.items.length,
  }), [queue.length, clearanceQueue.items.length]);

  // Keep a valid selection in tasks tab.
  useEffect(() => {
    if (queue.length === 0) {
      setSelectedId(null);
    } else if (!selectedId || !queue.find((t) => t.id === selectedId)) {
      setSelectedId(queue[0].id);
    }
  }, [queue, selectedId]);

  const selected = queue.find((t) => t.id === selectedId) || null;

  useNotificationNavigationIntent(
    (intent) =>
      intent.kind === "task_review" ||
      intent.kind === "subtask_review" ||
      intent.kind === "budget" ||
      intent.kind === "project_approval" ||
      intent.kind === "project_completion_review",
    (intent) => {
      if (tasksLoading || projectsLoading) return false;
      if (intent.kind === "project_approval") {
        setProjectApprovalFocusId(intent.projectId);
        setCompletionReviewFocusId(undefined);
        return true;
      }
      if (intent.kind === "project_completion_review") {
        setCompletionReviewFocusId(intent.projectId);
        setProjectApprovalFocusId(undefined);
        return true;
      }
      if (intent.kind === "budget" && canReviewBudget) {
        setCashReviewFocus(null);
        setBudgetFocus(intent);
        setReviewKind("budget");
      } else if (intent.kind === "subtask_review") {
        setSubtaskFocus(intent);
        setReviewKind("subtasks");
        // The Subitem queue owns fresh target resolution and completion.
        return false;
      } else {
        setReviewKind("tasks");
        const match = queue.find((task) => task.id === intent.taskId);
        if (match) setSelectedId(match.id);
      }
      return true;
    },
    [canReviewBudget, projectsLoading, queue, tasksLoading],
  );

  const canReviewSelected = Boolean(
    selected &&
      canVerifyTasks &&
      canUserReviewTask(selected, user?.id, userProfile?.role),
  );

  useEffect(() => {
    if (!selected) { setProgress([]); return; }
    fetchProgressUpdates(selected.id).then(setProgress);
  }, [selected?.id]);

  const latestProgress = progress[0];
  const {
    evidence: subtaskEvidence,
    loading: subtaskEvidenceLoading,
    error: subtaskEvidenceError,
  } = useTaskReviewEvidence(selected?.id);

  return (
    <div className="eflow-operational-workspace eflow-review-workspace min-h-full min-w-0">
      <PageHeader
        eyebrow={
          scope === "leading"
            ? "Leader Workspace · Reviews"
            : includeAllAccessibleWork
              ? "Administration · Reviews"
              : `${getHeadWorkspaceLabel(userProfile?.role)} · Reviews`
        }
        title="For Review"
        subtitle="Review submitted project tasks and financial approvals in one queue."
        actions={reviewKind === 'tasks' ? (
                <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-[var(--eflow-warning-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--eflow-warning-text)]">
                  <Inbox size={14} /> {tasksLoading || projectsLoading ? '…' : queue.length} {query.trim() ? 'matching submissions' : 'awaiting review'}
                </div>
        ) : reviewKind === 'clearance' ? (
                <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 size={14} /> {clearanceQueue.loading && clearanceQueue.items.length === 0 ? '…' : clearanceQueue.readyCount} ready to complete
                </div>
        ) : undefined}
      />

      {scope === "department" && userProfile?.role === "head" && userProfile.org_id && (
        <>
          <PendingProjectApprovalsQueue
            orgId={userProfile.org_id}
            projects={projects}
            focusProjectId={projectApprovalFocusId}
          />
          <ProjectCompletionReviewQueue
            orgId={userProfile.org_id}
            projects={projects}
            focusProjectId={completionReviewFocusId}
          />
        </>
      )}

      <div className="mb-4 min-w-0">
        <ReviewKindSwitch active={reviewKind} includeBudget={canReviewBudget} counts={reviewCounts} onChange={setReviewKind} />
      </div>

      {/* Review Category Content */}
      {reviewKind === "budget" && canReviewBudget && (
        <BudgetReviewInbox
          key={`${cashReviewFocus?.orgId || "default"}:${cashReviewFocus?.fiscalYear || "current"}`}
          embedded
          focus={budgetFocus}
          cashReviewFocus={cashReviewFocus}
          scope={scope}
        />
      )}

      {reviewKind === "tasks" && (
        <>
          {tasksLoading || projectsLoading ? (
            <TaskReviewsSplitSkeleton />
          ) : queue.length === 0 && !query ? (
            <div className="rounded-[10px] border border-border bg-card shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
              <SectionEmpty
                fill
                illustration="complete"
                icon={<CheckCircle2 size={36} className="text-[var(--eflow-positive-text)]" />}
                title={scope === "leading" ? "No task reviews waiting" : "No task submissions awaiting review"}
                description={
                  scope === "leading"
                    ? "Task completion submissions from work you lead will appear here when ready for review."
                    : "Submitted project tasks waiting for review will appear here. Other review tabs remain available above."
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,380px)_1fr] gap-4">
              {/* Queue */}
              <div className="flex flex-col overflow-hidden rounded-[10px] border border-border bg-card shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
                <div className="flex flex-col gap-2 border-b border-border bg-muted/40 px-4 py-3">
                  <VibeSearch value={query} onChange={setQuery} onClear={() => setQuery("")} placeholder="Search submissions…" inputAriaLabel="Search review submissions" showClearIcon size="small" className="eflow-review-search w-full" />
                  <Dropdown
                    aria-label="Sort review submissions"
                    className="w-full"
                    clearable={false}
                    value={reviewSortOptions.find((option) => option.value === sort)}
                    onChange={(option) => setSort(String(option.value))}
                    options={reviewSortOptions}
                    size="small"
                  />
                </div>
                <div className="divide-y divide-border overflow-y-auto max-h-[calc(100vh-260px)]">
                  {queue.length === 0 ? (
                    <div className="py-10 text-center text-xs text-muted-foreground">No matches for “{query}”.</div>
                  ) : (
                    queue.map((t) => {
                      const isSel = t.id === selectedId;
                      const submittedAt = t.latestSubmission?.submittedAt || t.updatedAt;
                      const projectTitle = projects.find((project) => project.id === t.linkedProjectId)?.title || t.projectTitle;
                      return (
                        <button
                          key={t.id}
                          aria-current={isSel ? "true" : undefined}
                          onClick={() => setSelectedId(t.id)}
                          className={`flex w-full cursor-pointer gap-3 p-3.5 text-left transition-colors ${isSel ? "bg-primary/5" : "hover:bg-muted/60"}`}
                        >
                          <InitialsAvatar name={t.assigneeName} size={32} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground break-words flex-1">
                                {t.title}
                              </span>
                              <PriorityPill priority={t.priority} />
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {t.assigneeName || "Unassigned"}{t.teamMemberNames && t.teamMemberNames.length > 1 ? ` + ${t.teamMemberNames.length - 1}` : ""}
                              {projectTitle ? ` · ${projectTitle}` : ""}
                            </div>
                            <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground mt-1">
                              <Clock size={10} /> {timeAgo(submittedAt)}
                              {t.rejectionNote && (
                                <span className="ml-1 text-rose-500 font-semibold">· resubmitted</span>
                              )}
                            </div>
                          </div>
                          <ChevronRight size={14} className={`self-center shrink-0 ${isSel ? "text-primary" : "text-neutral-300"}`} />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Detail */}
              <div className="min-w-0">
                {selected ? (
                  <div className="space-y-4">
                    <div className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <h2 className="text-base font-bold text-foreground">{selected.title}</h2>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1"><InitialsAvatar name={selected.assigneeName} size={18} /> {selected.teamMemberNames && selected.teamMemberNames.length > 0 ? selected.teamMemberNames.join(", ") : selected.assigneeName || "Unassigned"}</span>
                            {selected.teamName && <span className="flex items-center gap-1"><Building2 size={12} /> {selected.teamName}</span>}
                            {(projects.find((project) => project.id === selected.linkedProjectId)?.title || selected.projectTitle) && (
                              <span className="flex items-center gap-1"><Layers size={12} /> {projects.find((project) => project.id === selected.linkedProjectId)?.title || selected.projectTitle}</span>
                            )}
                            <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(selected.latestSubmission?.submittedAt || selected.updatedAt)}</span>
                          </div>
                        </div>
                        <PriorityPill priority={selected.priority} />
                      </div>

                      {selected.description && (
                        <div className="text-xs text-muted-foreground mb-3 whitespace-pre-wrap leading-relaxed">
                          {selected.description}
                        </div>
                      )}

                      {latestProgress && (
                        <div className="mb-3 rounded-[14px] border border-border bg-[var(--eflow-info-bg)] p-3">
                          <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--eflow-info-text)] mb-1">
                            <Gauge size={12} /> Latest update
                          </div>
                          {latestProgress.nextStep && (
                            <div className="text-xs text-foreground"><b className="font-semibold">Next:</b> {latestProgress.nextStep}</div>
                          )}
                          {latestProgress.note && (
                            <div className="text-xs text-muted-foreground mt-0.5">{latestProgress.note}</div>
                          )}
                        </div>
                      )}

                    </div>

                    <details className="work-secondary"><summary>Approved subtask evidence</summary><TaskSubtaskEvidenceSection
                      task={selected}
                      evidence={subtaskEvidence}
                      loading={subtaskEvidenceLoading}
                      error={subtaskEvidenceError}
                    /></details>

                    <div className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
                      <div className="mb-3 flex items-start gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--eflow-positive-bg)] text-[var(--eflow-positive-text)]">
                          <ClipboardCheck size={16} />
                        </span>
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wide text-foreground">Final task submission</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">Review the completion note, parent-task attachments, and all previous attempts.</div>
                        </div>
                      </div>
                      <TaskReviewPanel
                        task={selected}
                        compact
                        canReview={canReviewSelected}
                        onOpenFinancialReview={canReviewBudget ? (focus) => {
                          setCashReviewFocus(focus);
                          setBudgetFocus(null);
                          setReviewKind("budget");
                        } : undefined}
                        onDecided={id => setDecided(previous => ({
                          actor: user?.id, ids: new Set([...(previous.actor === user?.id ? previous.ids : []), id]),
                        }))}
                      />
                    </div>

                    <div className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
                      <div className="text-xs font-bold uppercase tracking-wide text-foreground mb-0.5">Complete task timeline</div>
                      <div className="mb-3 text-xs text-muted-foreground">Status changes and structured parent-task progress updates, newest first.</div>
                      <details className="work-secondary"><summary>View activity</summary><TaskActivityTimeline taskId={selected.id} /></details>
                    </div>

                  </div>
                ) : (
                  <div className="flex min-h-[320px] h-full items-center justify-center rounded-[10px] border border-border bg-card shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
                    <SectionEmpty illustration="files" icon={<Search size={26} />} title="Select a submission" description="Pick a task from the queue to review it." />
                  </div>
                )}
              </div>
            </div>
          )}

        </>
      )}

      {reviewKind === "clearance" && (
        <ReadyToCompleteInbox
          items={clearanceQueue.items}
          loading={clearanceQueue.loading}
          projectTitleFor={(projectId, fallback) =>
            projects.find((project) => project.id === projectId)?.title || fallback
          }
          onChanged={async () => {
            if (typeof notifyTaskListeners === "function") {
              await notifyTaskListeners();
            }
            await clearanceQueue.refresh();
          }}
        />
      )}

      {reviewKind === "subtasks" && (
        <SubtaskReviewInbox
          embedded
          focus={subtaskFocus}
          onShowTasks={() => setReviewKind("tasks")}
          onShowBudget={canReviewBudget ? () => setReviewKind("budget") : undefined}
        />
      )}
    </div>
  );
}

export function LeaderReviewInbox() {
  return <ForReviewInbox scope="leading" />;
}
