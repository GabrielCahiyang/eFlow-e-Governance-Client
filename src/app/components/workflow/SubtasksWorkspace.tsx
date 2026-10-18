// ─── SubtasksWorkspace ──────────────────────────────────────────────
// Dedicated Subtasks Workspace for viewing, filtering, and checking off
// subtasks assigned to the user across all department projects and tasks.

import { useState, useEffect, useMemo,useRef } from "react";
import { Dropdown, Search as VibeSearch } from "@vibe/core";
import {
  ListChecks,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  Eye,
  ShieldCheck,
  LockKeyhole,
  Unlink2,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useTasksData } from "../../hooks/useSupabaseData";
import { rowToSubtask, type Subtask } from "../../services/subtaskService";
import { SubtaskWorkDrawer } from "../../features/subtasks";
import type {TaskInspectorOrigin} from "../../features/task-inspector";
import { useNotificationNavigationIntent,resolveNotificationSubitem,fetchNotificationSubitem } from "../../features/notifications";
import {requestNavigation} from '../../shared/navigationGuard';
import type { Task } from "../../services/taskService";
import {
  PageHeader,
  StatCard,
  Card,
  SectionEmpty,
  LoadingState,
  formatDate,
} from "./primitives";
import { TaskStatusBadge, PriorityPill } from "./StatusBadges";
import { TaskDetailDrawer } from "../../features/task-inspector";
import {
  getSequentialStepNumber,
  getSubtaskPrerequisite,
} from "../../features/subtasks/selectors/sequencing";
import { getSubtaskDeadlineState } from "../../features/subtasks/selectors/deadlines";
import { useSubtaskReviewerDirectory } from "../../features/subtasks/hooks/useSubtaskReviewerDirectory";
import { SubtaskReviewerBadge } from "../../features/subtasks/components/SubtaskReviewerBadge";
import {
  buildLeaderTaskScopeOptions,
  getLeaderTaskScopeOption,
} from "../../features/tasks/selectors";

