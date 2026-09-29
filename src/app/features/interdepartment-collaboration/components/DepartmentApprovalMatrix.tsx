import type { Organization, UserProfile } from "../../../types";
import type { CollaborationApproval, CollaborationParticipant } from "../types";
import { departmentApprovalRows } from "../selectors/departmentApprovalRows";

const date = (value?: number) => value ? new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }) : "—";

export function DepartmentApprovalMatrix({ participants, approvals, currentRevisionId, organizations, profiles = [] }: {
  participants: CollaborationParticipant[]; approvals: CollaborationApproval[]; currentRevisionId?: string;
  organizations: Organization[]; profiles?: UserProfile[];
}) {
  const rows = departmentApprovalRows(participants, approvals, currentRevisionId);
  return <section className="rounded-xl border border-neutral-200 bg-white p-4" aria-label="Department approvals">
    <h2 className="text-base font-semibold">Department approvals</h2>
    <p className="mt-1 text-xs text-neutral-500">Decisions for the current saved plan. Each participating department confirms its responsibilities before publication.</p>
    {rows.length === 0 ? <p className="mt-4 text-sm text-neutral-500">No participating departments are recorded for this plan.</p> :
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead><tr className="border-b text-neutral-500">{["Department / office", "Required approval", "Status", "Requested", "Decision by / date", "Comments"].map((label) => <th key={label} scope="col" className="p-2 font-medium">{label}</th>)}</tr></thead><tbody>
        {rows.map(({ participant, approval, status, rule }) => <tr key={participant.orgId} className="border-b last:border-0">
          <th scope="row" className="p-2 font-medium">{organizations.find((org) => org.id === participant.orgId)?.name || "Department unavailable"}<span className="block text-[11px] font-normal text-neutral-500">{participant.participationRole === "governance" ? "Required review" : participant.participationRole === "observer" ? "For information" : participant.participationRole === "owner" ? "Plan owner" : "Participating department"}</span></th>
          <td className="p-2">{rule}</td><td className={`p-2 font-medium ${status === "Approved" ? "text-emerald-700" : status === "Declined" || status === "Updates needed" ? "text-red-700" : "text-neutral-700"}`}>{status}</td><td className="p-2">{date(participant.requestedAt)}</td>
          <td className="p-2">{approval ? <>{profiles.find((person) => person.id === approval.approvedBy)?.full_name || "Authorized approver"}<span className="block text-neutral-500">{date(approval.createdAt)}</span></> : "—"}</td><td className="max-w-60 whitespace-normal p-2">{approval?.reason || "—"}</td>
        </tr>)}
      </tbody></table></div>}
  </section>;
}
