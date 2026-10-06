import { requestNavigation } from "../../../shared/navigationGuard";
import * as React from "react";
import { useConfirmation } from "../../../components/ui/useConfirmation";
import { evaluateRevisionMateriality } from "../selectors/revisionDiff";
import { shouldResendAfterUpdate } from "../selectors/reviewActions";
import {
  saveReviewUpdate,
  SavedPlanApprovalError,
} from "../services/saveReviewUpdate";
import { Button, EmptyState, Loader } from "@vibe/core";
import { useAuth } from "../../../contexts/AuthContext";
import type { Organization, UserProfile } from "../../../types";
import { useToast } from "../../../components/ui/Toast";
import { useCollaborationDraft } from "../hooks/useCollaborationDraft";
import {
  commitCollaborationDraft,
  publishDepartmentProposal,
} from "../services/collaborationCommitService";
import { recommendCollaborationAssignments } from "../services/collaborationCandidateService";
import {
  deleteCollaborationDraft,
  fetchMyCollaborationMemberships,
  saveCollaborationRevision,
  saveCollaborationStaffingRevision,
  setCollaborationOrganizations,
} from "../services/collaborationDraftService";
import {
  createCollaborationChangeRequest,
  decideCollaborationReview,
  requestCollaborationReview,
  resolveCollaborationChangeRequest,
  sendCollaborationMessage,
} from "../services/collaborationReviewService";
import type { CollaborationDraftSnapshot } from "../types";
import type { Project } from "../../projects/services/types";
import type { Task } from "../../tasks";
import { isExternalReviewParticipant } from "../selectors/organizationEligibility";
import { DepartmentApprovalMatrix } from "./DepartmentApprovalMatrix";
import { ChangeRequestsPanel } from "./ChangeRequestsPanel";
import { CollaborationDiscussion } from "./CollaborationDiscussion";
import { CollaborationPlanEditPanel } from "./CollaborationPlanEditPanel";
import { CollaborationReadiness } from "./CollaborationReadiness";
import { RevisionTimeline } from "./RevisionTimeline";
import { StaffingReviewPanel } from "./StaffingReviewPanel";
import { CollaborationActionRail } from "./CollaborationActionRail";
import { CollaborationDecisionPanel } from "./CollaborationDecisionPanel";
import { CollaborationSourcePanel } from "./CollaborationSourcePanel";
import {
  CollaborationWorkspaceHeader,
  type CollaborationWorkspaceTab,
} from "./CollaborationWorkspaceHeader";
import { DELIVERY_STAGE_LABELS } from "./CommittedProposalDeliveryPanel";
import { CollaborationOverviewPanel } from "./CollaborationOverviewPanel";
import { CommittedProposalBoard } from "./CommittedProposalBoard";
import { buildCommittedProposalDeliverySummary } from "../selectors/deliveryProgress";
import { useProposalGovernance } from "../hooks/useProposalGovernance";
import { GovernanceWorkspace } from "./GovernanceWorkspace";
import { CollaborationBudgetPanel } from "../../budget";

