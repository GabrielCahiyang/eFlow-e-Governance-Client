import * as React from "react";
import { Button } from "@vibe/core";
import { UserRoundCog } from "lucide-react";
import type { Organization, UserProfile } from "../../../types";
import type { Task } from "../../tasks";
import type {
  CollaborationApproval,
  CollaborationChangeRequest,
  CollaborationDraft,
  CollaborationDraftSnapshot,
  CollaborationParticipant,
  CollaborationRevision,
  ProposalGovernanceState,
} from "../types";
import {
  archiveProposalDelivery,
  completeProposalDelivery,
  decideProposalCloseout,
  getGovernanceMinutesUrl,
  recuseAndDelegateReview,
  requestProposalCloseout,
  saveGovernanceConfiguration,
  saveGovernanceRecord,
  setTaskGovernanceRoute,
} from "../services/governanceService";
import { openGovernanceDecisionPacket } from "../services/governanceDecisionPacket";
import { GovernanceRosterPanel } from "./governance/GovernanceRosterPanel";
import { GovernanceCloseoutPanel } from "./governance/GovernanceCloseoutPanel";
import { GovernanceRecordPanel } from "./governance/GovernanceRecordPanel";
import { TaskGovernanceRoutingPanel } from "./governance/TaskGovernanceRoutingPanel";
import { GovernanceTimelinePanel } from "./governance/GovernanceTimelinePanel";

