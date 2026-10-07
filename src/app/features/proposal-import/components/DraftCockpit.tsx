import { useMemo } from "react";
import {
  Check,
  ChevronRight,
  Clock,
  Layers,
  Loader2,
  Plus,
} from "lucide-react";
import type { Employee } from "../../../services/employeeService";
import type { EmployeeNotesMap } from "../../../services/employeeNotesService";
import type { DraftTask } from "./draftModel";
import { DraftTaskRow } from "./DraftTaskRow";

export function DraftCockpit({
  draftTasks,
  employees,
  employeeNotes,
  onUpdate,
  onDelete,
  onAdd,
  onOpenModal,
  onCommit,
  committing,
  autoSaveState,
  commitMessage,
  saveError,
  validationMessages = {},
  source = "ai",
  proposalTitle: proposalTitleOverride,
  fundingOrgId,
  onAddProgram,
  onAddProject,
  onAddActivity,
  onRenameProgram,
  onRenameProject,
  onUpdateActivity,
}: {
  draftTasks: DraftTask[];
  employees: Employee[];
  allEmployees?: Employee[];
  employeeNotes?: EmployeeNotesMap;
  onUpdate: (key: string, patch: Partial<DraftTask>) => void;
  onDelete: (key: string) => void;
  onAdd: (programIdx: number, projectIdx: number, activityIdx: number) => void;
  onOpenModal: (key: string) => void;
  onCommit: () => void;
  committing: boolean;
  autoSaveState?: "idle" | "saving" | "saved" | "error";
  commitMessage: string;
  saveError?: string;
  validationMessages?: Record<string, string>;
  source?: "ai" | "manual";
  proposalTitle?: string;
  fundingOrgId?: string;
  onAddProgram?: () => void;
  onAddProject?: (programIdx: number) => void;
  onAddActivity?: (programIdx: number, projectIdx: number) => void;
  onRenameProgram?: (programIdx: number, title: string) => void;
  onRenameProject?: (
    programIdx: number,
    projectIdx: number,
    title: string,
  ) => void;
  onUpdateActivity?: (
    programIdx: number,
    projectIdx: number,
    activityIdx: number,
    title: string,
    schedule: string,
  ) => void;
}) {
  type ActivityGroup = {
    title: string;
    schedule: string;
    ai: number;
    tasks: DraftTask[];
  };
  type ProjectGroup = {
    title: string;
    pj: number;
    activities: ActivityGroup[];
  };
  type ProgramGroup = {
    title: string;
    pi: number;
    projects: ProjectGroup[];
  };

  const grouped = useMemo(() => {
    const programs: ProgramGroup[] = [];
    draftTasks.forEach((dt) => {
      let program = programs.find((p) => p.pi === dt.programIdx);
      if (!program) {
        program = { title: dt.programTitle, pi: dt.programIdx, projects: [] };
        programs.push(program);
      }
      let project = program.projects.find((p) => p.pj === dt.projectIdx);
      if (!project) {
        project = {
          title: dt.projectTitle,
          pj: dt.projectIdx,
          activities: [],
        };
        program.projects.push(project);
      }
      let activity = project.activities.find((a) => a.ai === dt.activityIdx);
      if (!activity) {
        activity = {
          title: dt.activityTitle,
          schedule: dt.activitySchedule,
          ai: dt.activityIdx,
          tasks: [],
        };
        project.activities.push(activity);
      }
      activity.tasks.push(dt);
    });
    return programs;
  }, [draftTasks]);

  const enabledCount = draftTasks.filter((t) => t.enabled).length;
  const isManual = source === "manual";
  const proposalTitle =
    proposalTitleOverride || draftTasks[0]?.proposalTitle || "Untitled plan";
  const projectCount = grouped.reduce(
    (count, program) => count + program.projects.length,
    0,
  );
  const activityCount = grouped.reduce(
    (count, program) =>
      count + program.projects.reduce((total, project) => total + project.activities.length, 0),
    0,
  );
  const autosaveLabel =
    autoSaveState === "saving"
      ? "Saving draft…"
      : autoSaveState === "error"
        ? "Autosave needs attention"
        : autoSaveState === "saved" ? "Current draft saved" : "Draft not saved yet";
  const validationMessageFor = (tasks: DraftTask[], ...suffixes: string[]) =>
    tasks
      .flatMap((task) => suffixes.map((suffix) => validationMessages[`${task.key}-${suffix}`]))
      .find(Boolean);

  return (
    <div className="space-y-4">
      {/* Draft guidance and save actions */}
      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Layers size={19} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                {isManual ? "Manual work-plan draft" : "Imported work-plan draft"}
              </div>
              <h2 className="mt-1 text-[15px] font-semibold text-neutral-900">
                Build the delivery hierarchy
              </h2>
              <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-neutral-600">
                Name the Program, Project, and Activity, then add the tasks your team will deliver.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isManual && onAddProgram && (
              <button
                type="button"
                onClick={onAddProgram}
                disabled={committing}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-primary/25 bg-white px-3.5 text-[12px] font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Plus size={14} /> Add Program
              </button>
            )}
            <button
              data-testid="manual-plan-done-editing"
              type="button"
              onClick={onCommit}
              disabled={committing || enabledCount === 0}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-[12px] font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {committing ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Saving draft…
                </>
              ) : (
                <>
                  <Check size={14} /> Save work-plan draft
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-primary/15 pt-3 text-[11px] text-neutral-600">
          <span className="font-medium text-neutral-700">{isManual ? "Plan" : "Proposal"}: {proposalTitle}</span>
          <span>{grouped.length} {grouped.length === 1 ? "program" : "programs"} · {projectCount} {projectCount === 1 ? "project" : "projects"} · {activityCount} {activityCount === 1 ? "activity" : "activities"} · {draftTasks.length} {draftTasks.length === 1 ? "task" : "tasks"}</span>
          <span className={`inline-flex items-center gap-1.5 font-medium ${autoSaveState === "error" ? "text-destructive" : "text-primary"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${autoSaveState === "error" ? "bg-destructive" : "bg-primary"}`} />
            {autosaveLabel}
          </span>
          <span className="text-neutral-500">Saving this draft does not create operational work.</span>
        </div>

        {commitMessage && (
          <p role="status" className="mt-3 text-[11px] font-medium text-primary">
            {commitMessage}
          </p>
        )}
        {saveError && (
          <p role="alert" className="mt-3 text-[11px] font-medium text-destructive">
            {saveError}
          </p>
        )}
      </section>

      {/* Programs tree */}
      {grouped.map((program) => {
        const programTasks = program.projects.flatMap((project) =>
          project.activities.flatMap((activity) => activity.tasks),
        );
        const programError = validationMessageFor(programTasks, "program");

        return (
          <div
          key={program.pi}
          className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm"
        >
          {/* Program header and editable name */}
          <div className="flex items-center gap-3 bg-gradient-to-r from-primary to-primary/85 px-5 py-3.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10">
              <Layers size={14} className="text-primary-foreground" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary-foreground/75">
                Program
              </div>
              <div className="mt-0.5 text-[12px] font-medium text-primary-foreground">
                Organize related projects and activities
              </div>
            </div>
          </div>

          {isManual && onRenameProgram ? (
            <div className="flex flex-wrap items-end gap-3 border-b border-neutral-100 bg-white px-5 py-4">
              <label className="min-w-0 flex-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  Program name
                </span>
                <input
                  aria-label={`Program ${program.pi + 1} title`}
                  aria-describedby={programError ? `manual-program-${program.pi}-error` : undefined}
                  aria-invalid={Boolean(programError)}
                  value={program.title}
                  onChange={(event) =>
                    onRenameProgram(program.pi, event.target.value)
                  }
                  className={`mt-1.5 h-10 w-full rounded-lg border bg-input-background px-3 text-[13px] font-medium text-foreground outline-none transition-all placeholder:text-muted-foreground focus:ring-2 ${
                    programError
                      ? "border-destructive focus:border-destructive focus:ring-destructive/15"
                      : "border-input focus:border-ring focus:ring-ring/15"
                  }`}
                  placeholder={`Program ${program.pi + 1}`}
                />
                {programError && (
                  <span id={`manual-program-${program.pi}-error`} role="alert" className="mt-1.5 block text-[11px] font-medium text-destructive">
                    {programError}
                  </span>
                )}
              </label>
              {onAddProject && (
                <button
                  type="button"
                  onClick={() => onAddProject(program.pi)}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[12px] font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Plus size={13} /> Add Project
                </button>
              )}
            </div>
          ) : (
            <div className="border-b border-neutral-100 bg-white px-5 py-4 text-[13px] font-semibold text-neutral-800">
              {program.title}
            </div>
          )}

          <div className="divide-y divide-neutral-100">
            {program.projects.map((project) => {
              const projectTasks = project.activities.flatMap((activity) => activity.tasks);
              const projectError = validationMessageFor(projectTasks, "project");

              return (
                <div key={project.pj}>
                {/* Project name and child action */}
                <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 bg-neutral-50/80 px-5 py-3">
                  <ChevronRight size={14} className="shrink-0 text-primary" />
                  {isManual && onRenameProject ? (
                    <label className="min-w-[180px] flex-1">
                      <span className="sr-only">Project name</span>
                      <input
                        aria-label={`Project ${project.pj + 1} title`}
                        aria-describedby={projectError ? `manual-project-${program.pi}-${project.pj}-error` : undefined}
                        aria-invalid={Boolean(projectError)}
                        value={project.title}
                        onChange={(event) =>
                          onRenameProject(
                            program.pi,
                            project.pj,
                            event.target.value,
                          )
                        }
                        className={`h-9 w-full rounded-lg border bg-input-background px-3 text-[12px] font-medium text-foreground outline-none transition-all placeholder:text-muted-foreground focus:ring-2 ${
                          projectError
                            ? "border-destructive focus:border-destructive focus:ring-destructive/15"
                            : "border-input focus:border-ring focus:ring-ring/15"
                        }`}
                        placeholder="Name this project"
                      />
                      {projectError && (
                        <span id={`manual-project-${program.pi}-${project.pj}-error`} role="alert" className="mt-1.5 block text-[11px] font-medium text-destructive">
                          {projectError}
                        </span>
                      )}
                    </label>
                  ) : (
                    <div className="text-[12px] font-medium text-neutral-700">
                      {project.title}
                    </div>
                  )}
                  {isManual && onAddActivity && (
                    <button
                      type="button"
                      onClick={() => onAddActivity(program.pi, project.pj)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/20 bg-white px-3 text-[11px] font-semibold text-primary transition hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <Plus size={13} /> Add Activity
                    </button>
                  )}
                </div>

                {project.activities.map((activity) => {
                  const activityError = validationMessageFor(activity.tasks, "activity");

                  return (
                    <div key={activity.ai}>
                    {/* Activity name, schedule, and child action */}
                    <div className="flex flex-wrap items-center gap-2 bg-white px-6 py-3">
                      <div className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                      {isManual && onUpdateActivity ? (
                        <>
                          <label className="min-w-[180px] flex-1">
                            <span className="sr-only">Activity name</span>
                            <input
                              aria-label={`Activity ${activity.ai + 1} title`}
                              aria-describedby={activityError ? `manual-activity-${program.pi}-${project.pj}-${activity.ai}-error` : undefined}
                              aria-invalid={Boolean(activityError)}
                              value={activity.title}
                              onChange={(event) =>
                                onUpdateActivity(
                                  program.pi,
                                  project.pj,
                                  activity.ai,
                                  event.target.value,
                                  activity.schedule,
                                )
                              }
                              className={`h-9 w-full rounded-lg border bg-input-background px-3 text-[12px] font-medium text-foreground outline-none transition-all placeholder:text-muted-foreground focus:ring-2 ${
                                activityError
                                  ? "border-destructive focus:border-destructive focus:ring-destructive/15"
                                  : "border-input focus:border-ring focus:ring-ring/15"
                              }`}
                              placeholder="Name this activity"
                            />
                            {activityError && (
                              <span id={`manual-activity-${program.pi}-${project.pj}-${activity.ai}-error`} role="alert" className="mt-1.5 block text-[11px] font-medium text-destructive">
                                {activityError}
                              </span>
                            )}
                          </label>
                          <input
                            aria-label={`${activity.title || `Activity ${activity.ai + 1}`} target date`}
                            type="date"
                            value={activity.schedule}
                            onChange={(event) =>
                              onUpdateActivity(
                                program.pi,
                                project.pj,
                                activity.ai,
                                activity.title,
                                event.target.value,
                              )
                            }
                            className="h-9 w-[148px] rounded-lg border border-input bg-input-background px-3 text-[11px] text-foreground outline-none transition-all focus:border-ring focus:ring-2 focus:ring-ring/15"
                          />
                        </>
                      ) : (
                        <>
                          <div className="text-[11px] font-medium text-neutral-600">
                            {activity.title}
                          </div>
                          {activity.schedule && (
                            <span className="inline-flex items-center gap-1 ml-2 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                              <Clock size={9} />
                              {activity.schedule}
                            </span>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          onAdd(program.pi, project.pj, activity.ai)
                        }
                        className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 text-[11px] font-semibold text-primary transition hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <Plus size={13} />
                        Add Task
                      </button>
                    </div>

                    {/* Tasks list */}
                    <div className="divide-y divide-neutral-100">
                      {activity.tasks.map((dt) => (
                          <DraftTaskRow
                            fundingOrgId={fundingOrgId}
                          key={dt.key}
                          dt={dt}
                          employees={employees}
                          employeeNotes={employeeNotes}
                          onUpdate={onUpdate}
                          onDelete={onDelete}
                          onOpenModal={onOpenModal}
                          validationMessages={validationMessages}
                        />
                      ))}
                      {activity.tasks.length === 0 && (
                        <div className="text-[11px] text-neutral-400 text-center py-6 italic rounded-xl border border-dashed border-neutral-100 m-4">
                          No tasks inside this activity.
                        </div>
                      )}
                    </div>
                    </div>
                  );
                })}
                </div>
              );
            })}
          </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Assignment Modal Component ──────────────────────────────────
