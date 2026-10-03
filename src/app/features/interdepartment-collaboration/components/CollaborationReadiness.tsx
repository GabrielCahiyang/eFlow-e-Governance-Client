import { departmentApprovalRows } from "../selectors/departmentApprovalRows";
import { AlertTriangle, CheckCircle2, CircleDashed, LockKeyhole } from "lucide-react";
import type { Organization, UserProfile } from "../../../types";
import type { CollaborationApproval, CollaborationParticipant, CollaborationReadiness as Readiness } from "../types";

export function CollaborationReadiness({ participants, approvals, currentRevisionId, readiness, organizations, profiles = [], committed = false, departmentOnly = false }: {
  participants: CollaborationParticipant[];
  approvals: CollaborationApproval[];
  currentRevisionId?: string;
  readiness: Readiness | null;
  organizations: Organization[];
  profiles?: UserProfile[];
  committed?: boolean;
  departmentOnly?: boolean;
}) {
  const rows = departmentApprovalRows(participants, approvals, currentRevisionId);
  const reviewParticipants = participants.filter((participant) => participant.participationRole === "participant" || participant.participationRole === "governance");
  const latest = new Map<string, CollaborationApproval>();
  approvals.filter((approval) => approval.revisionId === currentRevisionId).sort((a, b) => b.createdAt - a.createdAt).forEach((approval) => {
    if (!latest.has(approval.organizationId)) latest.set(approval.organizationId, approval);
  });
  const externalApprovedCount = reviewParticipants.filter((participant) => latest.get(participant.orgId)?.decision === "approved").length;
  const externalPendingCount = Math.max(0, reviewParticipants.length - externalApprovedCount);
  const visibleBlockers = (readiness?.blockers || []).filter((blocker) => !/organization approval\(s\) pending/i.test(blocker));
  if (externalPendingCount > 0) visibleBlockers.unshift(`${externalPendingCount} office(s) still need to approve this plan.`);
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between"><div><div className="text-[12px] uppercase tracking-[0.18em] text-neutral-500">{committed ? "Governance record" : departmentOnly ? "Publication checks" : "Approval status"}</div><h3 className="mt-1 text-[16px] font-semibold text-neutral-900">{committed ? "Recorded approvals" : departmentOnly ? "Office proposal readiness" : "Office approvals"}</h3></div><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${committed || readiness?.ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{committed || readiness?.ready ? <CheckCircle2 size={17} /> : <LockKeyhole size={17} />}</div></div>
      {!departmentOnly && <div className="mt-4 space-y-2">{reviewParticipants.map((participant) => {
        const approval = latest.get(participant.orgId);
        const org = organizations.find((item) => item.id === participant.orgId);
        const approved = approval?.decision === "approved";
        return <div key={participant.orgId} className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2"><span className={approved ? "text-emerald-600" : approval ? "text-amber-600" : "text-neutral-300"}>{approved ? <CheckCircle2 size={14} /> : approval ? <AlertTriangle size={14} /> : <CircleDashed size={14} />}</span><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium text-neutral-800">{org?.name || "Organization"}</div><div className="text-[12px] capitalize text-neutral-500">{participant.participationRole === "governance" ? "Reviewing office" : "Participating office"} · Review order {participant.sequence} · {rows.find((row) => row.participant.orgId === participant.orgId)?.rule}</div>{approval && <div className="mt-0.5 text-[12px] text-neutral-500">{profiles.find((item) => item.id === approval.approvedBy)?.full_name || "Authorized approver"} · {new Date(approval.createdAt).toLocaleString()}{approval.reason ? ` · ${approval.reason}` : ""}</div>}</div><span className="text-[12px] capitalize text-neutral-500">{rows.find((row) => row.participant.orgId === participant.orgId)?.status || "Waiting for approval"}</span></div>;
      })}</div>}
      <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl border border-neutral-100 p-3"><div className="text-[18px] font-semibold text-neutral-900">{departmentOnly ? (readiness?.ready ? "Ready" : "Not ready") : `${externalApprovedCount}/${reviewParticipants.length}`}</div><div className="text-[12px] uppercase text-neutral-500">{departmentOnly ? "Office validation" : "Office approvals"}</div></div><div className="rounded-xl border border-neutral-100 p-3"><div className="text-[18px] font-semibold text-neutral-900">{readiness?.openChangeRequests || 0}</div><div className="text-[12px] uppercase text-neutral-500">Open changes</div></div></div>
      {!committed && visibleBlockers.length ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2"><div className="text-[12px] font-medium text-amber-900">{departmentOnly ? "Publication blocked" : "Approval requirements not complete"}</div>{visibleBlockers.map((blocker) => <div key={blocker} className="mt-1 text-[12px] text-amber-700">• {blocker}</div>)}</div> : null}
    </section>
  );
}
