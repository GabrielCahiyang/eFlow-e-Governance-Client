import { Modal } from "../../../../components/ui/Modal";
import { Button } from "../../../../components/ui/button";
import { FeedbackState } from "../../../../components/ui/FeedbackState";
import type { UserProfile } from "../../../../types";
import type { Subtask } from "../../../../services/subtaskService";
import type { Task } from "../../taskTypes";
import {
  supportsNestedWork,
  WorkRootStaffingDialog,
  type WorkTreeController,
} from "../../../nested-work";

interface TaskTeamEditorDialogProps {
  task: Task | null;
  profiles: UserProfile[];
  subtasks: Subtask[];
  responsibleOrgId?: string;
  onClose: () => void;
  readOnly?: boolean;
  controller?: WorkTreeController;
}

/**
 * Canonical task contributor editor.
 * Routes directly to the standard centered WorkRootStaffingDialog (with
 * workload & overload mitigation guardrails) instead of maintaining a legacy
 * unvalidated fallback modal.
 */
export function TaskTeamEditorDialog(props: TaskTeamEditorDialogProps) {
  if (!props.task) return null;
  const readOnly =
    !!props.readOnly ||
    !!props.task.archivedAt ||
    ["for_review", "completed", "cancelled"].includes(props.task.status);

  if (supportsNestedWork(props.task)) {
    return (
      <WorkRootStaffingDialog
        rootId={props.task.id}
        controller={props.controller}
        contributorsOnly
        readOnly={readOnly}
        onClose={props.onClose}
      />
    );
  }

  return (
    <Modal
      isOpen
      title="Task team & contributors"
      description={props.task.title}
      width="max-w-md"
      onClose={props.onClose}
      footer={
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={props.onClose}>
            Close
          </Button>
        </div>
      }
    >
      <FeedbackState tone="info" title="Managed through parent plan">
        This task is linked to an external collaboration or non-project scope. Manage its team and contributors from its governing work plan instead.
      </FeedbackState>
    </Modal>
  );
}
