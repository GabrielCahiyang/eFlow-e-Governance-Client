import * as React from "react";
import { Button, Label, Loader } from "@vibe/core";
import { Check, Update } from "@vibe/icons";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  History,
  Shield,
  X,
} from "lucide-react";
import type { Organization } from "../../../../types";
import { useAuth } from "../../../../contexts/AuthContext";
import { useToast } from "../../../../components/ui/Toast";
import { useCollaborationDraft } from "../../../interdepartment-collaboration/hooks/useCollaborationDraft";
import {
  fetchMyCollaborationMemberships,
  getCollaborationSourceUrl,
} from "../../../interdepartment-collaboration/services/collaborationDraftService";
import {
  createCollaborationChangeRequest,
  decideCollaborationReview,
} from "../../../interdepartment-collaboration/services/collaborationReviewService";
import { isExternalReviewParticipant } from "../../../interdepartment-collaboration/selectors/organizationEligibility";
import { useProposalGovernance } from "../../../interdepartment-collaboration/hooks/useProposalGovernance";
import { SourcePdfPreviewDialog } from "../../../interdepartment-collaboration/components/SourcePdfPreviewDialog";
import { InspectorPanel } from "../../../../shared/motion";

export function ProposalContextInspector({
  draftId,
  open,
  onClose,
  organizations,
}: {
  draftId: string | null;
  open: boolean;
  onClose: () => void;
  organizations: Organization[];
  profiles?: any[];
}) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const state = useCollaborationDraft(open ? draftId : null);
  const governance = useProposalGovernance(open ? draftId : null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = React.useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = React.useState(false);
  const [changeReason, setChangeReason] = React.useState("");
  const [changeFormOpen, setChangeFormOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [actingOrgId, setActingOrgId] = React.useState("");
  const [memberships, setMemberships] = React.useState<
    Array<{ organizationId: string; membershipRole: string }>
  >([]);

  React.useEffect(() => {
    if (userProfile?.id && open) {
      void fetchMyCollaborationMemberships(userProfile.id)
        .then(setMemberships)
        .catch(() => setMemberships([]));
    }
  }, [open, userProfile?.id]);

  const homeOrgId = userProfile?.org_id || userProfile?.departmentId || "";
  const approverOrgIds = React.useMemo(
    () =>
      new Set(
        [
          ...(["dept_head", "department_head", "assistant_head"].includes(
            userProfile?.role || "",
          )
            ? [homeOrgId]
            : []),
          ...memberships
            .filter((item) => item.membershipRole !== "member")
            .map((item) => item.organizationId),
          ...governance.assignments
            .filter(
              (item) =>
                item.userId === userProfile?.id &&
                [
                  "primary_approver",
                  "backup_approver",
                  "delegate",
                ].includes(item.role),
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
    eligibleReviewOrganizations.find((p) => p.orgId === actingOrgId) ||
    eligibleReviewOrganizations[0];

  const currentOrganizationApproval = state.approvals.find(
    (approval) =>
      approval.revisionId === state.draft?.currentRevisionId &&
      approval.organizationId === reviewOrganization?.orgId,
  );

  const canDecide = Boolean(
    reviewOrganization &&
      !currentOrganizationApproval?.decision.includes("approved") &&
      state.draft &&
      [
        "in_review",
        "changes_requested",
        "ready_to_commit",
        "committed",
      ].includes(state.draft.status),
  );

  const draft = state.draft;
  const ownerOrg = draft
    ? organizations.find((org) => org.id === draft.ownerOrgId)
    : null;
  const currentRevision = state.revisions.find(
    (r) => r.id === draft?.currentRevisionId,
  );
  const openChanges = state.changeRequests.filter((c) => c.status === "open");

  const handleOpenPdf = async () => {
    if (!draft?.sourceFilePath) return;
    setPdfLoading(true);
    try {
      const url = await getCollaborationSourceUrl(draft.sourceFilePath);
      setPdfPreviewUrl(url);
    } catch (error: any) {
      toast(error?.message || "Could not open source PDF.", "error");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!draftId || !reviewOrganization) return;
    setBusy(true);
    try {
      await decideCollaborationReview({
        draftId,
        organizationId: reviewOrganization.orgId,
        decision: "approved",
      });
      await state.refresh();
      toast("Approval recorded successfully for your office.", "success");
    } catch (error: any) {
      toast(error?.message || "Could not record approval.", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!draftId || !reviewOrganization || !changeReason.trim()) return;
    setBusy(true);
    try {
      await createCollaborationChangeRequest({
        draftId,
        organizationId: reviewOrganization.orgId,
        reason: changeReason.trim(),
        targetType: "proposal",
        targetKey: "proposal",
      });
      await state.refresh();
      setChangeReason("");
      setChangeFormOpen(false);
      toast(
        "Revision request submitted to the originating lead office.",
        "success",
      );
    } catch (error: any) {
      toast(error?.message || "Could not submit revision request.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <InspectorPanel
        open={open}
        onClose={onClose}
        ariaLabel="Proposal context inspector"
        className="w-full max-w-[460px]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Proposal Context
              </span>
            </div>
            <h2 className="mt-1 truncate text-base font-bold text-neutral-900">
              {draft?.title ||
                (state.loading
                  ? "Loading proposal…"
                  : "Originating Proposal")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition"
            aria-label="Close proposal context"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {state.loading ? (
            <div className="flex min-h-[260px] items-center justify-center gap-2 text-sm text-neutral-500">
              <Loader size="medium" /> Loading proposal context…
            </div>
          ) : !draft ? (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5 text-center text-sm text-neutral-500">
              {draftId
                ? "This project originated from a plan that could not be loaded."
                : "This is a standalone project without an originating collaborative proposal."}
            </div>
          ) : (
            <>
              {/* 1. Originating Summary Card */}
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500">
                    Originating Department
                  </span>
                  <span className="text-xs font-semibold text-neutral-800">
                    {ownerOrg?.name || "Department"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500">
                    Source Format
                  </span>
                  <span className="text-xs font-semibold text-neutral-800">
                    {draft.sourceType === "ai_pdf"
                      ? "Document Import (PDF)"
                      : "Custom Work Plan"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500">
                    Current Version
                  </span>
                  <span className="text-xs font-semibold text-neutral-800">
                    Version {currentRevision?.revisionNumber || 1}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500">
                    Governance Status
                  </span>
                  <Label
                    text={draft.status.replace(/_/g, " ")}
                    color={
                      draft.status === "committed"
                        ? "positive"
                        : draft.status === "changes_requested"
                          ? "negative"
                          : "primary"
                    }
                  />
                </div>
              </div>

              {/* 2. Approval / Approvals Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    Office Approval Progress
                  </h3>
                  <span className="text-xs text-neutral-500">
                    {
                      state.participants.filter(
                        (p) => p.participationRole !== "owner",
                      ).length
                    }{" "}
                    offices
                  </span>
                </div>

                <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
                  {state.participants.map((participant) => {
                    const org = organizations.find(
                      (o) => o.id === participant.orgId,
                    );
                    const approval = state.approvals.find(
                      (a) =>
                        a.organizationId === participant.orgId &&
                        a.revisionId === draft.currentRevisionId,
                    );
                    const isLead =
                      participant.participationRole === "owner";
                    return (
                      <div
                        key={participant.orgId}
                        className="flex items-center justify-between p-3"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <strong className="block truncate text-xs font-semibold text-neutral-900">
                            {org?.name || "Organization"}
                          </strong>
                          <span className="block text-[11px] text-neutral-400">
                            {isLead
                              ? "Lead Authoring Office"
                              : participant.participationRole ===
                                  "participant"
                                ? "Participating Office"
                                : "Approving Office"}
                          </span>
                        </div>
                        {isLead ? (
                          <Label text="Lead Office" color="primary" />
                        ) : approval?.decision === "approved" ? (
                          <Label text="Signed off" color="positive" />
                        ) : approval?.decision === "changes_requested" ? (
                          <Label text="Revisions requested" color="negative" />
                        ) : (
                          <Label text="Waiting" color="working_orange" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Revision Requests Section */}
              {openChanges.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-amber-600" />
                      Pending Revision Requests ({openChanges.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {openChanges.map((change) => {
                      const requestingOrg = organizations.find(
                        (o) => o.id === change.requestingOrgId,
                      );
                      return (
                        <div
                          key={change.id}
                          className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs"
                        >
                          <div className="flex items-center justify-between text-[11px] text-amber-800 font-medium">
                            <span>{requestingOrg?.name || "Office"}</span>
                            <span>
                              {new Date(change.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="mt-1.5 text-neutral-800 whitespace-normal">
                            {change.reason}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. Original Source Document */}
              {draft.sourceFilePath && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
                    <FileText size={14} className="text-blue-600" />
                    Originating Source Document
                  </h3>
                  <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50/50 p-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0">
                        <strong className="block truncate text-xs font-semibold text-neutral-900">
                          {draft.sourceFileName || `${draft.title}.pdf`}
                        </strong>
                        <span className="block text-[11px] text-neutral-400">
                          PDF Document
                        </span>
                      </div>
                    </div>
                    <Button
                      kind="tertiary"
                      size="small"
                      disabled={pdfLoading}
                      onClick={() => void handleOpenPdf()}
                    >
                      {pdfLoading ? "Loading…" : "Preview PDF"}
                    </Button>
                  </div>
                </div>
              )}

              {/* 5. Version History */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
                  <History size={14} className="text-neutral-500" />
                  Version History
                </h3>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {state.revisions.map((rev) => (
                    <div
                      key={rev.id}
                      className={`rounded-lg border p-2.5 text-xs ${
                        rev.id === draft.currentRevisionId
                          ? "border-blue-200 bg-blue-50/50"
                          : "border-neutral-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-neutral-900">
                          Version {rev.revisionNumber}
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          {new Date(rev.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-1 text-neutral-600 line-clamp-2">
                        {rev.changeSummary || "Proposal revision published."}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 6. Contextual Decision Actions */}
              {canDecide && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <Shield size={16} className="text-blue-700 mt-0.5" />
                    <div>
                      <strong className="block text-xs font-bold text-blue-900">
                        Approval for{" "}
                        {reviewOrganization?.orgId
                          ? organizations.find(
                              (o) => o.id === reviewOrganization.orgId,
                            )?.name
                          : "Your Office"}
                      </strong>
                      <p className="mt-0.5 text-[11px] text-blue-800">
                        As a department officer, you can record approval or
                        request revisions.
                      </p>
                    </div>
                  </div>

                  {!changeFormOpen ? (
                    <div className="flex items-center gap-2">
                      <Button
                        kind="primary"
                        size="small"
                        leftIcon={Check}
                        disabled={busy}
                        onClick={() => void handleApprove()}
                      >
                        Approve proposal
                      </Button>
                      <Button
                        kind="secondary"
                        size="small"
                        leftIcon={Update}
                        disabled={busy}
                        onClick={() => setChangeFormOpen(true)}
                      >
                        Request changes
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-2 border-t border-blue-200/60">
                      <label className="block text-[11px] font-semibold text-neutral-700">
                        Revision Request Notes:
                      </label>
                      <textarea
                        rows={3}
                        value={changeReason}
                        onChange={(e) => setChangeReason(e.target.value)}
                        placeholder="Describe the required changes for the originating office…"
                        className="w-full rounded-lg border border-neutral-300 p-2 text-xs focus:border-blue-500 focus:outline-none"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          kind="primary"
                          size="small"
                          disabled={busy || !changeReason.trim()}
                          onClick={() => void handleRequestChanges()}
                        >
                          Submit request
                        </Button>
                        <Button
                          kind="tertiary"
                          size="small"
                          onClick={() => {
                            setChangeFormOpen(false);
                            setChangeReason("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </InspectorPanel>

      {/* PDF Dialog if requested */}
      {pdfPreviewUrl && (
        <SourcePdfPreviewDialog
          title={draft?.title || "Source Document"}
          url={pdfPreviewUrl}
          onClose={() => setPdfPreviewUrl(null)}
        />
      )}
    </>
  );
}
