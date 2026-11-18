import { Modal } from '../../../components/ui/Modal';
import { useAuth } from '../../../contexts/AuthContext';
import { requestNavigation } from '../../../shared/navigationGuard';
import { useWorkTree, type WorkTreeController } from '../../nested-work';
import type { Task } from '../../tasks';
import { useSubitemInspectorData } from '../hooks/useSubitemInspectorData';
import { selectSubitemInspectorCapabilities } from '../selectors/inspectorCapabilities';
import { SubitemEvidencePanel } from './SubitemEvidencePanel';
import { SubitemFilesPanel } from './SubitemFilesPanel';
import { SubitemFundingPanel } from './SubitemFundingPanel';
import { SubtaskLoadState } from './SubtaskLoadState';
import '../subitemActionModal.css';

export type SubitemActionSection = 'evidence' | 'funding' | 'files';

export interface SubitemActionModalProps {
  rootTask: Task;
  itemId: string;
  section: SubitemActionSection;
  controller?: WorkTreeController;
  readOnly?: boolean;
  executionBlocked?: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

const SECTION_LABELS: Record<SubitemActionSection, string> = {
  evidence: 'Evidence',
  funding: 'Funding',
  files: 'Files',
};

export function SubitemActionModal(props: SubitemActionModalProps) {
  const { user } = useAuth();
  const key = JSON.stringify([user?.id, props.rootTask.id, props.itemId, props.section]);
  return props.controller
    ? <SubitemActionModalContent key={key} {...props} controller={props.controller} />
    : <ConnectedSubitemActionModal key={key} {...props} />;
}

function ConnectedSubitemActionModal(props: SubitemActionModalProps) {
  const controller = useWorkTree(props.rootTask.id);
  return <SubitemActionModalContent {...props} controller={controller} />;
}

function SubitemActionModalContent(props: SubitemActionModalProps & { controller: WorkTreeController }) {
  const { user } = useAuth();
  const { section } = props;
  const data = useSubitemInspectorData(props.rootTask.id, props.itemId, props.controller);
  const { node, tree } = data;
  const close = () => void requestNavigation(props.onClose);

  const scopeMatches = tree?.root.project === props.rootTask.linkedProjectId &&
    (tree?.root.kind === 'personal' ? tree.root.office === null : tree?.root.office === props.rootTask.orgId);
  const scopeReadOnly = !!props.readOnly || !!props.rootTask.archivedAt || !!props.rootTask.proposedOfficeIdentityId ||
    ['completed', 'cancelled'].includes(props.rootTask.status) || !data.fresh || !scopeMatches;
  const loadError = data.error || (tree && !scopeMatches ? 'Subtask unavailable in this project or Office.' : '');
  const modalWidth = section === 'funding' ? 'max-w-3xl' : 'max-w-2xl';

  if (!node || !tree || !data.data || !scopeMatches) {
    return (
      <Modal
        isOpen
        onClose={close}
        title={data.loading && !loadError ? `Loading ${SECTION_LABELS[section].toLowerCase()}` : `${SECTION_LABELS[section]} unavailable`}
        width={modalWidth}
      >
        <SubtaskLoadState loading={data.loading && !loadError} error={loadError} onRetry={() => void data.reload()} onClose={close} />
      </Modal>
    );
  }

  const context = {
    actorId: user?.id || null,
    rootId: props.rootTask.id,
    projectId: tree.root.project,
    officeId: tree.root.office,
    kind: tree.root.kind,
    revision: tree.revision,
    readOnly: scopeReadOnly,
    executionBlocked: !!props.executionBlocked,
  };
  const current = {
    ...data.data.subtask,
    customStatusId: node.custom_status_id === undefined ? data.data.subtask.customStatusId : node.custom_status_id ?? undefined,
    title: node.title,
    parentSubtaskId: node.parent_subtask_id || undefined,
    leadId: node.lead_id || undefined,
    assignedToIds: node.assigned_to_ids,
    siblingOrder: node.sibling_order,
    dueDate: node.due_date || undefined,
    isStandalone: node.is_standalone,
    status: node.effective_status ?? node.status,
    isCompleted: node.status === 'completed',
    percentComplete: node.percent_complete,
    dependencyIds: node.dependency_ids ?? null,
  };
  const capabilities = selectSubitemInspectorCapabilities(tree, props.itemId, context);
  const fundingTask: Task = { ...props.rootTask, assigneeId: tree.root.lead || undefined, recommendationLeadId: undefined };
  const reload = async () => {
    await data.reload();
    props.onChanged?.();
  };

  return (
    <Modal
      isOpen
      onClose={close}
      title={`${SECTION_LABELS[section]} · ${node.title}`}
      description={props.rootTask.title}
      width={modalWidth}
      footer={(
        <div className="flex justify-end">
          <button type="button" onClick={close} className="subitem-action-btn">
            Close
          </button>
        </div>
      )}
    >
      {section === 'evidence' && (
        <SubitemEvidencePanel
          rootTask={props.rootTask}
          node={node}
          tree={tree}
          actorId={context.actorId}
          currentStatus={current.status}
          scopeReadOnly={scopeReadOnly}
          startPaused={!!props.executionBlocked || node.capabilities?.execute?.reason_code === 'project_on_hold'}
          pending={data.pending}
          submissions={data.data.submissions}
          progressUpdates={data.data.progressUpdates}
          onChanged={reload}
        />
      )}

      {section === 'funding' && (
        <SubitemFundingPanel
          isOffice={tree.root.kind === 'office'}
          task={fundingTask}
          subtask={current}
          subtaskId={props.itemId}
          canManage={capabilities.manageBudget}
          readOnly={capabilities.budgetReadOnly}
          authorityPending={data.pending}
        />
      )}

      {section === 'files' && (
        <SubitemFilesPanel
          rootTaskId={props.rootTask.id}
          subtaskId={props.itemId}
          projectId={tree.root.project}
          kind={tree.root.kind}
          people={tree.people}
        />
      )}
    </Modal>
  );
}
