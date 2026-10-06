import { Link2 } from "lucide-react";
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
          {titles.length ? titles.length + " linked" : "Add"}
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
              Dependencies affect delivery order. Select other project tasks;
              cycles are blocked.
            </p>
            <div className="pt-dependency-options">
              {tasks
                .filter((item) => item.id !== task.id && !item.archivedAt)
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
                    {item.title}
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
              <p role="alert">{editor.error} Retry with Save dependencies.</p>
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
