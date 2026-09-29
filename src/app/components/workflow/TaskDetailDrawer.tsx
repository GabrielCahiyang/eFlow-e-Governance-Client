import { TaskDepartmentLabel } from "../../features/tasks";
// ─── TaskDetailDrawer ────────────────────────────────────────────
// Right slide-out task detail reused across Dept Head, Admin, and Employee
// surfaces. Tabs: Overview · Activity (immutable timeline) · Discussion ·
// Review (reviewers only). Which tabs/actions appear is driven by props so the
// same component serves every role.

import React, { useState } from "react";
import DOMPurify from "dompurify";
import { Button, IconButton, Tab, TabList, TabsContext } from "@vibe/core";
import { Close } from "@vibe/icons";
import { Info, Activity, MessageSquare, ClipboardCheck, Calendar, User, Building2, Layers, Pencil, UsersRound } from "lucide-react";
import { updateTaskStatus, type Task } from "../../services/taskService";
import { useAuth } from "../../contexts/AuthContext";
import { TaskStatusBadge, PriorityPill, InitialsAvatar, ProjectStatusBadge } from "./StatusBadges";
import { formatDate, relativeDays, ProgressBar } from "./primitives";
import { TaskActivityTimeline } from "./TaskActivityTimeline";
import { TaskDiscussion } from "./TaskDiscussion";
import { TaskReviewPanel } from "./TaskReviewPanel";
import { ProgressUpdateForm } from "./ProgressUpdateForm";
import { TaskSubtasksWidget } from "./TaskSubtasksWidget";
import { SubmitForReviewForm } from "./SubmitForReviewForm";
import { useTasks } from "../../hooks/useFirebaseData";
import { useProfiles, useProjectsData } from "../../hooks/useSupabaseData";
import { isTaskLead } from "../../services/taskSelectors";
import { resolveSubtaskManagementCapability, resolveTaskDetailCapabilities } from "../../features/tasks/components/taskDetailAccess";
import { TaskTeamEditorDialog } from "../../features/tasks/components/team/TaskTeamEditorDialog";
import { TaskTeamMemberList } from "../../features/tasks/components/team/TaskTeamMemberList";
import { getTaskTeamMemberIds } from "../../features/tasks/selectors/teamMembership";
import { useTaskSubtasks } from "../../features/subtasks/hooks/useTaskSubtasks";
import { WorkBudgetCard } from "../../features/budget";
import { InspectorPanel } from "../../shared/motion";

type Tab = "overview" | "activity" | "discussion" | "review";

