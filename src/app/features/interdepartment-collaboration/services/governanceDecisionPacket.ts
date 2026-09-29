import type { Organization, UserProfile } from "../../../types";
import type { Task } from "../../tasks";
import type { CollaborationApproval, CollaborationDraft, CollaborationRevision, GovernanceAssignment, GovernanceRecord, GovernanceSignoff, ProposalCloseout, ProposalCloseoutDecision } from "../types";

export function openGovernanceDecisionPacket(input: {
  draft: CollaborationDraft;
  revision?: CollaborationRevision;
  organizations: Organization[];
  profiles: UserProfile[];
  assignments: GovernanceAssignment[];
  approvals: CollaborationApproval[];
  signoffs: GovernanceSignoff[];
  records: GovernanceRecord[];
  closeout: ProposalCloseout | null;
  closeoutDecisions: ProposalCloseoutDecision[];
  tasks: Task[];
}) {
  const popup = window.open("", "_blank");
  if (!popup) throw new Error("Allow pop-ups to open the governance decision packet.");
  // The packet is written into a same-origin blank document, so retain the
  // handle long enough to render it and then sever access to the source app.
  popup.opener = null;
  const orgName = (id: string) => input.organizations.find((item) => item.id === id)?.name || id;
  const personName = (id?: string) => input.profiles.find((item) => item.id === id)?.full_name || id || "—";
  const currentApprovals = input.approvals.filter((item) => item.revisionId === input.draft.currentRevisionId);
  const attachments = input.tasks.flatMap((task) => (task.latestSubmission?.attachments || []).map((file) => ({ task: task.title, name: typeof file === "string" ? file : file.fileName, path: typeof file === "string" ? "" : file.filePath })));
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(input.draft.title)} — Governance Decision Packet</title><style>${styles}</style></head><body>
  <header><div class="eyebrow">eFlow governance decision packet</div><h1>${escapeHtml(input.draft.title)}</h1><div class="meta">Revision ${input.revision?.revisionNumber || "—"} · Generated ${new Date().toLocaleString()} · Owner ${escapeHtml(orgName(input.draft.ownerOrgId))}</div></header>
  <section class="summary"><div><b>${input.tasks.filter((item) => item.status === "completed").length}/${input.tasks.length}</b><span>Approved tasks</span></div><div><b>${currentApprovals.filter((item) => item.decision === "approved").length}</b><span>Organization approvals</span></div><div><b>${input.signoffs.filter((item) => item.decision === "approved").length}</b><span>Named approvals</span></div><div><b>${input.closeout?.status || "Not requested"}</b><span>Closeout status</span></div></section>
  ${section("Approved revision", `<p>${escapeHtml(input.revision?.changeSummary || "Current approved proposal revision")}</p><p>${escapeHtml(input.draft.snapshot.description || "No description")}</p>`)}
  ${section("Signatories and assigned governance roster", table(["Organization", "Person", "Role"], input.assignments.map((item) => [orgName(item.organizationId), personName(item.userId), item.role.replace(/_/g, " ")])))}
  ${section("Revision decisions", table(["Organization", "Decision", "Decision maker", "Date / endorsement"], currentApprovals.map((item) => [orgName(item.organizationId), item.decision.replace(/_/g, " "), personName(item.approvedBy), `${new Date(item.createdAt).toLocaleString()}${item.reason ? ` — ${item.reason}` : ""}`])))}
  ${section("Board records", table(["Organization", "Resolution", "Meeting", "Minutes / endorsement"], input.records.map((item) => [orgName(item.organizationId), item.resolutionNumber || "—", item.meetingDate || "—", [item.minutesFileName, item.endorsement].filter(Boolean).join(" — ") || "—"])))}
  ${section("Final closeout decisions", table(["Organization", "Decision", "Decision maker", "Resolution / date"], input.closeoutDecisions.map((item) => [orgName(item.organizationId), item.decision.replace(/_/g, " "), personName(item.decidedBy), [item.resolutionNumber, item.meetingDate, item.reason].filter(Boolean).join(" — ") || "—"])))}
  ${section("Final deliverables and evidence index", table(["Task", "Status", "Evidence files", "Audit hash"], input.tasks.map((task) => [task.title, task.status.replace(/_/g, " "), String(task.latestSubmission?.attachments.length || 0), task.auditHash || "—"])) + (attachments.length ? `<h3>Evidence files</h3>${table(["Task", "File", "Storage reference"], attachments.map((item) => [item.task, item.name, item.path || "Recorded attachment"]))}` : ""))}
  <footer>Generated from the permission-scoped eFlow governance record. Verify signatures and attached minutes before treating this printout as a legal certified copy.</footer>
  <script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`);
  popup.document.close();
}

function escapeHtml(value: unknown) { return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character] || character)); }
function section(title: string, content: string) { return `<section><h2>${escapeHtml(title)}</h2>${content}</section>`; }
function table(headers: string[], rows: string[][]) { return `<table><thead><tr>${headers.map((item) => `<th>${escapeHtml(item)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map((item) => `<td>${escapeHtml(item)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">No records</td></tr>`}</tbody></table>`; }
const styles = `@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font:11px Arial,sans-serif;color:#171717;margin:0}header{border-bottom:3px solid #111;padding-bottom:14px}.eyebrow{text-transform:uppercase;letter-spacing:1.6px;color:#666;font-size:9px}h1{font-size:24px;margin:6px 0}.meta{color:#666}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}.summary div{border:1px solid #ddd;border-radius:8px;padding:10px}.summary b{display:block;font-size:16px;text-transform:capitalize}.summary span{display:block;color:#777;font-size:9px;margin-top:4px}section{margin:16px 0;break-inside:avoid}h2{font-size:14px;border-bottom:1px solid #ddd;padding-bottom:5px}h3{font-size:11px;margin-top:12px}p{line-height:1.5}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:7px;text-align:left;vertical-align:top}th{background:#f3f3f3;font-size:9px;text-transform:uppercase}footer{margin-top:20px;padding-top:10px;border-top:1px solid #ddd;color:#777;font-size:8px}@media print{button{display:none}}`;
