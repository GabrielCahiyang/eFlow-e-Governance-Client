import { CalendarDays } from "lucide-react";
import { Label } from "@vibe/core";
import type { Organization } from "../../../types";
import type {
  CollaborationOrganizationSelection,
  CollaborationSnapshotTask,
} from "../types";
import { ResponsibilityEditor } from "./ResponsibilityEditor";
import { TaskDepartmentLabel, TaskDepartmentProvider } from "../../tasks";

export function CollaborationActivitySection({
  tasks,
  organizations,
  participating,
  editable,
  onPatchTask,
  onPatchActivity,
}: {
  tasks: CollaborationSnapshotTask[];
  organizations: Organization[];
  participating: CollaborationOrganizationSelection[];
  editable: boolean;
  onPatchTask: (key: string, patch: Partial<CollaborationSnapshotTask>) => void;
  onPatchActivity: (
    activityId: string,
    patch: Pick<
      CollaborationSnapshotTask,
      "activityPrimaryOrgId" | "activitySupportingOrgIds"
    >,
  ) => void;
}) {
  const activity = tasks[0];
  if (!activity) return null;

  return (
    <section className="border-t border-neutral-100 first:border-t-0">
      <div className="bg-neutral-50/70 p-4 border-b border-neutral-100">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-neutral-900">
            Activity: {activity.activityTitle}
          </div>
          <Label
            text={`${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
            color="primary"
          />
        </div>
        <ResponsibilityEditor
          task={activity}
          organizations={organizations}
          participating={participating}
          editable={editable}
          onPatchActivity={(patch) =>
            onPatchActivity(activity.activityId, patch)
          }
        />
      </div>

      <div className="divide-y divide-neutral-100 bg-white">
        {tasks.map((task) => (
          <div key={task.key} className="p-4 hover:bg-neutral-50/40 transition-colors">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-[240px] flex-1">
                {editable ? (
                  <input
                    value={task.title}
                    onChange={(event) =>
                      onPatchTask(task.key, { title: event.target.value })
                    }
                    className="eflow-control w-full font-semibold text-neutral-900"
                    placeholder="Task title"
                  />
                ) : (
                  <div className="text-sm font-semibold text-neutral-900">
                    {task.title}
                  </div>
                )}
                <TaskDepartmentProvider organizations={organizations}>
                  <TaskDepartmentLabel task={task} />
                </TaskDepartmentProvider>
                <p className="mt-1 text-xs text-neutral-500">Estimated task days: {task.estimatedHours ? task.estimatedHours / 8 : "Not set"} (8 hours/day)</p>
                {editable ? (
                  <textarea
                    value={task.description}
                    onChange={(event) =>
                      onPatchTask(task.key, { description: event.target.value })
                    }
                    rows={2}
                    placeholder="Task description and deliverables…"
                    className="eflow-control mt-2 w-full h-auto py-2 leading-relaxed"
                  />
                ) : (
                  <div className="mt-1 text-xs leading-relaxed text-neutral-600">
                    {task.description || "No task description recorded."}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                  <CalendarDays size={14} className="text-neutral-400" />
                  <span>Target:</span>
                  {editable ? (
                    <input
                      type="date"
                      value={task.deadline.slice(0, 10)}
                      onChange={(event) =>
                        onPatchTask(task.key, { deadline: event.target.value })
                      }
                      className="eflow-control h-8 text-xs py-0"
                    />
                  ) : (
                    <span className="font-medium text-neutral-800">
                      {task.deadline || "Unscheduled"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
