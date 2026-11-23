import { useWorkTree, type WorkTreeController } from '../../nested-work';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/button';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { requestNavigation } from '../../../shared/navigationGuard';
import type { Subtask } from '../../../services/subtaskService';
import type { Task } from '../../../services/taskService';
import type { TaskInspectorOrigin } from '../../task-inspector';
import { SubitemInspector, type SubitemInspectorProps } from './SubitemInspector';

export type SubtaskWorkDrawerProps = {
  subtask: Subtask | null;
  parentTask?: Task;
  prerequisite?: Subtask | null;
  readOnly?: boolean;
  canManageDeadline?: boolean;
  currentReviewerId?: string;
  onClose: () => void;
  controller?: WorkTreeController;
  origin?: TaskInspectorOrigin;
  executionBlocked?: boolean;
  onChanged?: () => void;
  initialSection?: 'work' | 'activity' | 'review';
  presentation?: SubitemInspectorProps['presentation'];
};

/**
 * Canonical subtask detail modal entrypoint.
 * Never falls back to a legacy right-side drawer; all subtask detail views use
 * the standard centered eFlow modal via SubitemInspector.
 */
export function SubtaskWorkDrawer(props: SubtaskWorkDrawerProps) {
  if (!props.subtask) return null;

  if (!props.parentTask) {
    const close = () => void requestNavigation(props.onClose);
    return (
      <Modal
        isOpen
        title={props.subtask.title || 'Subtask unavailable'}
        description="Parent task context could not be verified."
        width="max-w-md"
        onClose={close}
        footer={
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={close}>
              Close
            </Button>
          </div>
        }
      >
        <FeedbackState tone="warning" title="Open from the parent task">
          Subtask details require the parent task context. Open this subtask from its project or task view to manage work, reviews, and contributors.
        </FeedbackState>
      </Modal>
    );
  }

  return props.controller ? (
    <SupportedSubtaskWorkDrawer {...props} parentTask={props.parentTask} controller={props.controller} />
  ) : (
    <ConnectedSubtaskWorkDrawer key={props.parentTask.id} {...props} parentTask={props.parentTask} />
  );
}

function ConnectedSubtaskWorkDrawer(props: SubtaskWorkDrawerProps & { parentTask: Task }) {
  const controller = useWorkTree(props.parentTask.id);
  return <SupportedSubtaskWorkDrawer {...props} controller={controller} />;
}

function SupportedSubtaskWorkDrawer(
  props: SubtaskWorkDrawerProps & { parentTask: Task; controller: WorkTreeController },
) {
  return (
    <SubitemInspector
      rootTask={props.parentTask}
      itemId={props.subtask!.id}
      readOnly={props.readOnly}
      canManageDeadline={props.canManageDeadline}
      currentReviewerId={props.currentReviewerId}
      prerequisite={props.prerequisite}
      controller={props.controller}
      origin={props.origin}
      initialSection={props.initialSection}
      presentation={props.presentation || 'dialog'}
      executionBlocked={props.executionBlocked}
      onClose={props.onClose}
      onChanged={props.onChanged}
    />
  );
}
