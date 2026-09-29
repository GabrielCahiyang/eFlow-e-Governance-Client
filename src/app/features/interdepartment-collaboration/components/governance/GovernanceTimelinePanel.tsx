import type { ReactNode } from "react";
import { CheckCircle2, FileCheck2, GitCommitHorizontal, MessageSquareWarning, Send, ShieldCheck } from "lucide-react";
import type { Organization, UserProfile } from "../../../../types";
import type { Task } from "../../../tasks";
import type { CollaborationApproval, CollaborationChangeRequest, CollaborationRevision, GovernanceRecord, GovernanceSignoff, ProposalCloseout, ProposalCloseoutDecision } from "../../types";

type TimelineItem = { id: string; at: number; title: string; detail: string; tone: "neutral" | "good" | "warn"; icon: ReactNode };

export function GovernanceTimelinePanel({ revisions, approvals, changes, signoffs, records, closeout, closeoutDecisions, tasks, organizations, profiles }: {
  revisions: CollaborationRevision[]; approvals: CollaborationApproval[]; changes: CollaborationChangeRequest[];
  signoffs: GovernanceSignoff[]; records: GovernanceRecord[]; closeout: ProposalCloseout | null;
  closeoutDecisions: ProposalCloseoutDecision[]; tasks: Task[]; organizations: Organization[]; profiles: UserProfile[];
}) {
  const orgName = (id: string) => organizations.find((item) => item.id === id)?.name || "Organization";
  const personName = (id?: string) => profiles.find((item) => item.id === id)?.full_name || "User";
  const items: TimelineItem[] = [
    ...revisions.map((item): TimelineItem => ({ id: `revision-${item.id}`, at: item.createdAt, title: `Revision ${item.revisionNumber} published`, detail: `${personName(item.createdBy)} · ${item.changeSummary}`, tone: "neutral", icon: <GitCommitHorizontal size={12} /> })),
    ...changes.map((item): TimelineItem => ({ id: `change-${item.id}`, at: item.createdAt, title: `Change request ${item.status}`, detail: `${orgName(item.requestingOrgId)} · ${item.reason}`, tone: item.status === "open" ? "warn" : "neutral", icon: <MessageSquareWarning size={12} /> })),
    ...signoffs.map((item): TimelineItem => ({ id: `signoff-${item.id}`, at: item.createdAt, title: `${item.decision.replace("_", " ")} approval`, detail: `${personName(item.userId)} for ${orgName(item.organizationId)}${item.reason ? ` · ${item.reason}` : ""}`, tone: item.decision === "approved" ? "good" : item.decision === "recused" ? "neutral" : "warn", icon: <ShieldCheck size={12} /> })),
    ...approvals.map((item): TimelineItem => ({ id: `approval-${item.id}`, at: item.createdAt, title: `${orgName(item.organizationId)} ${item.decision.replace("_", " ")}`, detail: `${personName(item.approvedBy)}${item.reason ? ` · ${item.reason}` : ""}`, tone: item.decision === "approved" ? "good" : "warn", icon: <CheckCircle2 size={12} /> })),
    ...records.map((item): TimelineItem => ({ id: `record-${item.id}`, at: item.updatedAt, title: `${orgName(item.organizationId)} formal record`, detail: [item.resolutionNumber && `Resolution ${item.resolutionNumber}`, item.meetingDate && `Meeting ${item.meetingDate}`, item.minutesFileName].filter(Boolean).join(" · ") || "Formal record updated", tone: "good", icon: <FileCheck2 size={12} /> })),
    ...closeoutDecisions.map((item): TimelineItem => ({ id: `closeout-${item.id}`, at: item.createdAt, title: `${orgName(item.organizationId)} closeout ${item.decision.replace("_", " ")}`, detail: `${personName(item.decidedBy)}${item.reason ? ` · ${item.reason}` : ""}`, tone: item.decision === "approved" ? "good" : "warn", icon: <ShieldCheck size={12} /> })),
    ...tasks.filter((task) => task.latestSubmission).map((task): TimelineItem => ({ id: `task-${task.id}-${task.latestSubmission!.version || 1}`, at: task.latestSubmission!.submittedAt, title: `${task.title} submitted for task review`, detail: `${task.latestSubmission!.submitterName} · attempt ${task.latestSubmission!.version || 1} · ${task.status.replace("_", " ")}`, tone: task.status === "completed" ? "good" : "neutral", icon: <Send size={12} /> })),
  ];
  if (closeout?.requestedAt) items.push({ id: "closeout-request", at: closeout.requestedAt, title: "Final closeout requested", detail: `${personName(closeout.requestedBy)}${closeout.requestNote ? ` · ${closeout.requestNote}` : ""}`, tone: "neutral", icon: <Send size={12} /> });
  if (closeout?.completedAt) items.push({ id: "delivery-completed", at: closeout.completedAt, title: "Proposal delivery completed", detail: personName(closeout.completedBy), tone: "good", icon: <CheckCircle2 size={12} /> });
  if (closeout?.archivedAt) items.push({ id: "delivery-archived", at: closeout.archivedAt, title: "Proposal delivery archived", detail: personName(closeout.archivedBy), tone: "good", icon: <FileCheck2 size={12} /> });
  items.sort((left, right) => right.at - left.at);
  return <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"><div className="text-[16px] font-semibold text-neutral-900">Unified governance timeline</div><p className="mt-1 text-[12px] text-neutral-500">Revision history, organization decisions, named approvals, changes, task evidence submissions, formal records, and closeout in one chronology.</p><div className="mt-4 space-y-1">{items.length ? items.map((item) => <div key={item.id} className="grid grid-cols-[28px_minmax(0,1fr)_130px] items-start gap-2 rounded-xl px-2 py-2 hover:bg-neutral-50"><span className={`flex h-7 w-7 items-center justify-center rounded-full ${item.tone === "good" ? "bg-emerald-50 text-emerald-700" : item.tone === "warn" ? "bg-amber-50 text-amber-700" : "bg-neutral-100 text-neutral-500"}`}>{item.icon}</span><div><div className="text-[13px] font-medium capitalize text-neutral-800">{item.title}</div><div className="mt-0.5 text-[12px] leading-relaxed text-neutral-500">{item.detail}</div></div><time className="pt-1 text-right text-[12px] text-neutral-500">{new Date(item.at).toLocaleString()}</time></div>) : <div className="rounded-xl border border-dashed border-neutral-300 p-5 text-center text-[12px] text-neutral-500">Governance activity will appear here.</div>}</div></section>;
}
