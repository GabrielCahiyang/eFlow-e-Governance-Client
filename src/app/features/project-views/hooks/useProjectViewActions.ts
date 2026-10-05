import { useState } from 'react';
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
  const userId = user?.id || userProfile?.id || '';
  const officeId = userProfile?.org_id || userProfile?.departmentId || '';
  const closed = ['completed', 'archived'].includes(project.status);
  const ownOffice = officeState.offices.find(o => o.office_id === officeId);
  const shared = officeState.offices.some(o => o.relationship_type !== 'lead');
  const officeAccess = ownOffice?.invitation_status === 'joined' && ownOffice.relationship_type !== 'observer';
  const selected = !!ownOffice && officeState.members.some(m => m.project_office_id === ownOffice.id && m.user_id === userId);
  const readOnly = closed || !!officeState.error || !userProfile || userProfile.is_active === false || userProfile.role === 'admin' || shared && (!officeAccess || userProfile.role !== 'head' && !selected && ownOffice?.relationship_type !== 'lead');
  const structuralEdit = !readOnly && isHeadWorkspaceRole(userProfile?.role) && (canManage && project.orgId === officeId || !!officeAccess);
  const canEditDates = (task: Task) => canEditProjectTask(task, structuralEdit, officeId);
  const canMove = (task: Task) => !projectBoardMoveError(task, 'in_progress', userId, canEditDates(task), readOnly) && task.status !== 'in_progress';
  const saveDates = async (task: Task, patch: WorkspaceTaskPatch) => {
    if (!canEditDates(task)) throw new Error('Only the responsible Office Head can change this task schedule.');
    await patchWorkspaceTask(task.id, patch);
  };
  const move = async (task: Task, status: TaskStatus) => {
    const error = projectBoardMoveError(task, status, userId, canEditDates(task), readOnly);
    if (error) throw new Error(error);
    if (task.status !== status) await updateTaskStatus(task.id, status);
  };
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setNotice('');
    try { await action(); } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not save this change.'); }
    finally { setBusy(false); }
  };
  return { notice, setNotice, busy, canEditDates, canMove, saveDates, move, run };
}
