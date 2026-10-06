import { useGovernanceSafety } from "../hooks/useGovernanceSafety";
import { useExplicitDraft } from "../../../shared/useExplicitDraft";
import { requestNavigation } from "../../../shared/navigationGuard";
import { FeedbackState } from "../../../components/ui/FeedbackState";
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
  const { safety, receipts, onAct } = useGovernanceSafety({
    draft,
    isOwner,
    actingOrgId,
    governance,
    organizations,
    performAction,
    onRefresh,
  });
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
  const recusalDraft = useExplicitDraft(
    "Recusal and delegation",
    recusalOpen && Boolean(recusalReason || delegateId),
    safety.pending || busy,
    () => {
      setRecusalReason("");
      setDelegateId("");
      setRecusalOpen(false);
    },
    `${draft.id}:${actingOrgId || ""}`,
  );
  const actingCandidates = profiles.filter(
    (profile) => profile.is_active && profile.org_id === actingOrgId,
  );

  const requiredCount = participants.filter((item) =>
    ["participant", "governance"].includes(item.participationRole),
  ).length;
  const decisionMakersCount = governance.assignments.filter((item) =>
    ["primary_approver", "backup_approver", "delegate"].includes(item.role),
  ).length;
  const signoffsCount = governance.signoffs.filter(
    (item) =>
      item.revisionId === draft.currentRevisionId &&
      item.decision === "approved",
  ).length;
  const closeoutLabel =
    governance.closeout?.status.replace("_", " ") ||
    (published ? "Not requested" : "After delivery");

  return (
    <div className="space-y-4">
      {safety.dialog}
      {safety.message && (
        <FeedbackState tone={safety.tone} title="Governance result">
          <p>{safety.message}</p>
        </FeedbackState>
      )}
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
        savedReceipt={
          receipts["Save governance roster and approval policy"] || 0
        }
        participants={participants}
        assignments={governance.assignments}
        organizations={organizations}
        profiles={profiles}
        editable={isOwner && !published}
        busy={busy || safety.pending}
        onSave={(organizationConfig, assignments) =>
          onAct(async () => {
            await saveGovernanceConfiguration({
              draftId: draft.id,
              organizations: organizationConfig,
              assignments,
            });
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
        busy={busy || safety.pending}
        onSaveDraft={(next) =>
          onSaveRevision(next, "Task governance routing updated")
        }
        onSetPublishedRoute={(taskId, mode, orgId) =>
          onAct(async () => {
            await setTaskGovernanceRoute(taskId, mode, orgId);
          }, "Task review route updated.")
        }
      />

      {actingOrgId && !published && (
        <section className="eflow-section-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <UserRoundCog size={16} /> Conflict, recusal, and temporary
                delegation
              </div>
              <p className="mt-1 text-xs text-secondary">
                If you have an official conflict of interest, record it formally
                instead of sharing credentials or silently bypassing approval.
              </p>
            </div>
            <Button
              kind="secondary"
              size="small"
              onClick={() => {
                if (recusalOpen)
                  void requestNavigation(() => setRecusalOpen(false));
                else setRecusalOpen(true);
              }}
            >
              {recusalOpen ? "Cancel" : "Recuse or delegate"}
            </Button>
          </div>

          {recusalOpen && (
            <div className="mt-4 grid gap-3 rounded-lg border border-blue-200 bg-blue-50/50 p-4 sm:grid-cols-[1fr_220px_auto]">
              <input
                aria-label="Recusal reason"
                value={recusalReason}
                onChange={(event) => setRecusalReason(event.target.value)}
                placeholder="Required reason for conflict or recusal…"
                className="eflow-control w-full"
              />
              <select
                aria-label="Temporary delegate"
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
                disabled={busy || safety.pending || !recusalReason.trim()}
                onClick={() =>
                  void onAct(
                    async () => {
                      await recuseAndDelegateReview({
                        draftId: draft.id,
                        organizationId: actingOrgId,
                        reason: recusalReason,
                        delegateTo: delegateId,
                      });
                      recusalDraft.markClean();
                      setRecusalOpen(false);
                      setRecusalReason("");
                      setDelegateId("");
                    },
                    "Recusal recorded and delegation updated.",
                    <p>
                      Reason: {recusalReason}. Delegate:{" "}
                      {profiles.find((person) => person.id === delegateId)
                        ?.full_name || "No delegate"}
                      .
                    </p>,
                  )
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
          savedReceipt={
            (receipts["Request proposal closeout"] || 0) +
            (receipts["Record closeout decision"] || 0) +
            (receipts["Complete proposal delivery"] || 0) +
            (receipts["Archive proposal delivery"] || 0)
          }
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
          busy={busy || safety.pending}
          onRequest={(note) =>
            onAct(
              async () => {
                await requestProposalCloseout(draft.id, note);
              },
              "Proposal closeout requested.",
              <p>Closeout note: {note || "None"}.</p>,
            )
          }
          onDecide={(decision, reason, resolutionNumber, meetingDate) =>
            onAct(
              async () => {
                await decideProposalCloseout({
                  draftId: draft.id,
                  organizationId: actingOrgId!,
                  decision,
                  reason,
                  resolutionNumber,
                  meetingDate,
                });
              },
              "Closeout decision recorded.",
              <p>
                Decision: {decision}. Reason: {reason}. Resolution:{" "}
                {resolutionNumber || "None"}. Meeting:{" "}
                {meetingDate || "Not supplied"}.
              </p>,
            )
          }
          onComplete={(note) =>
            onAct(
              async () => {
                await completeProposalDelivery(draft.id, note);
              },
              "Proposal delivery completed atomically.",
              <p>
                Finalize delivery with note: {note || "None"}. Current task,
                evidence and financial blockers remain server checked.
              </p>,
            )
          }
          onArchive={(reason) =>
            onAct(
              async () => {
                await archiveProposalDelivery(draft.id, reason);
              },
              "Proposal archived. Linked tasks were removed from active Task Boards.",
              <p>
                Linked tasks leave active Task Boards. Archive reason: {reason}.
              </p>,
            )
          }
        />
      )}

      <GovernanceRecordPanel
        savedReceipt={receipts["Save formal governance record"] || 0}
        records={governance.records}
        signoffs={governance.signoffs}
        organizations={organizations}
        profiles={profiles}
        actingOrgId={actingOrgId}
        busy={busy || safety.pending}
        onSaveRecord={(input) =>
          onAct(async () => {
            await saveGovernanceRecord({
              draftId: draft.id,
              organizationId: actingOrgId!,
              ...input,
            });
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