export function TaskDetailDrawer({
  task,
  onClose,
  canReview = false,
  canPostProgress = false,
  canSubmitForReview = false,
  canDiscuss = true,
  readOnly = false,
  onChanged,
}: {
  task: Task | null;
  onClose: () => void;
  canReview?: boolean;
  canPostProgress?: boolean;
  canSubmitForReview?: boolean;
  canDiscuss?: boolean;
  readOnly?: boolean;
  onChanged?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [resuming, setResuming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [teamEditorOpen, setTeamEditorOpen] = useState(false);
  const { user, userProfile } = useAuth();
  const { tasks } = useTasks();
  const { projects } = useProjectsData();
  const { profiles } = useProfiles();
  const { subtasks: taskSubtasks } = useTaskSubtasks(task?.id);

  if (!task) return null;
  const capabilities = resolveTaskDetailCapabilities(readOnly, {
    canReview,
    canPostProgress,
    canSubmitForReview,
    canDiscuss,
  });
  const effectiveCanReview = capabilities.canReview && Boolean(user?.id);
  const dependencies = (task.dependencyIds || [])
    .map((id) => tasks.find((candidate) => candidate.id === id))
    .filter((dependency): dependency is Task => Boolean(dependency));
  const unresolvedDependencies = dependencies.filter(
    (dependency) => dependency.status !== "completed",
  );

  // Rework is now the first-class `changes_requested` state (plan §2.1).
  const rejected = task.status === "changes_requested";
  const currentUserIsLead = Boolean(user?.id && isTaskLead(task, user.id));
  const isOwnerOrLead = task.assigneeId === user?.id || currentUserIsLead;
  const canManageSubtasks = resolveSubtaskManagementCapability(readOnly, currentUserIsLead);
  const canManageTaskTeam = canManageSubtasks && !["for_review", "completed", "cancelled"].includes(task.status);

  // Task Leaders can start, resume, and submit parent work without posting
  // parent-level progress updates (those belong to individual subtasks).
  const canManageLifecycle = capabilities.canPostProgress || capabilities.canSubmitForReview;
  const canResume = rejected && canManageLifecycle && isOwnerOrLead;
  const canStart = canManageLifecycle && isOwnerOrLead && task.status === "todo";
  const canSubmit =
    canManageLifecycle && isOwnerOrLead && task.status === "in_progress";
  const handleStart = async () => {
    setStarting(true);
    try {
      await updateTaskStatus(
        task.id,
        "in_progress",
        user?.id
          ? { id: user.id, name: userProfile?.full_name || "" }
          : undefined,
      );
      onChanged?.();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't start this task.");
    } finally {
      setStarting(false);
    }
  };
  const handleResume = async () => {
    setResuming(true);
    try {
      await updateTaskStatus(
        task.id,
        "in_progress",
        user?.id ? { id: user.id, name: userProfile?.full_name || "" } : undefined,
      );
      onChanged?.();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't resume this task.");
    } finally {
      setResuming(false);
    }
  };
  const rel = relativeDays(task.deadline || task.dueDate);
  const percent = task.percentComplete ?? 0;
  const operationalProject = task.linkedProjectId
    ? projects.find((project) => project.id === task.linkedProjectId)
    : undefined;

  const tabs: { id: Tab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { id: "overview", label: "Overview", icon: <Info size={13} />, show: true },
    { id: "activity", label: "Activity", icon: <Activity size={13} />, show: true },
    { id: "discussion", label: "Discussion", icon: <MessageSquare size={13} />, show: true },
    { id: "review", label: "Review", icon: <ClipboardCheck size={13} />, show: effectiveCanReview && task.status === "for_review" },
  ];
  const visibleTabs = tabs.filter((item) => item.show);

  return (
    <>
      <InspectorPanel
        open={Boolean(task)}
        onClose={onClose}
        ariaLabel={`Task details: ${task.title}`}
        className="w-full font-sans sm:w-[520px]"
      >
        {/* Header */}
        <div className="p-4 border-b border-neutral-100">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <TaskStatusBadge status={task.status} rejected={rejected} />
                <PriorityPill priority={task.priority} />
              </div>
              <TaskDepartmentLabel task={task} />
              <h2 className="text-[16px] font-semibold text-neutral-900 leading-snug">
                {task.title}
              </h2>
            </div>
            <IconButton aria-label="Close task detail" icon={Close} kind="tertiary" size="small" onClick={onClose} />
          </div>

          {/* Tabs */}
          <TabsContext
            id={`task-detail-tabs-${task.id}`}
            activeTabId={Math.max(0, visibleTabs.findIndex((item) => item.id === tab))}
          ><TabList id={`task-detail-tab-list-${task.id}`}>
            {visibleTabs.map((t) => (
              <Tab
                key={t.id}
                id={`task-${task.id}-${t.id}`}
                active={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                <span>{t.label}</span>
              </Tab>
            ))}
          </TabList></TabsContext>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "overview" && (
            <div className="space-y-4">
              {readOnly && (
                <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                  <Info size={15} className="mt-0.5 shrink-0 text-blue-600" />
                  <div>
                    <div className="text-[11.5px] font-medium text-blue-900">Read-only oversight record</div>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-blue-700">Inspect delivery, evidence, discussion, and history here. Operational changes remain with the responsible organization.</p>
                  </div>
                </div>
              )}
              {task.description && (
                <div className="text-[13px] font-normal text-neutral-700 leading-relaxed whitespace-pre-wrap">
                  {task.description}
                </div>
              )}

              {task.status === "cancelled" && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Cancelled</div>
                  <div className="mt-0.5 text-[12.5px] text-neutral-700">
                    {task.cancellationReason || "No cancellation reason recorded."}
                  </div>
                </div>
              )}

              {(Boolean(task.acceptanceCriteria?.length) || task.definitionOfDone) && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Completion standard</div>
                  {task.acceptanceCriteria?.length ? (
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[12px] text-neutral-700">
                      {task.acceptanceCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}
                    </ul>
                  ) : null}
                  {task.definitionOfDone && (
                    <div className="mt-2 text-[11.5px] text-neutral-600">Done when: {task.definitionOfDone}</div>
                  )}
                </div>
              )}

              {dependencies.length > 0 && (
                <div className={`rounded-xl border p-3 ${unresolvedDependencies.length ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-600">
                    Dependencies · {dependencies.length - unresolvedDependencies.length}/{dependencies.length} complete
                  </div>
                  <div className="mt-1.5 space-y-1 text-[11.5px] text-neutral-700">
                    {dependencies.map((dependency) => (
                      <div key={dependency.id}>{dependency.status === "completed" ? "✓" : "○"} {dependency.title}</div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">Progress</span>
                  <span className="text-[12px] font-semibold text-neutral-900 tabular-nums">{percent}%</span>
                </div>
                <ProgressBar value={percent} tone={percent === 100 ? "good" : rel.overdue ? "bad" : "neutral"} />
              </div>

              <WorkBudgetCard task={task} canManage={canManageSubtasks} />

              {canStart && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <div className="text-[12px] font-medium text-blue-900">
                    This task is ready to begin.
                  </div>
                  <p className="mt-0.5 text-[11px] text-blue-700">
                    Starting it updates every board view to In Progress.
                  </p>
                  <Button
                    onClick={handleStart}
                    disabled={starting}
                    className="mt-2"
                    size="small"
                  >
                    {starting ? "Starting…" : "Start work"}
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field icon={<User size={13} />} label="Assignee" value={task.teamMemberNames && task.teamMemberNames.length > 0 ? task.teamMemberNames.join(", ") : task.assigneeName || "Unassigned"} />
                <Field icon={<Calendar size={13} />} label="Deadline" value={formatDate(task.deadline || task.dueDate)} hint={rel.label} hintTone={rel.overdue ? "bad" : undefined} />
                {task.teamName && <Field icon={<Building2 size={13} />} label="Team" value={task.teamName} />}
                {(operationalProject?.title || task.projectTitle) && (
                  <Field
                    icon={<Layers size={13} />}
                    label="Project"
                    value={operationalProject?.title || task.projectTitle || "—"}
                  />
                )}
                {task.programTitle && <Field icon={<Layers size={13} />} label="Program" value={task.programTitle} />}
              </div>

              <section className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500"><UsersRound size={12} /> Task members · {getTaskTeamMemberIds(task).length}</div>
                  {canManageTaskTeam && <button type="button" onClick={() => setTeamEditorOpen(true)} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[9.5px] font-medium text-neutral-600 hover:text-neutral-900"><Pencil size={10} /> Manage</button>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5"><TaskTeamMemberList task={task} profiles={profiles} /></div>
              </section>

              <div className="border-t border-neutral-100 pt-3">
                <TaskSubtasksWidget
                  taskId={task.id}
                  allowedAssignees={getTaskTeamMemberIds(task).map((id) => ({
                    id,
                    name: profiles.find((profile) => profile.id === id)?.full_name
                      || (task.teamMemberIds || []).map((memberId, index) => [memberId, task.teamMemberNames?.[index]] as const).find(([memberId]) => memberId === id)?.[1]
                      || (id === task.assigneeId ? task.assigneeName : undefined)
                      || "Team Member",
                  }))}
                  canManage={canManageSubtasks}
                  parentTask={task}
                  startParentOnCreate={currentUserIsLead}
                />
              </div>

              {rejected && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                  <div className="text-[11px] font-medium text-rose-700 uppercase tracking-wide mb-0.5">
                    Updates needed
                  </div>
                  {task.rejectionNote && (
                    <div className="text-[12.5px] font-normal text-rose-900">{task.rejectionNote}</div>
                  )}
                  {canResume && (
                    <Button
                      onClick={handleResume}
                      disabled={resuming}
                      className="mt-2"
                      size="small"
                    >
                      {resuming ? "Resuming…" : "Resume work"}
                    </Button>
                  )}
                </div>
              )}

              {task.latestSubmission && (
                <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <InitialsAvatar name={task.latestSubmission.submitterName} size={20} />
                    <span className="text-[12px] font-medium text-neutral-900">
                      {task.latestSubmission.submitterName}
                    </span>
                    <span className="text-[10.5px] text-neutral-400">submitted {formatDate(task.latestSubmission.submittedAt)}</span>
                  </div>
                  <div
                    className="text-[12px] font-normal text-neutral-600 whitespace-pre-wrap [&_p]:m-0 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-neutral-200 [&_td]:p-1.5 [&_ul]:pl-4 [&_ol]:pl-4"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(task.latestSubmission.note),
                    }}
                  />
                </div>
              )}

              {capabilities.canPostProgress && (
                <ProgressUpdateForm taskId={task.id} initialPercent={percent} onSaved={onChanged} />
              )}

              {canSubmit && (
                <SubmitForReviewForm
                  task={task}
                  subtasks={taskSubtasks}
                  onSubmitted={() => {
                    onChanged?.();
                    onClose();
                  }}
                />
              )}
            </div>
          )}

          {tab === "activity" && <TaskActivityTimeline taskId={task.id} />}
          {tab === "discussion" && <TaskDiscussion taskId={task.id} canParticipate={capabilities.canDiscuss} />}
          {tab === "review" && effectiveCanReview && (
            <TaskReviewPanel task={task} canReview={effectiveCanReview} onDone={() => { onChanged?.(); onClose(); }} />
          )}
        </div>
      </InspectorPanel>
      <TaskTeamEditorDialog
        task={teamEditorOpen ? task : null}
        profiles={profiles}
        subtasks={taskSubtasks}
        responsibleOrgId={task.orgId || operationalProject?.orgId}
        onClose={() => setTeamEditorOpen(false)}
      />
    </>
  );
}

function Field({
  icon,
  label,
  value,
  hint,
  hintTone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  hintTone?: "bad";
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-wider text-neutral-400 mb-0.5">
        {icon} {label}
      </div>
      <div className="text-[12.5px] font-medium text-neutral-900 truncate">{value}</div>
      {hint && (
        <div className={`text-[10.5px] font-normal ${hintTone === "bad" ? "text-red-600" : "text-neutral-400"}`}>
          {hint}
        </div>
      )}
    </div>
  );
}

export { ProjectStatusBadge };
