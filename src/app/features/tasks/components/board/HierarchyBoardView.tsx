import { useEffect, useMemo, useState } from "react";
import { CircleDotDashed, FolderKanban, ListTodo, ListTree } from "lucide-react";
import type { Employee } from "../../../../services/employeeService";
import type { Task } from "../../../../services/taskService";
import { fetchSubtasksForTasks, type Subtask } from "../../../../services/subtaskService";
import { getHierarchyDisplay, statusMeta } from "./model";
import type { MondayBoardProps } from "./model";
import { HierarchyTaskRow } from "./HierarchyTaskRow";

type ActivityNode = {
  key: string;
  title: string;
  kind: "Activity" | "Milestone";
  schedule?: string;
  tasks: Task[];
};
type ProjectNode = {
  key: string;
  title: string;
  sourcePath?: string;
  activities: ActivityNode[];
};

export function HierarchyBoardView({
  tasks,
  employees,
  role,
  onVerify,
  onExecute,
  onSubmitRequest,
  onOpenTaskEditor,
  onDeleteTaskRequest,
  onArchiveTaskRequest,
  onCancelTaskRequest,
  currentUserId,
  onUndoRequest,
}: {
  tasks: Task[];
  employees: Employee[];
  role: "depthead" | "employee";
  onVerify?: MondayBoardProps["onVerify"];
  onExecute?: MondayBoardProps["onExecute"];
  onSubmitRequest?: (task: Task) => void;
  onOpenTaskEditor?: (task: Task) => void;
  onDeleteTaskRequest?: (task: Task) => void;
  onArchiveTaskRequest?: (task: Task) => void;
  onCancelTaskRequest?: (task: Task) => void;
  currentUserId?: string;
  onUndoRequest?: (task: Task) => void;
}) {
  const [subtasksByTask, setSubtasksByTask] = useState<Record<string, Subtask[]>>({});
  const taskIds = useMemo(() => tasks.map((task) => task.id).sort(), [tasks]);
  const taskIdsKey = taskIds.join(",");
  const employeeById = useMemo(
    () => Object.fromEntries(employees.map((employee) => [employee.id, employee])) as Record<string, Employee>,
    [employees],
  );

  useEffect(() => {
    let active = true;
    void fetchSubtasksForTasks(taskIds)
      .then((subtasks) => {
        if (!active) return;
        const next: Record<string, Subtask[]> = {};
        for (const subtask of subtasks) (next[subtask.taskId] ||= []).push(subtask);
        setSubtasksByTask(next);
      })
      .catch(() => {
        if (active) setSubtasksByTask({});
      });
    return () => { active = false; };
  }, [taskIds, taskIdsKey]);

  const tree = useMemo(() => {
    const projects: ProjectNode[] = [];
    for (const task of tasks) {
      const hierarchy = getHierarchyDisplay(task);
      const projectKey = task.projectId || task.linkedProjectId || hierarchy.projectTitle;
      const activityKey = task.activityId || task.milestoneId || `${projectKey}|${hierarchy.activityTitle}`;
      let project = projects.find((item) => item.key === projectKey);
      if (!project) {
        project = {
          key: projectKey,
          title: hierarchy.projectTitle,
          sourcePath: [hierarchy.proposalTitle, hierarchy.programTitle].filter(Boolean).join(" · ") || undefined,
          activities: [],
        };
        projects.push(project);
      }
      let activity = project.activities.find((item) => item.key === activityKey);
      if (!activity) {
        activity = {
          key: activityKey,
          title: hierarchy.activityTitle,
          kind: task.milestoneId ? "Milestone" : "Activity",
          schedule: hierarchy.activitySchedule,
          tasks: [],
        };
        project.activities.push(activity);
      }
      activity.tasks.push(task);
    }
    return projects;
  }, [tasks]);

  if (tree.length === 0) {
    return <div className="rounded-[10px] border border-border bg-card p-5 text-center text-[12px] text-muted-foreground shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">No tasks yet in this board.</div>;
  }

  return (
    <div className="space-y-4" aria-label="Task work breakdown">
      <div className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ListTree size={15} /></span>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Work breakdown</h2>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">Project → activity or milestone → task → subtask. Proposal and program provenance stays available without obscuring operational work.</p>
          </div>
        </div>
      </div>

      {tree.map((project) => (
        <section key={project.key} className="overflow-hidden rounded-[10px] border border-border bg-card shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-primary/20 bg-primary px-5 py-3.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-300"><FolderKanban size={12} /> Project</div>
              <h3 className="mt-1 break-words text-[14px] font-semibold leading-snug text-white">{project.title}</h3>
              {project.sourcePath && <p className="mt-1 break-words text-[10px] leading-relaxed text-neutral-300">Source: {project.sourcePath}</p>}
            </div>
            <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] text-white">{project.activities.reduce((count, activity) => count + activity.tasks.length, 0)} tasks</span>
          </header>

          <div className="divide-y divide-neutral-100">
            {project.activities.map((activity) => (
              <div key={activity.key} className="p-3 sm:p-4">
                <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-primary/15 bg-primary/5 px-3 py-2">
                  <CircleDotDashed size={13} className="shrink-0 text-primary" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">{activity.kind}</span>
                  <span className="min-w-0 break-words text-[12px] font-semibold leading-snug text-foreground">{activity.title}</span>
                  {activity.schedule && <span className="ml-auto text-[10px] text-primary">{activity.schedule}</span>}
                </div>
                <div className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                  {activity.tasks.map((task) => {
                    const subtasks = subtasksByTask[task.id] || [];
                    return (
                      <div key={task.id}>
                        <div className="border-l-2 border-l-neutral-200">
                          <HierarchyTaskRow
                            task={task}
                            employeeById={employeeById}
                            role={role}
                            currentUserId={currentUserId}
                            onVerify={onVerify}
                            onExecute={onExecute}
                            onSubmitRequest={onSubmitRequest}
                            onOpenTaskEditor={onOpenTaskEditor}
                            onDeleteTaskRequest={onDeleteTaskRequest}
                            onArchiveTaskRequest={onArchiveTaskRequest}
                            onCancelTaskRequest={onCancelTaskRequest}
                            onUndoRequest={onUndoRequest}
                          />
                        </div>
                        {subtasks.length > 0 && <div className="ml-5 border-l border-dashed border-neutral-200 py-1.5 pl-3 sm:ml-7">{subtasks.map((subtask) => {
                          const meta = statusMeta[subtask.status];
                          return <div key={subtask.id} className="flex items-start gap-2 py-1.5"><ListTodo size={12} className="mt-0.5 shrink-0 text-neutral-400" /><div className="min-w-0"><p className="break-words text-[11px] font-medium leading-snug text-neutral-800">{subtask.title}</p><span className={`mt-1 inline-block rounded-full border px-1.5 py-0.5 text-[9px] ${meta.color}`}>{meta.label}</span></div></div>;
                        })}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