export function CollaborationDraftWorkspace({
  draftId,
  organizations,
  profiles,
  operationalProjects,
  operationalTasks,
  readOnly = false,
  initialTab = "overview",
  onBack,
  onCommitted,
  onOpenProject,
  onMarkProjectsCompleted,
  onArchiveProjects,
}: {
  draftId: string;
  organizations: Organization[];
  profiles: UserProfile[];
  operationalProjects: Project[];
  operationalTasks: Task[];
  readOnly?: boolean;
  initialTab?: "overview" | "approvals" | "governance";
  onBack: () => void;
  onCommitted: () => void;
  onOpenProject: (projectId: string) => void;
  onMarkProjectsCompleted: (draftId: string) => Promise<void>;
  onArchiveProjects: (draftId: string) => Promise<void>;
}) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const state = useCollaborationDraft(draftId);
  const governance = useProposalGovernance(draftId);
  const [tab, setTab] = React.useState<CollaborationWorkspaceTab>(
    initialTab === "governance" ? "overview" : initialTab,
  );
  const [primaryTab, setPrimaryTab] = React.useState<
    "overview" | "plan" | "discussion" | "approvals"
  >(initialTab === "governance" ? "overview" : initialTab);
  const [secondaryTab, setSecondaryTab] =
    React.useState<CollaborationWorkspaceTab | null>(
      initialTab === "governance" ? "governance" : null,
    );
  React.useEffect(() => {
    if (typeof document === "undefined" || !state.draft?.title) return;
    const tabLabels: Record<CollaborationWorkspaceTab, string> = {
      overview: "Overview",
      board: "Project tasks",
      source: "Source PDF",
      plan: "Work plan",
      budget: "Budget",
      people: "Team roster",
      discussion: "Collaboration",
      changes: "Requested changes",
      approvals: "Review & Governance",
      governance: "Governance",
      revisions: "Plan update history",
    };
    const currentTab = secondaryTab || tab;
    document.title = `${tabLabels[currentTab]} · ${state.draft.title}`;
  }, [secondaryTab, state.draft?.title, tab]);
  React.useEffect(() => {
    if (!secondaryTab) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape")
        void requestNavigation(() => setSecondaryTab(null));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [secondaryTab]);
  const [busy, setBusy] = React.useState(false);
  const { confirm, dialog } = useConfirmation();
  const [memberships, setMemberships] = React.useState<
    Array<{ organizationId: string; membershipRole: string }>
  >([]);
  const [actingOrgId, setActingOrgId] = React.useState("");
  React.useEffect(() => {
    if (userProfile?.id)
      void fetchMyCollaborationMemberships(userProfile.id)
        .then(setMemberships)
        .catch(() => setMemberships([]));
  }, [userProfile?.id]);
  const homeOrgId = userProfile?.org_id || userProfile?.departmentId || "";
  const approverOrgIds = React.useMemo(
    () =>
      new Set(
        [
          ...(["head", "head"].includes(userProfile?.role || "")
            ? [homeOrgId]
            : []),
          ...memberships
            .filter((item) => item.membershipRole !== "member")
            .map((item) => item.organizationId),
          ...governance.assignments
            .filter(
              (item) =>
                item.userId === userProfile?.id &&
                ["primary_approver", "backup_approver", "delegate"].includes(
                  item.role,
                ),
            )
            .map((item) => item.organizationId),
        ].filter(Boolean),
      ),
    [
      governance.assignments,
      homeOrgId,
      memberships,
      userProfile?.id,
      userProfile?.role,
    ],
  );
  const eligibleReviewOrganizations = React.useMemo(
    () =>
      state.participants.filter(
        (participant) =>
          isExternalReviewParticipant(participant) &&
          approverOrgIds.has(participant.orgId),
      ),
    [approverOrgIds, state.participants],
  );
  React.useEffect(() => {
    if (
      eligibleReviewOrganizations.length > 0 &&
      !eligibleReviewOrganizations.some((item) => item.orgId === actingOrgId)
    ) {
      setActingOrgId(eligibleReviewOrganizations[0].orgId);
    }
  }, [actingOrgId, eligibleReviewOrganizations]);
  const reviewOrganization =
    eligibleReviewOrganizations.find(
      (participant) => participant.orgId === actingOrgId,
    ) || eligibleReviewOrganizations[0];
  const isOwner = Boolean(
    !readOnly &&
      state.draft &&
      state.draft.ownerOrgId === homeOrgId &&
      ["head", "head"].includes(userProfile?.role || ""),
  );
  const currentOrganizationApproval = state.approvals.find(
    (approval) =>
      approval.revisionId === state.draft?.currentRevisionId &&
      approval.organizationId === reviewOrganization?.orgId,
  );
  const canDecide = Boolean(
    !readOnly &&
      reviewOrganization &&
      !currentOrganizationApproval?.decision.includes("approved") &&
      state.draft &&
      ["in_review", "changes_requested", "ready_to_commit"].includes(
        state.draft.status,
      ),
  );
  const departmentOnly =
    state.participants.length === 1 &&
    state.participants[0]?.participationRole === "owner";
  React.useEffect(() => {
    if (departmentOnly && (tab === "approvals" || tab === "governance")) {
      setTab("overview");
      setPrimaryTab("overview");
    }
  }, [departmentOnly, tab]);

  // When a committed proposal loads, jump to board so delivery status is visible immediately
  const isCommittedDraft = Boolean(
    state.draft &&
      (state.draft.status === "committed" || state.draft.status === "archived"),
  );
  const hasJumpedRef = React.useRef(false);
  React.useEffect(() => {
    if (isCommittedDraft && !hasJumpedRef.current) {
      hasJumpedRef.current = true;
      setTab("board");
      setPrimaryTab("plan");
    }
  }, [isCommittedDraft]);

  const applyTabChange = (nextTab: CollaborationWorkspaceTab) => {
    if (
      nextTab === "overview" ||
      nextTab === "plan" ||
      nextTab === "discussion" ||
      nextTab === "approvals"
    ) {
      setPrimaryTab(nextTab);
    } else if (nextTab === "board") {
      setPrimaryTab("plan");
    }
    setTab(nextTab);
  };

  const handleTabChange = (nextTab: CollaborationWorkspaceTab) => {
    void requestNavigation(() => applyTabChange(nextTab));
  };

  const act = async (
    operation: () => Promise<void>,
    success: string,
    propagateError = false,
  ) => {
    setBusy(true);
    try {
      await operation();
      await state.refresh();
      toast(success, "success");
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "The action could not be completed.",
        "error",
      );
      if (error instanceof SavedPlanApprovalError) await state.refresh();
      if (propagateError) throw error;
    } finally {
      setBusy(false);
    }
  };
  const saveUpdate = async (
    next: CollaborationDraftSnapshot,
    save: () => Promise<unknown>,
  ) => {
    const previous =
      state.revisions.find((item) => item.id === state.draft?.currentRevisionId)
        ?.snapshot || state.draft?.snapshot;
    const resend = Boolean(
      state.draft &&
        previous &&
        shouldResendAfterUpdate(
          state.draft.status,
          evaluateRevisionMateriality(previous, next).material,
          departmentOnly,
        ),
    );
    if (
      resend &&
      !(await confirm({
        title: "Save changes and resend approval requests?",
        description:
          "Participating offices must review the updated responsibilities, team, schedule, or budget before this plan can be published.",
        actionLabel: "Save and resend",
      }))
    )
      throw new Error("Save cancelled. Your edits are still available.");
    await act(
      () =>
        saveReviewUpdate(
          save,
          resend ? () => requestCollaborationReview(draftId) : undefined,
        ),
      resend
        ? "Changes saved and approval requests sent."
        : "Plan changes saved.",
      true,
    );
  };
  const saveRevision = (
    snapshot: CollaborationDraftSnapshot,
    summary: string,
  ) =>
    saveUpdate(snapshot, () =>
      saveCollaborationRevision(draftId, snapshot, summary),
    );
  const saveStaffingRevision = async (
    snapshot: CollaborationDraftSnapshot,
    summary: string,
  ) => {
    if (isOwner) return saveRevision(snapshot, summary);
    if (!reviewOrganization)
      throw new Error("No organization is selected for this staffing review.");
    return act(
      async () => {
        await saveCollaborationStaffingRevision(
          draftId,
          reviewOrganization.orgId,
          snapshot,
          summary,
        );
      },
      "Team changes saved. The lead office can resend approval requests.",
      true,
    );
  };

  if (state.loading)
    return (
      <div
        className="flex min-h-[420px] items-center justify-center gap-2"
        aria-live="polite"
      >
        <Loader size="medium" /> Loading collaboration workspace…
      </div>
    );
  if (!state.draft)
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <EmptyState
          title="Collaboration draft unavailable"
          description={
            state.error || "This collaboration draft could not be found."
          }
        />
        <Button kind="secondary" onClick={() => void state.refresh()}>
          Retry loading
        </Button>
        <Button kind="secondary" onClick={onBack}>
          Back to Portfolio
        </Button>
      </div>
    );
  const draft = state.draft;
  const currentRevision = state.revisions.find(
    (revision) => revision.id === draft.currentRevisionId,
  );
  const snapshot =
    draft.status === "draft"
      ? draft.snapshot
      : currentRevision?.snapshot || draft.snapshot;
  const ownerOrg = organizations.find((org) => org.id === draft.ownerOrgId);
  const delivery = buildCommittedProposalDeliverySummary(
    draft.id,
    operationalProjects,
    operationalTasks,
  );
  return (
    <div className="eflow-project-command">
      {dialog}
      {state.error && (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          The latest plan could not be loaded. Your current view and edits are
          still available. {state.error}{" "}
          <button
            type="button"
            onClick={() => void state.refresh()}
            className="ml-2 font-semibold underline"
          >
            Retry loading
          </button>
        </div>
      )}
      <CollaborationWorkspaceHeader
        draft={draft}
        snapshot={snapshot}
        currentRevision={currentRevision}
        owner={ownerOrg}
        participantCount={state.participants.length}
        openChangeCount={
          state.changeRequests.filter((request) => request.status === "open")
            .length
        }
        tab={tab}
        primaryTab={primaryTab}
        secondaryTab={secondaryTab}
        onTabChange={handleTabChange}
        onSecondaryTabChange={(next) => {
          void requestNavigation(() => setSecondaryTab(next));
        }}
        onBack={() => {
          void requestNavigation(onBack);
        }}
        readyToPublish={Boolean(state.readiness?.ready)}
        deliveryLabel={
          isCommittedDraft ? DELIVERY_STAGE_LABELS[delivery.stage] : undefined
        }
        showDeliveryBoard={isCommittedDraft}
        departmentOnly={departmentOnly}
      />

      <div
        className={`mt-4 grid gap-4 ${isCommittedDraft ? "grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_300px]"}`}
      >
        <main>
          {tab === "overview" && (
            <CollaborationOverviewPanel
              committed={isCommittedDraft}
              delivery={delivery}
              canManageDelivery={
                isOwner &&
                !state.participants.some(
                  (participant) =>
                    participant.participationRole === "governance",
                )
              }
              busy={busy}
              participants={state.participants}
              organizations={organizations}
              snapshot={snapshot}
              ownerOrgId={draft.ownerOrgId}
              canEditOrganizations={isOwner && !isCommittedDraft}
              onOpenProject={onOpenProject}
              onMarkProjectsCompleted={() =>
                act(async () => {
                  await onMarkProjectsCompleted(draftId);
                }, "Proposal projects marked completed.")
              }
              onArchiveProjects={() =>
                act(
                  async () => {
                    await onArchiveProjects(draftId);
                  },
                  "Completed proposal archived.",
                  true,
                )
              }
              onSaveOrganizations={(next) =>
                saveUpdate(next, () =>
                  setCollaborationOrganizations(
                    draftId,
                    next.organizations,
                    next,
                  ),
                )
              }
              onSaveRevision={saveRevision}
            />
          )}
          {tab === "board" && isCommittedDraft && (
            <CommittedProposalBoard
              delivery={delivery}
              profiles={profiles}
              readOnly={readOnly}
            />
          )}
          {tab === "plan" && (
            <CollaborationPlanEditPanel
              snapshot={snapshot}
              organizations={organizations}
              editable={
                isOwner &&
                !["committed", "archived", "deleted"].includes(draft.status)
              }
              onSave={saveRevision}
            />
          )}
          {tab === "discussion" && (
            <CollaborationDiscussion
              messages={state.messages}
              organizations={organizations}
              profiles={profiles}
              onSend={(message) =>
                act(async () => {
                  await sendCollaborationMessage({ draftId, message });
                }, "Message sent.")
              }
            />
          )}
          {tab === "approvals" && !departmentOnly && (
            <div className="space-y-3">
              <DepartmentApprovalMatrix
                participants={state.participants}
                approvals={state.approvals}
                currentRevisionId={draft.currentRevisionId}
                organizations={organizations}
                profiles={profiles}
              />
              <CollaborationReadiness
                participants={state.participants}
                approvals={state.approvals}
                currentRevisionId={draft.currentRevisionId}
                readiness={state.readiness}
                organizations={organizations}
                profiles={profiles}
                committed={isCommittedDraft}
              />
              {canDecide && (
                <CollaborationDecisionPanel
                  organizations={organizations}
                  eligibleOrganizations={eligibleReviewOrganizations}
                  selectedOrgId={reviewOrganization?.orgId}
                  busy={busy}
                  onSelectOrg={setActingOrgId}
                  onDecide={(decision, reason) =>
                    act(
                      async () => {
                        await decideCollaborationReview({
                          draftId,
                          organizationId: reviewOrganization!.orgId,
                          decision,
                          reason,
                        });
                      },
                      "Your office decision was recorded.",
                      true,
                    )
                  }
                />
              )}
            </div>
          )}
        </main>
        {!isCommittedDraft && (
          <aside className="space-y-3">
            {tab !== "approvals" && (
              <CollaborationReadiness
                participants={state.participants}
                approvals={state.approvals}
                currentRevisionId={draft.currentRevisionId}
                readiness={state.readiness}
                organizations={organizations}
                departmentOnly={departmentOnly}
              />
            )}
            <CollaborationActionRail
              departmentOnly={departmentOnly}
              isOwner={isOwner}
              ownerName={ownerOrg?.name}
              status={draft.status}
              readiness={state.readiness}
              busy={busy}
              hasRevision={Boolean(draft.currentRevisionId)}
              onRequestReview={() =>
                act(
                  async () => {
                    await requestCollaborationReview(draftId);
                  },
                  "Approval requests sent.",
                  true,
                )
              }
              onCommit={() =>
                act(
                  async () => {
                    if (departmentOnly)
                      await publishDepartmentProposal(draftId);
                    else
                      await commitCollaborationDraft(
                        draftId,
                        draft.currentRevisionId!,
                      );
                    onCommitted();
                  },
                  departmentOnly
                    ? "Office proposal published. Operational projects and tasks are now available."
                    : "Proposal published. Operational projects and tasks are now available.",
                  true,
                )
              }
              onDelete={(reason) =>
                act(
                  async () => {
                    await deleteCollaborationDraft(draftId, reason);
                    onBack();
                  },
                  departmentOnly
                    ? "Office proposal draft deleted."
                    : "Collaboration draft deleted with its governance history retained.",
                  true,
                )
              }
            />
          </aside>
        )}
      </div>
      {secondaryTab && (
        <aside
          className="eflow-collaboration-inspector"
          aria-label="Collaboration workspace tool"
          role="dialog"
          aria-modal="false"
        >
          <header className="eflow-collaboration-inspector__header">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                Workspace tool
              </span>
              <h2 className="m-0 text-base font-bold text-neutral-900">
                {secondaryTab === "source"
                  ? "Source PDF"
                  : secondaryTab === "people"
                    ? "Team roster"
                    : secondaryTab === "budget"
                      ? "Budget"
                      : secondaryTab === "changes"
                        ? "Requested changes"
                        : secondaryTab === "governance"
                          ? "Governance"
                          : "Plan update history"}
              </h2>
            </div>
            <button
              type="button"
              className="text-xs font-medium text-blue-600 hover:underline"
              onClick={() => {
                void requestNavigation(() => setSecondaryTab(null));
              }}
            >
              Close
            </button>
          </header>
          <div className="eflow-collaboration-inspector__body">
            {secondaryTab === "source" && (
              <CollaborationSourcePanel
                draft={draft}
                canUpload={
                  isOwner &&
                  !["committed", "archived", "deleted"].includes(draft.status)
                }
                onUploaded={state.refresh}
              />
            )}
            {secondaryTab === "budget" && (
              <CollaborationBudgetPanel
                snapshot={snapshot}
                fundingOwnerName={ownerOrg?.name}
                editable={
                  isOwner &&
                  !["committed", "archived", "deleted"].includes(draft.status)
                }
                onSave={saveRevision}
              />
            )}
            {secondaryTab === "people" && (
              <StaffingReviewPanel
                snapshot={snapshot}
                organizations={organizations}
                profiles={profiles}
                editableOrgId={reviewOrganization?.orgId}
                canEditAll={isOwner}
                onSave={saveStaffingRevision}
                onRecommend={
                  isOwner && draft.status === "draft"
                    ? async () =>
                        (await recommendCollaborationAssignments(draftId))
                          .recommendations
                    : undefined
                }
              />
            )}
            {secondaryTab === "changes" && (
              <ChangeRequestsPanel
                requests={state.changeRequests}
                organizations={organizations}
                profiles={profiles}
                canRequest={canDecide && !isOwner}
                canResolve={isOwner}
                onCreate={(input) =>
                  act(async () => {
                    await createCollaborationChangeRequest({
                      draftId,
                      organizationId: reviewOrganization?.orgId,
                      ...input,
                    });
                  }, "Formal revision request submitted.")
                }
                onResolve={(id, status) =>
                  act(async () => {
                    await resolveCollaborationChangeRequest(id, status);
                  }, `Change request ${status}.`)
                }
              />
            )}
            {secondaryTab === "revisions" && (
              <RevisionTimeline
                revisions={state.revisions}
                profiles={profiles}
              />
            )}
            {secondaryTab === "governance" && !departmentOnly && (
              <GovernanceWorkspace
                draft={draft}
                snapshot={snapshot}
                revision={currentRevision}
                revisions={state.revisions}
                participants={state.participants}
                approvals={state.approvals}
                changeRequests={state.changeRequests}
                governance={governance}
                organizations={organizations}
                profiles={profiles}
                operationalTasks={delivery.tasks}
                isOwner={isOwner}
                actingOrgId={reviewOrganization?.orgId}
                busy={busy}
                onAct={act}
                onRefresh={async () => {
                  await Promise.all([state.refresh(), governance.refresh()]);
                }}
                onSaveRevision={saveRevision}
              />
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
