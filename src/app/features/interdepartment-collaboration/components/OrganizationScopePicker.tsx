import * as React from "react";
import { Building2, Landmark, Plus, ShieldCheck, X } from "lucide-react";
import type { Organization } from "../../../types";
import { defaultParticipationRole } from "../selectors/organizationEligibility";
import type { CollaborationOrganizationSelection } from "../types";

export function OrganizationScopePicker({
  organizations,
  value,
  ownerOrgId,
  onChange,
  footer,
}: {
  organizations: Organization[];
  value: CollaborationOrganizationSelection[];
  ownerOrgId: string;
  onChange: (next: CollaborationOrganizationSelection[]) => void;
  footer?: React.ReactNode;
}) {
  const [candidateId, setCandidateId] = React.useState("");
  const selectedIds = new Set(value.map((item) => item.orgId));
  const options = organizations.filter((org) => org.is_active && org.id !== ownerOrgId && !selectedIds.has(org.id));
  const interDepartmental = value.some((item) => item.participationRole !== "owner");

  const add = () => {
    const org = organizations.find((item) => item.id === candidateId);
    if (!org) return;
    const participationRole = defaultParticipationRole(org);
    onChange([...value, { orgId: org.id, participationRole, staffingEnabled: participationRole === "participant", approvalPolicy: "one_of", quorumCount: 1, sequence: value.length, reviewDeadlineDays: 5 }]);
    setCandidateId("");
  };

  const owner = organizations.find((org) => org.id === ownerOrgId);
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm" data-testid="organization-scope-picker">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
            {interDepartmental ? <Building2 size={18} /> : <ShieldCheck size={18} />}
          </div>
          <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400">{interDepartmental ? "Collaboration scope" : "Department scope"}</div>
          <h2 className="mt-1 text-[14px] font-semibold text-neutral-900">
            {interDepartmental ? "Inter-departmental proposal" : "Department-only proposal"}
          </h2>
          <p className="mt-1 text-[11px] text-neutral-500">{interDepartmental
            ? "Participating offices complete the required review before the owner publishes."
            : "Publish directly after staffing, schedule, and budget checks. Add another office only when delivery or governance crosses organizations."}</p>
          </div>
        </div>
        <div className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[10px] text-neutral-600">
          {value.length} organization{value.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <OrganizationRow
          name={owner?.name || "Your organization"}
          type={owner?.org_type || "department"}
          role="owner"
          staffingEnabled
        />
        {value.filter((item) => item.participationRole !== "owner").map((selection) => {
          const org = organizations.find((candidate) => candidate.id === selection.orgId);
          return (
            <OrganizationRow
              key={selection.orgId}
              name={org?.name || "Organization"}
              type={org?.org_type || "department"}
              role={selection.participationRole}
              staffingEnabled={selection.staffingEnabled}
              onRoleChange={(participationRole) => onChange(value.map((item) => item.orgId === selection.orgId
                ? { ...item, participationRole, staffingEnabled: participationRole === "participant" ? item.staffingEnabled : false }
                : item))}
              onStaffingChange={(staffingEnabled) => onChange(value.map((item) => item.orgId === selection.orgId ? { ...item, staffingEnabled } : item))}
              onRemove={() => { if (window.confirm("Remove this department? Review its tasks and assigned team before saving the plan.")) onChange(value.filter((item) => item.orgId !== selection.orgId)); }}
            />
          );
        })}
      </div>

      <div className="mt-3 flex gap-2">
        <select aria-label="Add participating organization" data-testid="organization-scope-candidate" value={candidateId} onChange={(event) => setCandidateId(event.target.value)} className="h-9 min-w-0 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[11px] text-neutral-700 outline-none focus:border-violet-400">
          <option value="">Add a participating office, board, or committee…</option>
          {options.map((org) => <option key={org.id} value={org.id}>{org.name} · {org.org_type}</option>)}
        </select>
        <button type="button" data-testid="organization-scope-add" onClick={add} disabled={!candidateId} className="inline-flex h-9 items-center gap-1 rounded-xl bg-neutral-900 px-3 text-[11px] font-medium text-white disabled:opacity-40"><Plus size={13} /> Add</button>
      </div>
      <p className="mt-3 text-[11px] text-neutral-500">Participating departments carry out the work. Reviewing offices approve it. Observers can follow the plan but do not approve or assign staff.</p>
      {footer}
    </section>
  );
}

function OrganizationRow({ name, type, role, staffingEnabled, onRoleChange, onStaffingChange, onRemove }: {
  name: string;
  type: string;
  role: CollaborationOrganizationSelection["participationRole"];
  staffingEnabled: boolean;
  onRoleChange?: (role: "participant" | "governance" | "observer") => void;
  onStaffingChange?: (enabled: boolean) => void;
  onRemove?: () => void;
}) {
  const Icon = role === "governance" ? Landmark : role === "owner" ? ShieldCheck : Building2;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50/70 px-3 py-2.5" data-testid="organization-scope-row" data-organization-name={name}>
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${role === "governance" ? "bg-amber-50 text-amber-700" : role === "owner" ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}><Icon size={15} /></div>
      <div className="min-w-[150px] flex-1"><div className="text-[12px] font-medium text-neutral-900">{name}</div><div className="text-[10px] capitalize text-neutral-400">{type}</div></div>
      {onRoleChange ? (
        <select aria-label={"Participation of " + name} value={role} onChange={(event) => onRoleChange(event.target.value as "participant" | "governance" | "observer")} className="h-8 rounded-lg border border-neutral-200 bg-white px-2 text-[10px] text-neutral-700">
          <option value="participant">Participating department · approval required</option><option value="governance">Reviewing office · approval required</option><option value="observer">Observer · view only</option>
        </select>
      ) : <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-700">Owner</span>}
      {onStaffingChange && role === "participant" && (
        <label className="flex items-center gap-1.5 text-[10px] text-neutral-600"><input type="checkbox" checked={staffingEnabled} onChange={(event) => onStaffingChange(event.target.checked)} /> May assign staff</label>
      )}
      {onRemove && <button type="button" onClick={onRemove} className="rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600" title="Remove organization"><X size={13} /></button>}
    </div>
  );
}
