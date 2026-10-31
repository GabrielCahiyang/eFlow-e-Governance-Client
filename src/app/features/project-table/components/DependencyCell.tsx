import { Link2,CheckCircle2,Clock } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../components/ui/popover";
import { Button } from "../../../components/ui/button";
import type { Task } from "../../tasks";
import type { WorkspaceTaskPatch } from "../types";
import { dependencyWouldCycle } from "../selectors";
import { usePlanningEditor } from "../hooks/usePlanningEditor";

export function DependencyCell({
  task,
  tasks,
  disabled,
  save,
}: {
  task: Task;
  tasks: Task[];
  disabled: boolean;
  save: (patch: WorkspaceTaskPatch) => Promise<void>;
}) {
  const editor = usePlanningEditor(
    () => [...(task.dependencyIds || [])].sort(),
    "Task dependencies: " + task.title,
  );
  const titles = (task.dependencyIds || []).map(
    (id) => tasks.find((item) => item.id === id)?.title || "Restricted task",
  );
  const pending=(task.dependencyIds||[]).filter(id=>tasks.find(item=>item.id===id)?.status!=='completed').length;
  return (
    <Popover open={editor.open} onOpenChange={editor.onOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="pt-dependencies"
          disabled={disabled}
          title={titles.join(", ")}
          aria-label={"Edit dependencies for " + task.title}
        >
          <Link2 size={14} />
          {titles.length ? pending?`Waiting for ${pending} task${pending===1?'':'s'}`:"Ready to start" : "No prerequisites"}
        </button>
      </PopoverTrigger>
      {editor.open && (
        <PopoverContent
          className="eflow-workspace-popover pt-planning-editor"
          aria-label={"Dependencies for " + task.title}
          align="start"
          onInteractOutside={(event) => {
            if (editor.pending) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (editor.pending) event.preventDefault();
          }}
        >
          <form
            className="pt-planning-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (disabled) return;
              void editor.submit(async (ids) => {
                if (dependencyWouldCycle(tasks, task.id, ids))
                  throw new Error("Dependencies cannot form a cycle.");
                await save({ dependency_ids: ids });
              }, "Dependencies saved.");
            }}
          >
            <strong>Depends on</strong>
            <p>
              This task can start only after EVERY selected task is completed and approved. Selecting two tasks means both must finish first. Cycles are blocked.
            </p>
            <div className="pt-dependency-options">
              {tasks
                .filter((item) => item.id !== task.id && !item.archivedAt && item.linkedProjectId===task.linkedProjectId)
                .map((item) => (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      checked={editor.draft.includes(item.id)}
                      disabled={disabled || editor.pending}
                      onChange={(event) =>
                        editor.setDraft(
                          (event.target.checked
                            ? [...editor.draft, item.id]
                            : editor.draft.filter((id) => id !== item.id)
                          ).sort(),
                        )
                      }
                    />
                    <span>{item.title}<small className="block text-xs text-muted-foreground">{item.status==='completed'?<><CheckCircle2 size={12}/>Completed and approved</>:<><Clock size={12}/>Waiting · {item.status.replace(/_/g,' ')}</>}</small></span>
                  </label>
                ))}
            </div>
            {editor.draft
              .filter((id) => !tasks.some((item) => item.id === id))
              .map((id) => (
                <label key={id}>
                  <input type="checkbox" checked disabled />
                  Restricted task retained
                </label>
              ))}
            {!tasks.some((item) => item.id !== task.id && !item.archivedAt) && (
              <p>Add another task first.</p>
            )}
            {editor.error && (
              <div role="alert" className="pf-error">Could not save dependencies: {editor.error} Correct the selection and retry.</div>
            )}
            {editor.notice && <p role="status">{editor.notice}</p>}
            <Button
              type="submit"
              pending={editor.pending}
              disabled={disabled || !editor.dirty}
            >
              Save dependencies
            </Button>
          </form>
        </PopoverContent>
      )}
    </Popover>
  );
}
