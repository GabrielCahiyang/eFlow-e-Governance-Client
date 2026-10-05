import { useEffect, useState } from 'react';
import { Button, Skeleton } from '@vibe/core';
import * as m from 'motion/react-m';
import { Modal } from '../../../components/ui/Modal';
import { assignTask, type Task } from '../../tasks';
import { fetchStaffingContext, recommendStaff } from '../services/staffingService';
import type { StaffingContext, StaffRecommendation } from '../types';
import '../staffing.css';
export function StaffingDialog({task, onClose, onAssigned}: {task: Task; onClose: () => void; onAssigned?: () => void}) {
  const [context, setContext] = useState<StaffingContext | null>(null), [rows, setRows] = useState<StaffRecommendation[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [progress, setProgress] = useState('');
  const [selected, setSelected] = useState('');
  const [assigning, setAssigning] = useState(false);
  useEffect(()=>{let cancelled=false;void fetchStaffingContext(task.id).then(c=>{if(!cancelled)setContext(c);}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[task.id]);
  const generate = async () => {
    if (!context) return;
    setBusy(true);setError('');setRows([]);setSelected('');setProgress('Joining the AI queue…');
    try { setRows(await recommendStaff(context, update=>setProgress(update.progress?.message || (update.status==='queued'?`Queued · ${update.jobsAhead} ahead`:'Comparing confirmed professional profiles…')))); }
    catch(e){setError(e instanceof Error?e.message:'Staffing recommendations could not finish.');}
    finally {setBusy(false);setProgress('');}
  };
  const confirm = async () => {
    const person=context?.candidates.find(p=>p.id===selected);if(!person)return;
    setBusy(true);setAssigning(true);setError('');
    try {await assignTask(task.id,person.id,person.name,{teamId:task.teamId,teamName:task.teamName,teamMemberIds:Array.from(new Set([...(task.teamMemberIds||[]),person.id]))});onAssigned?.();onClose();}
    catch(e){setError(e instanceof Error?e.message:'Assignment could not finish. Refresh the task and retry.');}
    finally {setBusy(false);setAssigning(false);}
  };
  return <Modal isOpen onClose={onClose} title="Recommend staff" width="max-w5xl" preventClose={assigning} overlayClassName="p7-staff-dialog" bodyClassName="p7-staff-body" footer={<div className="p7-staff-footer"><p>Choose a recommendation, then confirm its owner. AI never assigns automatically.</p><Button kind="secondary" onClick={onClose} disabled={assigning}>Cancel</Button><Button disabled={busy||!selected} onClick={()=>void confirm()}>Confirm owner</Button></div>}>
    <div className="p7-staff"><header><span className="p7-staff-eyebrow">Office Head decision</span><h2>{task.title}</h2><p>Recommendations compare confirmed professional profiles with task requirements and current Office workload.</p></header>
      {error&&<div className="p7-staff-error" role="alert">{error}</div>}
      {loading?<div role="status" aria-label="Loading eligible profiles"><Skeleton type="rectangle" size="custom" height={320} fullWidth/></div>:context&&<>
        <div className="p7-staff-context"><strong>{context.candidates.length} eligible confirmed profiles</strong><details className="p7-staff-notes"><summary>Profile and workload notes</summary><p>{context.excludedUnconfirmed} profiles excluded until confirmed. Remaining hours are estimates; unknown effort and availability require the Head’s judgment. Sensitive PDS fields are excluded.</p></details><Button disabled={busy||!context.candidates.length} onClick={()=>void generate()}>{rows.length?'Refresh recommendations':'Generate recommendations'}</Button></div>
        {progress&&<p role="status" className="p7-staff-progress">{progress} You can close this dialog while generation continues; no owners will be assigned.</p>}
        {!rows.length&&!busy&&<p className="p7-staff-empty">{context.candidates.length?'Generate recommendations to review skills and workload before choosing an owner.':'Ask team members to confirm their professional profiles, or select an owner manually in Main table.'}</p>}
        <div className="p7-staff-list">{rows.map((row,i)=>{const person=context.candidates.find(p=>p.id===row.userId)!;return <m.label key={row.userId} className={'p7-staff-card '+(selected===row.userId?'p7-staff-card--selected':'')} initial={{opacity:0,y:5}} animate={{opacity:1,y:0}}><div className="p7-staff-person"><input type="radio" name="staff-owner" value={row.userId} checked={selected===row.userId} disabled={busy} onChange={()=>setSelected(row.userId)}/><div><h3>{person.name}</h3><span>Recommendation {i+1} · advisory ranking</span></div></div><ul>{row.evidence.map((fact,j)=><li key={j}>{fact}</li>)}</ul><div className="p7-staff-workload"><span>{row.activeTasks} active tasks</span><span>{row.remainingHours} known remaining hours</span><span>{row.unknownEffortTasks} tasks with unknown effort</span></div></m.label>;})}</div>
      </>}
    </div>
  </Modal>;
}
