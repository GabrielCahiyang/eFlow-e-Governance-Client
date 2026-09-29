// ─── ForReviewInbox ──────────────────────────────────────────────
// A dedicated review workspace, not a filtered Kanban column.
// Single inbox for all review work across eFlow:
// 1. Work Plan Reviews (incoming proposals & collaborative plans)
// 2. Project Task Reviews (submitted tasks & completion evidence)
// 3. Governance / Approval (formal approvals and governance commits)
// 4. Subtasks & Budget reviews

import { useEffect, useMemo, useState } from "react";
import { Dropdown, Search as VibeSearch, Skeleton } from "@vibe/core";
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
import { TaskActivityTimeline } from "../../../components/workflow/TaskActivityTimeline";
import { getHeadWorkspaceLabel } from "../../../shared/roles";
import { canOpenBudgetReviewWorkspace } from "../selectors";
import { BudgetReviewInbox, type CashReviewFocus } from "../../budget";
import { SubtaskReviewInbox } from "./SubtaskReviewInbox";
import { ReviewKindSwitch, type ReviewKind } from "./ReviewKindSwitch";
import { TaskReviewStandards } from "./TaskReviewStandards";
import { TaskSubtaskEvidenceSection } from "./TaskSubtaskEvidenceSection";
import { ReviewDecisionForm } from "./ReviewDecisionForm";
import { useTaskReviewEvidence } from "../hooks/useTaskReviewEvidence";
import { WorkPlanReviewInbox } from "./WorkPlanReviewInbox";
import { GovernanceReviewInbox } from "./GovernanceReviewInbox";
import { useCollaborationDrafts, isActiveCollaborationDraft } from "../../interdepartment-collaboration";
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

export type ReviewInboxScope = "department" | "leading";

export interface ForReviewInboxProps {
  scope?: ReviewInboxScope;
}

