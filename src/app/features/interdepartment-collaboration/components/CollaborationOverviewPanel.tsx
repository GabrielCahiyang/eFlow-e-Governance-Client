import { Building2, ShieldCheck } from "lucide-react";
import type { Organization } from "../../../types";
import { PARTICIPATION_ROLE_LABELS } from "../constants";
import type { CommittedProposalDeliverySummary } from "../selectors/deliveryProgress";
import type {
  CollaborationDraftSnapshot,
  CollaborationParticipant,
} from "../types";
import { CollaborationPlanPanel } from "./CollaborationPlanPanel";
import { CommittedProposalDeliveryPanel } from "./CommittedProposalDeliveryPanel";
import { OrganizationParticipantsPanel } from "./OrganizationParticipantsPanel";

export function CollaborationOverviewPanel({
  committed,
  delivery,
  canManageDelivery,
  busy,
  participants,
  organizations,
  snapshot,
  ownerOrgId,
  canEditOrganizations,
  onOpenProject,
  onMarkProjectsCompleted,
  onArchiveProjects,
  onSaveOrganizations,
  onSaveRevision,
}: {
  committed: boolean;
  delivery: CommittedProposalDeliverySummary;
  canManageDelivery: boolean;
  busy: boolean;
  participants: CollaborationParticipant[];
  organizations: Organization[];
  snapshot: CollaborationDraftSnapshot;
  ownerOrgId: string;
  canEditOrganizations: boolean;
  onOpenProject: (projectId: string) => void;
  onMarkProjectsCompleted: () => Promise<void>;
  onArchiveProjects: () => Promise<void>;
  onSaveOrganizations: (snapshot: CollaborationDraftSnapshot) => Promise<void>;
  onSaveRevision: (
    snapshot: CollaborationDraftSnapshot,
    summary: string,
  ) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      {committed && (
        <CommittedProposalDeliveryPanel
          summary={delivery}
          canManage={canManageDelivery}
          busy={busy}
          onOpenProject={onOpenProject}
          onMarkCompleted={onMarkProjectsCompleted}
          onArchive={onArchiveProjects}
        />
      )}

      {/* Participating Departments Section */}
      <section className="eflow-section-card">
        <header>
          <h2>Participating offices &amp; governance</h2>
          <p className="m-0 mt-1 text-xs text-secondary">
            Offices and governance reviewers committed to this work plan.
          </p>
        </header>
        <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {participants.map((participant) => {
            const organization = organizations.find(
              (item) => item.id === participant.orgId,
            );
            const isOwner = participant.participationRole === "owner";
            const isGov = participant.participationRole === "governance";
            return (
              <div
                key={participant.orgId}
                className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50/60 p-3"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isGov
                      ? "bg-amber-100 text-amber-800"
                      : isOwner
                        ? "bg-blue-100 text-blue-800"
                        : "bg-neutral-200 text-neutral-700"
                  }`}
                >
                  {isGov ? <ShieldCheck size={16} /> : <Building2 size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-neutral-900">
                    {organization?.name || "Organization unavailable"}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-secondary">
                    <span>
                      {PARTICIPATION_ROLE_LABELS[participant.participationRole]}
                    </span>
                    <span>·</span>
                    <span>
                      {participant.staffingEnabled
                        ? "Staffing enabled"
                        : "Approval only"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* When in Draft / Planning Mode: show scope picker and plan */}
      {!committed && (
        <>
          <OrganizationParticipantsPanel
            snapshot={snapshot}
            ownerOrgId={ownerOrgId}
            organizations={organizations}
            editable={canEditOrganizations}
            onSave={onSaveOrganizations}
          />
          <CollaborationPlanPanel
            snapshot={snapshot}
            organizations={organizations}
            editable={false}
            onSave={onSaveRevision}
          />
        </>
      )}
    </div>
  );
}
