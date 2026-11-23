import { useConfirmation } from '../../../components/ui/useConfirmation';
import { WorkspaceTooltip } from '../../../components/ui/workspace/WorkspaceTooltip';
import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import { requestNavigation } from '../../../shared/navigationGuard';
import { useStaffingReview } from '../hooks/useStaffingReview';
import { Button, Skeleton } from '@vibe/core';
import * as m from 'motion/react-m';
import { Modal } from '../../../components/ui/Modal';
import { type Task } from '../../tasks';
import { supportsNestedWork, WorkRootStaffingDialog, type WorkTreeController } from '../../nested-work';
import '../staffing.css';
export function StaffingDialog({task, projectLeadId, onClose, onAssigned, controller}: {task: Task; projectLeadId?: string; onClose: () => void; onAssigned?: () => void | Promise<void>; controller?: WorkTreeController}) {
  const state = useStaffingReview(task, onAssigned, onClose, projectLeadId);
  const { context, rows, loading, busy, error, progress, selected, setSelected, saved, assigning } = state;
  const confirmation = useConfirmation();
  const guard = useExplicitDraft('Staffing recommendation selection', !!selected && !saved && !state.appointment, assigning, () => setSelected(''));
  guard.pendingRef.current = assigning && state.pending.current;
  const close = () => void requestNavigation(onClose);
  const generate = state.generate;
  const supported = supportsNestedWork(task);
  const confirm = () => state.confirm(person => confirmation.confirm(supported
    ? {title:'Review recommended Task Lead?',description:`Review ${person} for “${task.title}”. AI is advisory; current profile and selected project membership are checked before opening the appointment editor.`,actionLabel:'Review appointment',impact:<p>The appointment editor shows current permissions, workers and descendant impact before you save. Responsible Office stays unchanged.</p>}
    : { title: 'Assign recommended owner?', description: `Assign ${person} as owner of “${task.title}”. AI is advisory; current Office and task eligibility are checked again before assignment.`, actionLabel: 'Assign owner', impact: <p>Responsible Office stays unchanged. The selected person joins this task’s team.</p> }));
  if (state.appointment) return <WorkRootStaffingDialog rootId={task.id} controller={controller} preselectedLeadId={state.appointment.leadId} projectLeadId={projectLeadId} onClose={state.cancelAppointment} onChanged={state.appointmentSaved}/>;

  const confirmDisabled = busy || loading || saved || !selected || !rows.some(row => row.userId === selected);
  const confirmDisabledReason = assigning
    ? 'Confirming selected owner…'
    : busy
      ? 'Generating recommendations…'
      : loading
        ? 'Loading eligible profiles…'
        : saved
          ? 'Owner already assigned.'
          : !rows.length
            ? 'Generate recommendations first, then select a candidate.'
            : !selected || !rows.some(row => row.userId === selected)
              ? 'Select a recommended candidate to confirm.'
              : '';

  const refreshDisabled = busy || loading || saved;
  const refreshDisabledReason = saved
    ? 'Owner already assigned.'
    : busy
      ? 'Generating recommendations…'
      : loading
        ? 'Refreshing eligible profiles…'
        : '';

  const generateDisabled = busy || !context?.candidates.length;
  const generateDisabledReason = busy
    ? 'Generating recommendations…'
    : !context?.candidates.length
      ? 'No confirmed eligible profiles are available in this office.'
      : '';

  return <Modal isOpen onClose={close} title="Recommend staff" width="max-w-5xl" preventClose={assigning} overlayClassName="p7-staff-dialog" bodyClassName="p7-staff-body" footer={<div className="p7-staff-footer"><p>Choose a recommendation, then confirm its owner. AI never assigns automatically.</p><Button kind="secondary" onClick={close} disabled={assigning}>Cancel</Button><WorkspaceTooltip content={confirmDisabledReason} disabled={!confirmDisabledReason}><span className="inline-flex"><Button disabled={confirmDisabled} onClick={()=>void confirm()}>Confirm owner</Button></span></WorkspaceTooltip></div>}>
    <div className="p7-staff">{confirmation.dialog}{saved && <p role="status">{supported?'Lead appointed.':'Owner assigned.'}</p>}<header><span className="p7-staff-eyebrow">Office Head decision</span><h2>{task.title}</h2><p>Recommendations compare confirmed professional profiles with task requirements and current Office workload.</p></header>
      {error&&<div className="p7-staff-error" role="alert">{error}<WorkspaceTooltip content={refreshDisabledReason} disabled={!refreshDisabledReason}><span className="inline-flex"><button type="button" className="eflow-text-button" disabled={refreshDisabled} onClick={()=>void state.refresh()}>Refresh eligible context</button></span></WorkspaceTooltip></div>}
      {loading?<div role="status" aria-label="Loading eligible profiles"><Skeleton type="rectangle" size="custom" height={320} fullWidth/></div>:context&&<>
        <div className="p7-staff-context"><strong>{context.candidates.length} eligible confirmed profiles</strong><details className="p7-staff-notes"><summary>Profile and workload notes</summary><p>{context.excludedUnconfirmed} profiles excluded until confirmed. Active task counts and availability require the Head’s judgment. Sensitive PDS fields are excluded.</p></details><WorkspaceTooltip content={generateDisabledReason} disabled={!generateDisabledReason}><span className="inline-flex"><Button disabled={generateDisabled} onClick={()=>void generate()}>{rows.length?'Refresh recommendations':'Generate recommendations'}</Button></span></WorkspaceTooltip></div>
        {progress&&<p role="status" className="p7-staff-progress">{progress} You can close this dialog while generation continues; no owners will be assigned.</p>}
        {!rows.length&&!busy&&<p className="p7-staff-empty">{context.candidates.length?'Generate recommendations to review skills and workload before choosing an owner.':'Ask team members to confirm their professional profiles, or select an owner manually in Main table.'}</p>}
        <div className="p7-staff-list">{rows.map((row,i)=>{const person=context.candidates.find(p=>p.id===row.userId);if(!person)return null;return <m.label key={row.userId} className={'p7-staff-card '+(selected===row.userId?'p7-staff-card--selected':'')} initial={{opacity:0,y:5}} animate={{opacity:1,y:0}}><div className="p7-staff-person"><input type="radio" name="staff-owner" value={row.userId} checked={selected===row.userId} disabled={busy} onChange={()=>setSelected(row.userId)}/><div><h3>{person.name}</h3><span>Recommendation {i+1} · advisory ranking</span></div></div><ul>{row.evidence.map((fact,j)=><li key={j}>{fact}</li>)}</ul><div className="p7-staff-workload"><span>{row.activeTasks} active tasks</span></div></m.label>;})}</div>
      </>}
    </div>
  </Modal>;
}