export function ForReviewInbox({ scope = "department" }: ForReviewInboxProps) {
  const { tasks, loading: tasksLoading } = useTasks();
  const { isSuperAdmin } = useScopedOrgIds();
  const { projects, loading: projectsLoading } = useProjectsData();
  const collaboration = useCollaborationDrafts();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("oldest");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate[]>([]);
  const [reviewKind, setReviewKindState] = useState<ReviewKind>(() => {
    if (typeof window !== "undefined") {
      const view = new URLSearchParams(window.location.search).get("view");
      if (["tasks", "subtasks", "budget", "workplans", "governance"].includes(view || "")) return view as ReviewKind;
    }
    return getInitialReviewWorkspaceKind(scope);
  });
  const [subtaskFocus, setSubtaskFocus] = useState<NotificationNavigationIntent | null>(null);
  const [budgetFocus, setBudgetFocus] = useState<NotificationNavigationIntent | null>(null);
  const [cashReviewFocus, setCashReviewFocus] = useState<CashReviewFocus | null>(null);

  const { user, userProfile } = useAuth();
  const canReviewBudget = canOpenBudgetReviewWorkspace(scope, userProfile?.role);

  const setReviewKind = (next: ReviewKind) => {
    setReviewKindState(next);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.pathname = "/reviews";
    url.searchParams.set("page", "For Review");
    url.searchParams.set("view", next);
    window.history.pushState({ page: "For Review", view: next }, "", `${url.pathname}?${url.searchParams.toString()}`);
  };

  useEffect(() => {
    const onPopState = () => {
      const view = new URLSearchParams(window.location.search).get("view");
      if (["tasks", "subtasks", "budget", "workplans", "governance"].includes(view || "")) {
        setReviewKindState(view as ReviewKind);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const currentOrgId = userProfile?.org_id || userProfile?.departmentId || "";
  const accessibleOrgIds = useMemo(
    () => new Set([currentOrgId, ...collaboration.membershipOrgIds].filter(Boolean)),
    [collaboration.membershipOrgIds, currentOrgId],
  );

  // Incoming Work Plan Reviews count
  const incomingWorkPlansCount = useMemo(() => {
    return collaboration.drafts
      .filter(isActiveCollaborationDraft)
      .filter(
        (draft) =>
          ["in_review", "changes_requested", "ready_to_commit"].includes(draft.status) &&
          draft.snapshot.organizations.some(
            (org) => org.participationRole !== "owner" && accessibleOrgIds.has(org.orgId),
          ),
      ).length;
  }, [accessibleOrgIds, collaboration.drafts]);

  // Governance decisions count
  const governanceReviewsCount = useMemo(() => {
    return collaboration.drafts
      .filter(isActiveCollaborationDraft)
      .filter(
        (draft) =>
          ["in_review", "ready_to_commit"].includes(draft.status) &&
          (isSuperAdmin ||
            draft.ownerOrgId === currentOrgId ||
            draft.snapshot.organizations.some(
              (item) => item.participationRole === "governance" && accessibleOrgIds.has(item.orgId),
            )),
      ).length;
  }, [accessibleOrgIds, collaboration.drafts, currentOrgId, isSuperAdmin]);

  const queue = useMemo(() => {
    let rows = tasks.filter(
      (task) => isTaskVisibleInReviewQueue(
        task,
        user?.id,
        userProfile?.role,
      ),
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
  ]);

  const reviewCounts = useMemo(() => ({
    workplans: incomingWorkPlansCount,
    tasks: queue.length,
    governance: governanceReviewsCount,
  }), [governanceReviewsCount, incomingWorkPlansCount, queue.length]);

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
      intent.kind === "collaboration",
    (intent) => {
      if (tasksLoading || projectsLoading) return false;
      if (intent.kind === "budget" && canReviewBudget) {
        setCashReviewFocus(null);
        setBudgetFocus(intent);
        setReviewKind("budget");
      } else if (intent.kind === "subtask_review") {
        setSubtaskFocus(intent);
        setReviewKind("subtasks");
      } else if (intent.kind === "collaboration") {
        setReviewKind("workplans");
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

  if (tasksLoading || projectsLoading) {
    return (
      <div className="space-y-4 p-8" aria-live="polite" role="status">
        <Skeleton type="text" width={220} />
        <Skeleton type="text" width={340} />
        <div className="grid gap-4 lg:grid-cols-[minmax(300px,380px)_1fr]">
          <Skeleton type="rectangle" size="custom" height={320} fullWidth />
          <Skeleton type="rectangle" size="custom" height={420} fullWidth />
        </div>
      </div>
    );
  }

  return (
    <div className="eflow-operational-workspace min-h-full p-4 sm:p-8">
      <PageHeader
        eyebrow={
          scope === "leading"
            ? "Leader Workspace · Reviews"
            : isSuperAdmin
              ? "Administration · Reviews"
              : `${getHeadWorkspaceLabel(userProfile?.role)} · Reviews`
        }
        title="For Review"
        subtitle="Validate submitted work, collaborate on proposals, and keep the pipeline moving."
        actions={
          <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:items-end">
            <ReviewKindSwitch
              active={reviewKind}
              includeBudget={canReviewBudget}
              counts={reviewCounts}
              onChange={setReviewKind}
            />
            <div className="flex min-h-7 justify-end">
              {reviewKind === "tasks" && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  <Inbox size={14} /> {queue.length} awaiting review
                </div>
              )}
            </div>
          </div>
        }
      />

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

      {reviewKind === "workplans" && <WorkPlanReviewInbox />}

      {reviewKind === "governance" && <GovernanceReviewInbox />}

      {reviewKind === "tasks" && (
        <>
          {queue.length === 0 && !query ? (
            <div className="rounded-[10px] border border-border bg-card shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
              <SectionEmpty
                icon={<CheckCircle2 size={36} className="text-emerald-500" />}
                title="Inbox zero"
                description="No submissions are waiting for review. Great job keeping up!"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,380px)_1fr] gap-4">
              {/* Queue */}
              <div className="flex flex-col overflow-hidden rounded-[10px] border border-border bg-card shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
                <div className="flex flex-col gap-2 border-b border-border bg-muted/40 px-5 py-3 sm:flex-row sm:items-center">
                  <VibeSearch value={query} onChange={setQuery} onClear={() => setQuery("")} placeholder="Search submissions…" inputAriaLabel="Search review submissions" showClearIcon size="small" className="flex-1" />
                  <Dropdown
                    aria-label="Sort review submissions"
                    className="w-full sm:w-[160px]"
                    clearable={false}
                    value={reviewSortOptions.find((option) => option.value === sort)}
                    onChange={(option) => setSort(String(option.value))}
                    options={reviewSortOptions}
                    size="small"
                  />
                </div>
                <div className="divide-y divide-neutral-100 overflow-y-auto max-h-[calc(100vh-260px)]">
                  {queue.length === 0 ? (
                    <div className="py-10 text-center text-xs text-neutral-400">No matches for “{query}”.</div>
                  ) : (
                    queue.map((t) => {
                      const isSel = t.id === selectedId;
                      const submittedAt = t.latestSubmission?.submittedAt || t.updatedAt;
                      const projectTitle = projects.find((project) => project.id === t.linkedProjectId)?.title || t.projectTitle;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setSelectedId(t.id)}
                          className={`flex w-full cursor-pointer gap-3 p-3.5 text-left transition-colors ${isSel ? "bg-primary/5" : "hover:bg-muted/60"}`}
                        >
                          <InitialsAvatar name={t.assigneeName} size={32} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-neutral-900 truncate flex-1">
                                {t.title}
                              </span>
                              <PriorityPill priority={t.priority} />
                            </div>
                            <div className="text-[11px] text-neutral-500 truncate mt-0.5">
                              {t.assigneeName || "Unassigned"}{t.teamMemberNames && t.teamMemberNames.length > 1 ? ` + ${t.teamMemberNames.length - 1}` : ""}
                              {projectTitle ? ` · ${projectTitle}` : ""}
                            </div>
                            <div className="flex items-center gap-1 text-[10.5px] text-neutral-400 mt-1">
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
                          <h2 className="text-base font-bold text-neutral-900">{selected.title}</h2>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-neutral-500 flex-wrap">
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
                        <div className="text-xs text-neutral-600 mb-3 whitespace-pre-wrap leading-relaxed">
                          {selected.description}
                        </div>
                      )}

                      {latestProgress && (
                        <div className="mb-3 rounded-[14px] border border-blue-100 bg-blue-50/50 p-3">
                          <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-blue-700 mb-1">
                            <Gauge size={12} /> Latest progress · {latestProgress.percentComplete ?? "—"}%
                          </div>
                          {latestProgress.nextStep && (
                            <div className="text-xs text-neutral-700"><b className="font-semibold">Next:</b> {latestProgress.nextStep}</div>
                          )}
                          {latestProgress.note && (
                            <div className="text-xs text-neutral-600 mt-0.5">{latestProgress.note}</div>
                          )}
                        </div>
                      )}

                    </div>

                    <TaskReviewStandards task={selected} tasks={tasks} />

                    <TaskSubtaskEvidenceSection
                      task={selected}
                      evidence={subtaskEvidence}
                      loading={subtaskEvidenceLoading}
                      error={subtaskEvidenceError}
                    />

                    <div className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
                      <div className="mb-3 flex items-start gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                          <ClipboardCheck size={16} />
                        </span>
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wide text-neutral-900">Final task submission</div>
                          <div className="mt-0.5 text-xs text-neutral-500">Review the completion note, parent-task attachments, and all previous attempts.</div>
                        </div>
                      </div>
                      <TaskReviewPanel
                        task={selected}
                        compact
                        canReview={canReviewSelected}
                        showDecision={false}
                        onDone={() => { /* realtime removes it from queue */ }}
                      />
                    </div>

                    <div className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
                      <div className="text-xs font-bold uppercase tracking-wide text-neutral-900 mb-0.5">Complete task timeline</div>
                      <div className="mb-3 text-xs text-neutral-500">Status changes and structured parent-task progress updates, newest first.</div>
                      <TaskActivityTimeline taskId={selected.id} />
                    </div>

                    {canReviewSelected && (
                      <div className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
                        <div className="mb-3">
                          <div className="text-xs font-bold uppercase tracking-wide text-neutral-900">Head review decision</div>
                          <div className="mt-0.5 text-xs text-neutral-500">Approve only after checking the completion standards, subtask execution records, evidence files, and final submission.</div>
                        </div>
                        <ReviewDecisionForm taskId={selected.id} onDone={() => { /* realtime removes it from queue */ }}
                          onOpenFinancialReview={canReviewBudget ? (focus) => {
                            setCashReviewFocus(focus);
                            setBudgetFocus(null);
                            setReviewKind("budget");
                          } : undefined}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex min-h-[320px] h-full items-center justify-center rounded-[10px] border border-border bg-card shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
                    <SectionEmpty icon={<Search size={26} />} title="Select a submission" description="Pick a task from the queue to review it." />
                  </div>
                )}
              </div>
            </div>
          )}

        </>
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
