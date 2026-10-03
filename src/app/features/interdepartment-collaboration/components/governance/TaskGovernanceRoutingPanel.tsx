import * as React from "react";
import { Save, ShieldCheck } from "lucide-react";
import type { Organization } from "../../../../types";
import type { Task } from "../../../tasks";
import type { CollaborationDraftSnapshot, CollaborationParticipant, TaskGovernanceMode } from "../../types";

export function TaskGovernanceRoutingPanel({ snapshot, participants, organizations, operationalTasks, editableDraft, canManagePublished, busy, onSaveDraft, onSetPublishedRoute }: {
  snapshot: CollaborationDraftSnapshot;
  participants: CollaborationParticipant[];
  organizations: Organization[];
  operationalTasks: Task[];
  editableDraft: boolean;
  canManagePublished: boolean;
  busy: boolean;
  onSaveDraft: (snapshot: CollaborationDraftSnapshot) => Promise<void>;
  onSetPublishedRoute: (taskId: string, mode: TaskGovernanceMode, organizationId?: string) => Promise<void>;
}) {
  const governance = participants.filter((item) => item.participationRole === "governance");
  const defaultGovernanceOrgId = governance[0]?.orgId;
  const [working, setWorking] = React.useState(snapshot);
  React.useEffect(() => setWorking(snapshot), [snapshot]);
  const updateTask = (key: string, mode: TaskGovernanceMode, orgId?: string) => setWorking((current) => ({ ...current, tasks: current.tasks.map((task) => task.key === key ? { ...task, governanceMode: mode, governanceOrgId: mode === "governance" ? orgId || defaultGovernanceOrgId : undefined } : task) }));
  const rows = editableDraft ? working.tasks.filter((item) => item.enabled) : operationalTasks;
  return <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-[13px] font-semibold"><ShieldCheck size={15} /> Task and activity governance routing</div><p className="mt-1 text-[10px] text-neutral-500">Choose ordinary office review, a specific governance organization, or governance only at final proposal closeout. This prevents every routine task from overwhelming the Board.</p></div>{editableDraft && <button type="button" disabled={busy} onClick={() => void onSaveDraft(working)} className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-[10px] text-white disabled:opacity-40"><Save size={12} /> Save routes</button>}</div>
    <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200"><div className="grid grid-cols-[minmax(180px,1fr)_190px_190px] gap-2 bg-neutral-50 px-3 py-2 text-[8.5px] uppercase tracking-wide text-neutral-400"><span>Task / activity</span><span>Approval route</span><span>Governance organization</span></div>{rows.map((row) => {
      const isSnapshot = "key" in row;
      const rowKey = isSnapshot ? row.key : row.id;
      const mode = isSnapshot ? (row.governanceMode || (governance.length ? "governance" : "department")) : (((row as Task & { governanceApprovalMode?: TaskGovernanceMode }).governanceApprovalMode) || ((row as Task).reviewRouteMode === "governance" ? "governance" : "department"));
      const orgId = isSnapshot ? row.governanceOrgId || defaultGovernanceOrgId : (row as Task & { governanceOrganizationId?: string }).governanceOrganizationId;
      const disabled = busy || (!isSnapshot && !canManagePublished) || (isSnapshot && !editableDraft);
      return <div key={rowKey} className="grid grid-cols-[minmax(180px,1fr)_190px_190px] items-center gap-2 border-t border-neutral-100 px-3 py-2.5"><div><div className="truncate text-[10px] font-medium text-neutral-800">{row.title}</div><div className="truncate text-[8.5px] text-neutral-400">{isSnapshot ? row.activityTitle : (row as Task).activityTitle || "Operational task"}</div></div><select disabled={disabled} value={mode} onChange={(event) => { const nextMode = event.target.value as TaskGovernanceMode; if (isSnapshot) updateTask(row.key, nextMode, orgId); else void onSetPublishedRoute(row.id, nextMode, orgId); }} className="h-8 rounded-lg border border-neutral-200 bg-white px-2 text-[9px] disabled:bg-neutral-50"><option value="department">Office approval</option><option value="governance" disabled={!governance.length}>Governance approval required</option><option value="closeout_only">Governance at final closeout</option></select><select disabled={disabled || mode !== "governance"} value={orgId || ""} onChange={(event) => { if (isSnapshot) updateTask(row.key, mode, event.target.value); else void onSetPublishedRoute(row.id, mode, event.target.value); }} className="h-8 rounded-lg border border-neutral-200 bg-white px-2 text-[9px] disabled:bg-neutral-50"><option value="">Select governance body…</option>{governance.map((participant) => <option key={participant.orgId} value={participant.orgId}>{organizations.find((item) => item.id === participant.orgId)?.name}</option>)}</select></div>;
    })}</div>
  </section>;
}