export function GovernanceWorkspace({
  draft,
  snapshot,
  revision,
  revisions,
  participants,
  approvals,
  changeRequests,
  governance,
  organizations,
  profiles,
  operationalTasks,
  isOwner,
  actingOrgId,
  busy,
  onAct: performAction,
  onRefresh,
  onSaveRevision,
}: {
  draft: CollaborationDraft;
  snapshot: CollaborationDraftSnapshot;
  revision?: CollaborationRevision;
  revisions: CollaborationRevision[];
  participants: CollaborationParticipant[];
  approvals: CollaborationApproval[];
  changeRequests: CollaborationChangeRequest[];
  governance: ProposalGovernanceState;
  organizations: Organization[];
  profiles: UserProfile[];
  operationalTasks: Task[];
  isOwner: boolean;
  actingOrgId?: string;
  busy: boolean;
  onAct: (operation: () => Promise<void>, success: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onSaveRevision: (
    snapshot: CollaborationDraftSnapshot,
    summary: string,
  ) => Promise<void>;
}) {
  const onAct = async (operation: () => Promise<void>, success: string) => {
    if (!window.confirm("Confirm this approval or project change? It updates the official review rules, responsibility, or project record.")) return;
    await performAction(operation, success);
  };
  const published = draft.status === "committed" || draft.status === "archived";
  const allTasksApproved =
    operationalTasks.length > 0 &&
    operationalTasks.every(
      (task) =>
        task.status === "completed" ||
        task.status === "cancelled" ||
        Boolean(task.archivedAt),
    );
  const [recusalOpen, setRecusalOpen] = React.useState(false);
  const [recusalReason, setRecusalReason] = React.useState("");
  const [delegateId, setDelegateId] = React.useState("");
  const actingCandidates = profiles.filter(
    (profile) => profile.is_active && profile.org_id === actingOrgId,
  );
  const refreshBoth = async () => {
    await onRefresh();
  };

  const requiredCount = participants.filter((item) =>
    ["participant", "governance"].includes(item.participationRole),
  ).length;
  const decisionMakersCount = governance.assignments.filter((item) =>
    ["primary_approver", "backup_approver", "delegate"].includes(item.role),
  ).length;
  const signoffsCount = governance.signoffs.filter(
    (item) =>
      item.revisionId === draft.currentRevisionId && item.decision === "approved",
  ).length;
  const closeoutLabel =
    governance.closeout?.status.replace("_", " ") ||
    (published ? "Not requested" : "After delivery");

  return (
    <div className="space-y-4">
      {/* Governance Pulse Strip */}
      <div className="eflow-health-strip">
        <div className="eflow-health-item">
          <span className="eflow-health-item-label">Required offices</span>
          <span className="eflow-health-item-value">{requiredCount}</span>
        </div>

        <div className="eflow-health-item">
          <span className="eflow-health-item-label">Decision makers</span>
          <span className="eflow-health-item-value">{decisionMakersCount}</span>
        </div>

        <div className="eflow-health-item">
          <span className="eflow-health-item-label">Active approvals</span>
          <span className="eflow-health-item-value text-emerald-600">
            {signoffsCount}
          </span>
        </div>

        <div className="eflow-health-item">
          <span className="eflow-health-item-label">Closeout stage</span>
          <span className="eflow-health-item-value capitalize">
            {closeoutLabel}
          </span>
        </div>
      </div>

      <GovernanceRosterPanel
        participants={participants}
        assignments={governance.assignments}
        organizations={organizations}
        profiles={profiles}
        editable={isOwner && !published}
        busy={busy}
        onSave={(organizationConfig, assignments) =>
          onAct(async () => {
            await saveGovernanceConfiguration({
              draftId: draft.id,
              organizations: organizationConfig,
              assignments,
            });
            await refreshBoth();
          }, "Governance roster and approval policy saved.")
        }
      />

      <TaskGovernanceRoutingPanel
        snapshot={snapshot}
        participants={participants}
        organizations={organizations}
        operationalTasks={operationalTasks}
        editableDraft={isOwner && !published}
        canManagePublished={isOwner && draft.status === "committed"}
        busy={busy}
        onSaveDraft={(next) =>
          onSaveRevision(next, "Task governance routing updated")
        }
        onSetPublishedRoute={(taskId, mode, orgId) =>
          onAct(async () => {
            await setTaskGovernanceRoute(taskId, mode, orgId);
            await refreshBoth();
          }, "Task review route updated.")
        }
      />

      {actingOrgId && !published && (
        <section className="eflow-section-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <UserRoundCog size={16} /> Conflict, recusal, and temporary delegation
              </div>
              <p className="mt-1 text-xs text-secondary">
                If you have an official conflict of interest, record it formally instead of sharing credentials or silently bypassing approval.
              </p>
            </div>
            <Button
              kind="secondary"
              size="small"
              onClick={() => setRecusalOpen((value) => !value)}
            >
              {recusalOpen ? "Cancel" : "Recuse or delegate"}
            </Button>
          </div>

          {recusalOpen && (
            <div className="mt-4 grid gap-3 rounded-lg border border-blue-200 bg-blue-50/50 p-4 sm:grid-cols-[1fr_220px_auto]">
              <input
                value={recusalReason}
                onChange={(event) => setRecusalReason(event.target.value)}
                placeholder="Required reason for conflict or recusal…"
                className="eflow-control w-full"
              />
              <select
                value={delegateId}
                onChange={(event) => setDelegateId(event.target.value)}
                className="eflow-control"
              >
                <option value="">Recuse without delegate</option>
                {actingCandidates.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name}
                  </option>
                ))}
              </select>
              <Button
                size="small"
                disabled={busy || !recusalReason.trim()}
                onClick={() =>
                  void onAct(async () => {
                    await recuseAndDelegateReview({
                      draftId: draft.id,
                      organizationId: actingOrgId,
                      reason: recusalReason,
                      delegateTo: delegateId,
                    });
                    setRecusalOpen(false);
                    setRecusalReason("");
                    setDelegateId("");
                    await refreshBoth();
                  }, "Recusal recorded and delegation updated.")
                }
              >
                Record recusal
              </Button>
            </div>
          )}
        </section>
      )}

      {published && (
        <GovernanceCloseoutPanel
          closeout={governance.closeout}
          decisions={governance.closeoutDecisions}
          participants={participants}
          organizations={organizations}
          allTasksApproved={allTasksApproved}
          canManage={isOwner}
          decisionOrgId={
            actingOrgId &&
            participants.some(
              (item) =>
                item.orgId === actingOrgId &&
                item.participationRole === "governance",
            )
              ? actingOrgId
              : undefined
          }
          busy={busy}
          onRequest={(note) =>
            onAct(async () => {
              await requestProposalCloseout(draft.id, note);
              await refreshBoth();
            }, "Proposal closeout requested.")
          }
          onDecide={(decision, reason, resolutionNumber, meetingDate) =>
            onAct(async () => {
              await decideProposalCloseout({
                draftId: draft.id,
                organizationId: actingOrgId!,
                decision,
                reason,
                resolutionNumber,
                meetingDate,
              });
              await refreshBoth();
            }, "Closeout decision recorded.")
          }
          onComplete={(note) =>
            onAct(async () => {
              await completeProposalDelivery(draft.id, note);
              await refreshBoth();
            }, "Proposal delivery completed atomically.")
          }
          onArchive={(reason) =>
            onAct(async () => {
              await archiveProposalDelivery(draft.id, reason);
              await refreshBoth();
            }, "Proposal archived. Linked tasks were removed from active Task Boards.")
          }
        />
      )}

      <GovernanceRecordPanel
        records={governance.records}
        signoffs={governance.signoffs}
        organizations={organizations}
        profiles={profiles}
        actingOrgId={actingOrgId}
        busy={busy}
        onSaveRecord={(input) =>
          onAct(async () => {
            await saveGovernanceRecord({
              draftId: draft.id,
              organizationId: actingOrgId!,
              ...input,
            });
            await refreshBoth();
          }, "Formal governance record saved.")
        }
        onOpenMinutes={async (path) => {
          window.open(
            await getGovernanceMinutesUrl(path),
            "_blank",
            "noopener,noreferrer",
          );
        }}
        onDownloadPacket={() =>
          openGovernanceDecisionPacket({
            draft,
            revision,
            organizations,
            profiles,
            assignments: governance.assignments,
            approvals,
            signoffs: governance.signoffs,
            records: governance.records,
            closeout: governance.closeout,
            closeoutDecisions: governance.closeoutDecisions,
            tasks: operationalTasks,
          })
        }
      />

      <GovernanceTimelinePanel
        revisions={revisions}
        approvals={approvals}
        changes={changeRequests}
        signoffs={governance.signoffs}
        records={governance.records}
        closeout={governance.closeout}
        closeoutDecisions={governance.closeoutDecisions}
        tasks={operationalTasks}
        organizations={organizations}
        profiles={profiles}
      />
    </div>
  );
}
