import { useConfirmation } from '../../../components/ui/useConfirmation';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import { useRef, useState } from 'react';
import { patchWorkspaceTask, type WorkspaceTaskPatch } from '../../project-table';
import { updateTaskStatus, type Task, type TaskStatus } from '../../tasks';
import { useAuth } from '../../../contexts/AuthContext';
import { isHeadWorkspaceRole } from '../../../shared/roles';
import { canEditProjectTask, projectBoardMoveError } from '../selectors';
import { useProjectOfficeContext } from '../../project-offices';

export function useProjectViewActions(project: { orgId?: string; status: string }, canManage: boolean) {
  const { user, userProfile } = useAuth();
  const officeState = useProjectOfficeContext();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const schedulePending = useRef(false);
  const { confirm, dialog } = useConfirmation();
  useNavigationBlocker({ dirty: false, pending: busy, pendingCheck: () => inFlight.current || schedulePending.current, label: 'Project view change', onDiscard: () => {} });
  const userId = user?.id || userProfile?.id || '';
  const officeId = userProfile?.org_id || userProfile?.departmentId || '';
  const closed = ['completed', 'archived'].includes(project.status);
  const ownOffice = officeState.offices.find(o => o.office_id === officeId);
  const shared = officeState.offices.some(o => o.relationship_type !== 'lead');
  const officeAccess = ownOffice?.invitation_status === 'joined' && ownOffice.relationship_type !== 'observer';
  const selected = !!ownOffice && officeState.members.some(m => m.project_office_id === ownOffice.id && m.user_id === userId);
  const readOnly = closed || officeState.loading || !!officeState.error || !userProfile || userProfile.is_active === false || userProfile.role === 'admin' || shared && (!officeAccess || userProfile.role !== 'head' && !selected && ownOffice?.relationship_type !== 'lead');
  const structuralEdit = !readOnly && isHeadWorkspaceRole(userProfile?.role) && (canManage && project.orgId === officeId || !!officeAccess);
  const canEditDates = (task: Task) => canEditProjectTask(task, structuralEdit, officeId);
  const latestDateAccess = useRef(canEditDates); latestDateAccess.current = canEditDates;
  const canMove = (task: Task) => !projectBoardMoveError(task, 'in_progress', userId, canEditDates(task), readOnly) && task.status !== 'in_progress';
  const saveDates = async (task: Task, patch: WorkspaceTaskPatch) => {
    if (!canEditDates(task)) throw new Error('Only the responsible Office Head can change this task schedule.');
    if (schedulePending.current) throw new Error('A schedule change is already pending.');
    schedulePending.current = true;
    try {
      const oldEnd = task.deadline || task.dueDate || '';
      const changed = (patch.start_date ?? '') !== (task.startDate || '') || patch.deadline !== oldEnd;
      if (!changed) return;
      // The brief gives no numeric threshold. Every change to an established schedule gets Level 2 impact review.
      if ((task.startDate || oldEnd) && !await confirm({ title: 'Change task schedule?', description: `${task.title}: the updated dates appear in every project view. Dependent task dates are not moved automatically.`, actionLabel: 'Apply schedule', impact: `${task.startDate || 'No start'} → ${oldEnd || 'No due date'} becomes ${patch.start_date || 'No start'} → ${patch.deadline || 'No due date'}` })) throw new Error('Schedule change cancelled. Your dates remain unchanged.');
      if (!latestDateAccess.current(task)) throw new Error('Schedule editing access changed. Reopen this task.');
      await patchWorkspaceTask(task.id, patch);
    } finally { schedulePending.current = false; }

  };
  const move = async (task: Task, status: TaskStatus) => {
    const error = projectBoardMoveError(task, status, userId, canEditDates(task), readOnly);
    if (error) throw new Error(error);
    if (task.status !== status) await updateTaskStatus(task.id, status);
  };
  const run = async (action: () => Promise<void>) => {
    if (inFlight.current || schedulePending.current) return;
    inFlight.current = true;
    setBusy(true); setNotice('');
    try { await action(); } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not save this change.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return { notice, setNotice, busy, dialog, canEditDates, canMove, saveDates, move, run };
}
