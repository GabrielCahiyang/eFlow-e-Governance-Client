import { FeatureDialog } from "../../../components/ui/FeatureDialog";
import { requestNavigation } from "../../../shared/navigationGuard";
import { usePersonalProject } from "../hooks/usePersonalProject";
import { PersonalTaskList } from "./PersonalTaskList";
import "../workspaces.css";
export function PersonalWorkInspector({
  workspace,
  project,
  task,
  userId,
  onClose,
}: {
  workspace: string;
  project: string;
  task: string;
  userId: string;
  onClose: () => void;
}) {
  const detail = usePersonalProject(workspace, project, userId);
  return (
    <FeatureDialog
      title="Personal task details"
      onClose={() => void requestNavigation(onClose)}
      contentClassName="r10-personal-inspector"
    >
      <h2>Personal task details</h2>
      {detail.loading && <p role="status">Checking current project access…</p>}
      {detail.error && (
        <p role="alert">
          {detail.error}
          <button type="button" onClick={() => void detail.refresh()}>
            Retry personal task
          </button>
        </p>
      )}
      {detail.mutationError && <p role="alert">{detail.mutationError}</p>}
      {detail.saved && <p role="status">{detail.saved}</p>}
      {detail.data &&
        (detail.data.tasks.some((t) => t.id === task) ? (
          <PersonalTaskList
            data={{
              ...detail.data,
              tasks: detail.data.tasks.filter((t) => t.id === task),
            }}
            userId={userId}
            busy={detail.busy}
            run={detail.run}
          />
        ) : (
          <p role="status">
            This task is no longer available in the current project.
          </p>
        ))}
    </FeatureDialog>
  );
}
