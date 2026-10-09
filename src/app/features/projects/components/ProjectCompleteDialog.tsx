import { useRef, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { completeProject } from "../services/projectLifecycleService";
import type { Project } from '../services/types';
import { useProjectCompletionAvailability } from '../hooks/useProjectCompletionAvailability';
import { useAuth } from '../../../contexts/AuthContext';
import { ProjectReadinessPanel, type ReadinessDestination } from '../../project-readiness';
import { useGuardedProjectDialog } from '../hooks/useGuardedProjectDialog';
import { requestNavigation } from '../../../shared/navigationGuard';

export function ProjectCompleteDialog({ projectId, projectTitle, project, onClose, onSuccess, onOpenTask, onOpenGovernance, onResolve }: {
  projectId: string;
  projectTitle: string;
  onClose: () => void;
  onSuccess: () => void;
  onOpenTask: (taskId: string) => void;
  onOpenGovernance: (draftId: string) => void;
  project?: Project;
  onResolve?: (view: ReadinessDestination) => void;
}) {
  const { userProfile } = useAuth();
  const allowed = userProfile?.role === 'head' && userProfile.is_active !== false && (!project || Boolean(project.sourceCollaborationDraftId) || project.orgId === userProfile.org_id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const checks = useProjectCompletionAvailability(project || {id:projectId,status:'active',updatedAt:0},allowed,`${userProfile?.id}:${userProfile?.org_id}:${userProfile?.role}`);
  const { readiness, loading } = checks;
  const inFlight = useRef(false);
  const close = useGuardedProjectDialog({ dirty: Boolean(note.trim()), pending: busy, pendingCheck: () => inFlight.current, label: 'Project completion note', onClose, onDiscard: () => setNote('') });
  const confirm = async () => {
    if (!checks.enabled || error || inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError("");
    try { await completeProject(projectId, note); }
    catch (caught) {
      setError(caught instanceof Error ? caught.message : "Project could not be completed.");
      void checks.refresh();
      setBusy(false); inFlight.current = false;
      return;
    }
    onSuccess();
  };
  return <Modal isOpen onClose={() => { if (!inFlight.current) close(); }} title="Mark project complete" width="max-w-2xl" footer={
    <div className="flex w-full flex-wrap justify-end gap-2">
      <button type="button" onClick={close} disabled={busy} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Cancel</button>
      <button type="button" disabled={busy || !checks.enabled || Boolean(error)} aria-describedby="project-completion-reason" onClick={() => void confirm()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-40">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Confirm completion
      </button>
    </div>
  }>
    <div className="space-y-4">
      <p className="text-sm text-neutral-700">Complete <strong>{projectTitle}</strong>? This changes only this project—not other projects in the work plan. Archiving is a separate step.</p>
      <p id="project-completion-reason" role="status">{checks.reason}</p>
      {loading && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 size={15} className="animate-spin" /> Checking work, cash settlement, and required approvals…</p>}
      {(error || checks.error) && <p role="alert" className="whitespace-pre-line rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error || checks.error}</p>}
      {!loading && readiness && <>
        {checks.enabled ? <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">All completion checks passed. This project is ready to complete.</p> :
          <div className="space-y-3">
            <h4 className="font-semibold text-neutral-900">{readiness.status === "archived" ? "This project is already archived." : readiness.status === "completed" ? "This project is already completed." : `${readiness.blockers.length} item(s) still holding up completion`}</h4>
            {readiness.blockers.map((blocker) => <div key={`${blocker.kind}-${blocker.id}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <strong>{blocker.title}</strong><p className="mt-1 capitalize text-amber-800">{blocker.status.replace(/_/g, " ")}{blocker.amount !== undefined ? ` · ${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(blocker.amount)}` : ""}</p>
              <p className="mt-1 text-neutral-700">{blocker.detail}</p>
              {blocker.taskId && <button type="button" disabled={busy} onClick={() => { void requestNavigation(() => onOpenTask(blocker.taskId!)); }} className="mt-2 font-medium text-blue-700 underline">Open task</button>}
              {!blocker.taskId && blocker.kind === 'cash' && onResolve && <button type="button" disabled={busy} onClick={()=>{void requestNavigation(()=>onResolve('budget'));}} className="mt-2 font-medium text-blue-700 underline">Review financial settlement</button>}
              {blocker.kind === "governance" && (!project || project.sourceCollaborationDraftId === blocker.id) && <button type="button" disabled={busy} onClick={() => { void requestNavigation(() => onOpenGovernance(blocker.id)); }} className="mt-2 font-medium text-blue-700 underline">Open proposal closeout</button>}
            </div>)}
          </div>}
      </>}
      {allowed && <button type="button" disabled={busy || loading} onClick={() => { setError(""); void checks.refresh(); }} className="inline-flex items-center gap-1 text-sm text-blue-700 disabled:opacity-40"><RefreshCw size={13} /> Refresh checks</button>}
      {allowed && project && <ProjectReadinessPanel project={project} canManage={allowed} onUpdated={()=>{setError('');void checks.refresh();}} onResolve={onResolve ? view=>{void requestNavigation(()=>onResolve(view));} : undefined} />}
      <label className="block text-sm font-medium">Completion note (optional)<textarea value={note} onChange={(event) => setNote(event.target.value)} disabled={busy || !allowed} rows={2} maxLength={2000} className="mt-1 w-full rounded-lg border p-2 font-normal" /></label>
    </div>
  </Modal>;
}