const subtaskStatusOptions = [
  { value: "all", label: "All Items" },
  { value: "pending", label: "Pending Only" },
  { value: "for_review", label: "For Review" },
  { value: "changes_requested", label: "Changes Requested" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Completed" },
];

export function SubtasksWorkspace() {
  const {user}=useAuth();
  return <ActorSubtasksWorkspace key={user?.id}/>;
}
function ActorSubtasksWorkspace() {
  const { user } = useAuth();
  const { tasks: allTasks, loading: tasksLoading } = useTasksData();
  const [subtasks, setSubtasks] = useState<(Subtask & { parentTask?: Task })[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [activeTaskDetail, setActiveTaskDetail] = useState<Task | null>(null);
  const [activeSubtask, setActiveSubtask] = useState<(Subtask & { parentTask?: Task }) | null>(null);
  const [focusError, setFocusError] = useState("");
  const [sourceError,setSourceError]=useState('');
  const [exactTarget,setExactTarget]=useState<string>();
  const exactCurrent=useRef<{rootId:string;itemId:string}|undefined>(undefined);
  const [subitemOrigin,setSubitemOrigin]=useState<TaskInspectorOrigin>();
  const captureOrigin=(element:HTMLElement|null)=>setSubitemOrigin({view:"Subtasks",section:'work',returnFocus:element,restoreFocus:()=>document.querySelector<HTMLInputElement>('[aria-label="Search subtasks"]')?.focus()});
  const reviewerIds = useMemo(() => subtasks.map((subtask) => subtask.reviewerId), [subtasks]);
  const { reviewersById, loading: reviewersLoading } = useSubtaskReviewerDirectory(reviewerIds);

  useNotificationNavigationIntent(
    (intent) => intent.kind === "subtask",
    async (intent,isCurrent) => {
      if (loading || tasksLoading) return false;
      let target=resolveNotificationSubitem(intent,sourceError?[]:subtasks);
      let exact=false;
      if(!sourceError&&target.status==='unavailable'&&intent.entityId&&intent.taskId){
        try{target={status:'resolved',item:await fetchNotificationSubitem(intent,user?.id||'',allTasks.find(task=>task.id===intent.taskId))};exact=true;}
        catch{/* A denied/missing exact read remains an unavailable target. */}
        if(!isCurrent())return false;
      }
      const opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
      return requestNavigation(()=>{
        if(!isCurrent())return;
        if(target.status==='resolved'&&target.item.parentTask){captureOrigin(opener);exactCurrent.current=exact?{rootId:target.item.taskId,itemId:target.item.id}:undefined;setExactTarget(exact?JSON.stringify([target.item.taskId,target.item.id]):undefined);setActiveSubtask(target.item);setFocusError('');}
        else {setActiveSubtask(null);setFocusError("The referenced subtask is unavailable or ambiguous. Choose a current assigned subtask below.");}
      });
    },
    [loading, tasksLoading, subtasks,sourceError,allTasks],
  );

  useEffect(() => {
    if (!user?.id) {setSubtasks([]);setLoading(false);return;}
    let active=true,sequence=0;

    const loadSubtasks = async () => {
      const run=++sequence;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("subtasks")
          .select("*")
          .order("task_id", { ascending: true })
          .order("position", { ascending: true });

        if (error) throw error;
        if(!Array.isArray(data))throw new Error('Could not verify current subtask access.');
        if(!active||run!==sequence)return;

        if (data) {
          // Filter subtasks where assigned_to_ids contains user.id or assigned_to === user.id
          const userSubtasks = data.filter((row: Record<string, unknown>) => {
            const ids = Array.isArray(row.assigned_to_ids)
              ? (row.assigned_to_ids as string[])
              : row.assigned_to
              ? [row.assigned_to as string]
              : [];
            return ids.includes(user.id)||row.lead_id===user.id;
          });

          // Map with parent task
          const taskMap = new Map(allTasks.map((t) => [t.id, t]));
          const mapped = userSubtasks.map((row: Record<string, unknown>) => {
            const rawIds = row.assigned_to_ids;
            const assignedToIds: string[] = Array.isArray(rawIds)
              ? (rawIds as string[])
              : row.assigned_to
              ? [row.assigned_to as string]
              : [];

            const st = rowToSubtask({ ...row, assigned_to_ids: assignedToIds });

            return {
              ...st,
              parentTask: taskMap.get(st.taskId),
            };
          });

          setSubtasks(mapped);
          setSourceError('');
          const exact=exactCurrent.current;
          if(exact&&!mapped.some(item=>item.taskId===exact.rootId&&item.id===exact.itemId)){
            try{
              const record=await fetchNotificationSubitem({notificationId:'current-subitem',kind:'subtask',taskId:exact.rootId,entityId:exact.itemId},user.id,taskMap.get(exact.rootId));
              if(active&&run===sequence)setActiveSubtask(current=>current?.id===exact.itemId&&current.taskId===exact.rootId?record:current);
            }catch{if(active&&run===sequence){exactCurrent.current=undefined;setExactTarget(undefined);}}
          }
        }
      } catch (err) {
        if(active&&run===sequence){setSubtasks([]);setSourceError(err instanceof Error?err.message:(err as {message?:string}|null)?.message||'Could not verify current subtask access.');}
      } finally {
        if(active&&run===sequence)setLoading(false);
      }
    };

    loadSubtasks();
    const poll=window.setInterval(loadSubtasks,15_000);
    window.addEventListener('focus',loadSubtasks);
    window.addEventListener('eflow-project-access-changed',loadSubtasks);

    // Subscribe to realtime subtasks updates
    const channel = supabase
      .channel(`user-subtasks-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subtasks" },
        () => loadSubtasks(),
      )
      .subscribe();

    return () => {
      active=false;++sequence;
      window.clearInterval(poll);window.removeEventListener('focus',loadSubtasks);window.removeEventListener('eflow-project-access-changed',loadSubtasks);
      supabase.removeChannel(channel);
    };
  }, [user?.id, allTasks]);

  const scopeOptions = useMemo(
    () => buildLeaderTaskScopeOptions(
      subtasks.flatMap((subtask) => subtask.parentTask ? [subtask.parentTask] : []),
    ),
    [subtasks],
  );

  useEffect(() => {
    if (!scopeOptions.some((option) => option.value === scopeFilter)) {
      setScopeFilter("all");
    }
  }, [scopeFilter, scopeOptions]);

  const filtered = useMemo(() => {
    let rows = subtasks;
    if (statusFilter === "pending") rows = rows.filter((st) => !st.isCompleted && st.status !== "for_review");
    else if (statusFilter === "for_review") rows = rows.filter((st) => st.status === "for_review");
    else if (statusFilter === "changes_requested") rows = rows.filter((st) => st.status === "changes_requested");
    else if (statusFilter === "completed") rows = rows.filter((st) => st.isCompleted);
    else if (statusFilter === "overdue") rows = rows.filter((st) => getSubtaskDeadlineState(st).tone === "overdue");
    if (scopeFilter !== "all") {
      rows = rows.filter(
        (subtask) => subtask.parentTask
          && getLeaderTaskScopeOption(subtask.parentTask).value === scopeFilter,
      );
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter(
        (st) =>
          st.title.toLowerCase().includes(q) ||
          (st.parentTask?.title || "").toLowerCase().includes(q) ||
          (st.parentTask?.programTitle || "").toLowerCase().includes(q) ||
          (st.parentTask?.projectTitle || "").toLowerCase().includes(q) ||
          (st.parentTask?.activityTitle || "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [subtasks, statusFilter, scopeFilter, query]);

  // Group subtasks by Parent Task
  const grouped = useMemo(() => {
    const map = new Map<string, { parentTask?: Task; subtasks: typeof filtered }>();
    filtered.forEach((st) => {
      const key = st.taskId;
      if (!map.has(key)) {
        map.set(key, { parentTask: st.parentTask, subtasks: [] });
      }
      map.get(key)!.subtasks.push(st);
    });
    return Array.from(map.values()).map((group) => ({
      ...group,
      subtasks: [...group.subtasks].sort((a, b) => a.position - b.position),
    }));
  }, [filtered]);

  const totalCount = subtasks.length;
  const completedCount = subtasks.filter((st) => st.isCompleted).length;
  const pendingCount = subtasks.filter(
    (st) => !st.isCompleted && st.status !== "for_review",
  ).length;
  const reviewCount = subtasks.filter((st) => st.status === "for_review").length;
  const overdueCount = subtasks.filter((st) => getSubtaskDeadlineState(st).tone === "overdue").length;

  if ((loading || tasksLoading)&&!activeSubtask&&!activeTaskDetail) {
    return (
      <div className="p-8">
        <LoadingState label="Loading your assigned subtasks…" />
      </div>
    );
  }

  return (
    <div className="eflow-operational-workspace min-h-full p-4 sm:p-8">
      <div hidden={!!activeSubtask||!!activeTaskDetail}>
      {focusError && <p role="alert" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">{focusError}</p>}
      {sourceError&&<p role="alert">{sourceError}</p>}
      <PageHeader
        eyebrow="My Workspace · Subtasks"
        title="My Subtask Checklist"
        subtitle="Open assigned work, report progress, attach evidence, and submit it to the assigned reviewer for approval."
      />

      <div className="mb-6 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Total Subtasks"
          value={totalCount}
          icon={<ListChecks size={15} />}
        />
        <StatCard
          label="Pending Items"
          value={pendingCount}
          tone={pendingCount > 0 ? "warn" : "neutral"}
          icon={<Clock size={15} />}
        />
        <StatCard
          label="Completed"
          value={completedCount}
          tone="good"
          icon={<CheckCircle2 size={15} />}
        />
        <StatCard
          label="For Review"
          value={reviewCount}
          tone={reviewCount > 0 ? "warn" : "neutral"}
          icon={<ShieldCheck size={15} />}
        />
        <StatCard
          label="Overdue"
          value={overdueCount}
          tone={overdueCount > 0 ? "bad" : "good"}
          icon={<AlertTriangle size={15} />}
          onClick={() => setStatusFilter(overdueCount > 0 ? "overdue" : "all")}
          active={statusFilter === "overdue"}
        />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <VibeSearch
          value={query}
          onChange={setQuery}
          onClear={() => setQuery("")}
          placeholder="Search subtasks or tasks…"
          inputAriaLabel="Search subtasks"
          showClearIcon
          size="small"
          className="w-full sm:w-[300px]"
        />
        <Dropdown
          aria-label="Filter subtasks by status"
          className="w-full sm:w-[190px]"
          clearable={false}
          value={subtaskStatusOptions.find((option) => option.value === statusFilter)}
          onChange={(option) => setStatusFilter(String(option.value))}
          options={subtaskStatusOptions}
          size="small"
        />
        <Dropdown
          aria-label="Filter subtasks by project and activity"
          className="w-full sm:w-[260px]"
          clearable={false}
          value={scopeOptions.find((option) => option.value === scopeFilter) || scopeOptions[0]}
          onChange={(option) => setScopeFilter(String(option.value))}
          options={scopeOptions}
          size="small"
        />
      </div>

      {/* Subtasks Grouped List */}
      {grouped.length === 0 ? (
        <Card bodyClassName="p-0">
          <SectionEmpty fill illustration="tasks"
            icon={<CheckCircle2 size={32} />}
            title="No subtasks found"
            description="You don't have any subtasks matching the current filter."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => {
            const parent = group.parentTask;

            return (
              <Card key={group.parentTask?.id || Math.random().toString()} bodyClassName="p-4">
                {/* Parent Task Header */}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-neutral-900 truncate">
                      {parent?.title || "Parent Task"}
                    </span>
                    {parent?.priority && <PriorityPill priority={parent.priority} />}
                    {parent?.status && <TaskStatusBadge status={parent.status} size="sm" />}
                  </div>

                  {parent && (
                    <button
                      onClick={() => setActiveTaskDetail(parent)}
                      className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 shrink-0"
                    >
                      View Task Details <ChevronRight size={12} />
                    </button>
                  )}
                </div>

                {/* Subtask items */}
                <div className="space-y-2">
                  {group.subtasks.map((st) => {
                    const prerequisite = getSubtaskPrerequisite(st, subtasks);
                    const stepNumber = getSequentialStepNumber(st, subtasks);
                    const deadlineState = getSubtaskDeadlineState(st);
                    return (
                    <button
                      type="button"
                      key={st.id}
                      onClick={event => {captureOrigin(event.currentTarget);exactCurrent.current=undefined;setExactTarget(undefined);setActiveSubtask(st);}}
                      className={`flex w-full min-w-0 flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors sm:flex-nowrap sm:gap-3 ${
                        st.isCompleted
                          ? "bg-neutral-50/70 border-neutral-100"
                          : prerequisite
                            ? "border-neutral-200 bg-neutral-100/80 hover:bg-neutral-100"
                          : "bg-white border-neutral-200 hover:border-neutral-300"
                      }`}
                    >
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        st.isCompleted
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : st.status === "for_review"
                            ? "border-amber-300 bg-amber-50 text-amber-600"
                            : "border-neutral-300 bg-white text-transparent"
                      }`}>
                        <CheckCircle2 size={13} />
                      </span>
                      <span
                        className={`min-w-0 basis-[calc(100%-2rem)] break-words text-[13px] font-normal sm:basis-auto sm:flex-1 ${
                          st.isCompleted
                            ? "text-neutral-400 line-through"
                            : "text-neutral-900"
                        }`}
                      >
                        {st.title}
                      </span>

                      <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wide ${
                        st.isStandalone
                          ? "border-violet-200 bg-violet-50 text-violet-700"
                          : "border-neutral-200 bg-neutral-50 text-neutral-500"
                      }`}>
                        {st.isStandalone ? <span className="inline-flex items-center gap-1"><Unlink2 size={9} /> Standalone</span> : `Step ${stepNumber}`}
                      </span>

                      {prerequisite && (
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-200 px-2 py-0.5 text-[9px] text-neutral-600"
                          title={`Complete “${prerequisite.title}” first`}
                        >
                          <LockKeyhole size={9} /> Step {getSequentialStepNumber(prerequisite, subtasks)} first
                        </span>
                      )}

                      {st.source === "ai_extracted" && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider text-violet-600 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                          <Sparkles size={9} /> AI Extracted
                        </span>
                      )}
                      {st.reviewerId && (
                        <SubtaskReviewerBadge
                          reviewer={reviewersById[st.reviewerId]}
                          status={st.status}
                          loading={reviewersLoading}
                          compact
                        />
                      )}
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium ${
                        deadlineState.tone === "overdue" ? "bg-red-50 text-red-700" :
                        deadlineState.tone === "due_soon" ? "bg-amber-50 text-amber-700" :
                        deadlineState.tone === "completed" ? "bg-emerald-50 text-emerald-700" :
                        deadlineState.tone === "none" ? "bg-neutral-100 text-neutral-500" : "bg-blue-50 text-blue-700"
                      }`} title={st.dueDate ? `Due ${formatDate(st.dueDate)}` : "Ask your Team Leader to assign a deadline"}>
                        <CalendarClock size={9} /> {st.dueDate ? `${formatDate(st.dueDate)} · ${deadlineState.label}` : deadlineState.label}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-medium ${
                        st.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                        st.status === "for_review" ? "bg-amber-50 text-amber-700" :
                        st.status === "changes_requested" ? "bg-rose-50 text-rose-700" :
                        st.status === "in_progress" ? "bg-blue-50 text-blue-700" : "bg-neutral-100 text-neutral-600"
                      }`}>{st.status.replace("_", " ")}</span>
                      <Eye size={14} className="shrink-0 text-neutral-400" />
                    </button>
                  );})}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      </div>{/* Task detail pages */}
      <TaskDetailDrawer presentation="page"
        task={activeTaskDetail}
        onClose={() => setActiveTaskDetail(null)}
        canPostProgress
        canDiscuss
        onChanged={() => {}}
      />
      <SubtaskWorkDrawer
        subtask={activeSubtask}
        origin={subitemOrigin}
        initialSection="work"
        readOnly={loading||tasksLoading||!!sourceError||(!subtasks.some(item=>item.id===activeSubtask?.id)&&exactTarget!==JSON.stringify([activeSubtask?.taskId,activeSubtask?.id]))}
        parentTask={activeSubtask?.parentTask}
        prerequisite={activeSubtask ? getSubtaskPrerequisite(activeSubtask, subtasks) : null}
        onClose={() => {exactCurrent.current=undefined;setExactTarget(undefined);setActiveSubtask(null);}}
      />
    </div>
  );
}
