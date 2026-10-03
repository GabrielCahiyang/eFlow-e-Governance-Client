import { useMemo, useState, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  History,
  Shield,
  ShieldCheck,
} from "lucide-react";
import type { Organization, UserProfile } from "../../../../types";
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
import { SectionEmpty, LoadingState, formatDate } from "../../../../components/workflow/primitives";

export function ProjectProposalContextTab({
  draftId,
  organizations,
  profiles: _profiles,
}: {
  draftId: string | null;
  organizations: Organization[];
  profiles?: UserProfile[];
}) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const state = useCollaborationDraft(draftId);
  const governance = useProposalGovernance(draftId);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [changeFormOpen, setChangeFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actingOrgId, setActingOrgId] = useState("");
  const [memberships, setMemberships] = useState<
    Array<{ organizationId: string; membershipRole: string }>
  >([]);

  useEffect(() => {
    if (userProfile?.id && draftId) {
      void fetchMyCollaborationMemberships(userProfile.id)
        .then(setMemberships)
        .catch(() => setMemberships([]));
    }
  }, [draftId, userProfile?.id]);

  const homeOrgId = userProfile?.org_id || userProfile?.departmentId || "";
  const approverOrgIds = useMemo(
    () =>
      new Set(
        [
          ...(["head", "head"].includes(
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

  const eligibleReviewOrganizations = useMemo(
    () =>
      state.participants.filter(
        (participant) =>
          isExternalReviewParticipant(participant) &&
          approverOrgIds.has(participant.orgId),
      ),
    [approverOrgIds, state.participants],
  );

  useEffect(() => {
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

  if (!draftId) {
    return (
      <div className="bg-white border border-neutral-200/80 rounded-2xl p-12 text-center shadow-xs">
        <SectionEmpty
          icon={<FileText size={36} className="text-neutral-400" />}
          title="No Originating Proposal"
          description="This project was created directly in the workspace without an AI PDF proposal import or collaboration draft."
        />
      </div>
    );
  }

  if (state.loading) {
    return (
      <div className="p-8">
        <LoadingState label="Loading proposal and governance context…" />
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="bg-white border border-neutral-200/80 rounded-2xl p-12 text-center shadow-xs">
        <SectionEmpty
          icon={<AlertTriangle size={36} className="text-amber-500" />}
          title="Proposal Context Unavailable"
          description="The source proposal for this project could not be found or has been archived."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Proposal Summary Card */}
      <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10.5px] font-bold uppercase tracking-wider">
                <FileCheck2 size={12} /> Originating Proposal
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full border border-neutral-200 bg-neutral-50 text-[11px] font-semibold text-neutral-700 capitalize">
                Status: {draft.status.replace(/_/g, " ")}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-neutral-100 text-[10.5px] font-bold text-neutral-600">
                Revision #{currentRevision?.revisionNumber || draft.currentRevisionNumber || 1}
              </span>
            </div>

            <h2 className="text-xl font-black text-neutral-900 tracking-tight">
              {draft.title}
            </h2>

            {draft.snapshot?.description && (
              <p className="text-xs text-neutral-600 leading-relaxed max-w-3xl pt-1">
                {draft.snapshot.description}
              </p>
            )}
          </div>

          {draft.sourceFilePath && (
            <div className="shrink-0">
              <button
                type="button"
                onClick={handleOpenPdf}
                disabled={pdfLoading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <FileText size={14} />
                <span>{pdfLoading ? "Opening PDF…" : "View source PDF"}</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-neutral-100 text-xs">
          <div>
            <div className="text-neutral-400 font-semibold text-[10.5px] uppercase tracking-wider">Originating Office</div>
            <div className="font-bold text-neutral-800 mt-0.5">{ownerOrg?.name || "Direct Lead"}</div>
          </div>
          <div>
            <div className="text-neutral-400 font-semibold text-[10.5px] uppercase tracking-wider">Planning Anchor</div>
            <div className="font-bold text-neutral-800 mt-0.5">{draft.snapshot?.planningAnchor || "Operational Work Plan"}</div>
          </div>
          <div>
            <div className="text-neutral-400 font-semibold text-[10.5px] uppercase tracking-wider">Created Date</div>
            <div className="font-bold text-neutral-800 mt-0.5">{formatDate(draft.createdAt)}</div>
          </div>
          <div>
            <div className="text-neutral-400 font-semibold text-[10.5px] uppercase tracking-wider">Committed To Delivery</div>
            <div className="font-bold text-neutral-800 mt-0.5">{draft.committedAt ? formatDate(draft.committedAt) : "Active in delivery"}</div>
          </div>
        </div>
      </div>

      {/* 2-Column Grid: Approval Matrix & Changes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Department Approval Matrix & Decision Action */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck size={16} className="text-indigo-600" />
                  <span>Office Approval Matrix</span>
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Endorsement and review status from all participating offices.
                </p>
              </div>
            </div>

            <div className="divide-y divide-neutral-100">
              {state.participants.map((participant) => {
                const org = organizations.find((o) => o.id === participant.orgId);
                const approval = state.approvals.find(
                  (a) =>
                    a.revisionId === draft.currentRevisionId &&
                    a.organizationId === participant.orgId,
                );
                const isOwner = participant.participationRole === "owner";
                const isApproved = approval?.decision === "approved" || isOwner;

                return (
                  <div
                    key={participant.orgId}
                    className="py-3.5 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-900 truncate">
                          {org?.name || participant.orgId}
                        </span>
                        {isOwner ? (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                            Owner / Author
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded capitalize">
                            {participant.participationRole}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        {isOwner
                          ? "Authored and committed the work plan"
                          : approval
                            ? `Decided on ${formatDate(approval.createdAt)}`
                            : "Awaiting review and approval decision"}
                      </div>
                    </div>

                    <div>
                      {isApproved ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={13} /> Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock size={13} /> Pending
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Decision Action Form (if authorized) */}
          {canDecide && (
            <div className="space-y-4 rounded-2xl border border-primary/25 bg-card p-6 shadow-xs">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-primary" />
                <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                  Review &amp; Approval Decision
                </h3>
              </div>
              <p className="text-xs text-neutral-600">
                You are authorized to record a formal approval or request revisions on behalf of{" "}
                <strong className="text-neutral-800">{reviewOrganization?.orgId}</strong>.
              </p>

              {changeFormOpen ? (
                <div className="space-y-3 pt-2">
                  <textarea
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    placeholder="Describe specific changes or clarifications required before signing off…"
                    className="h-24 w-full rounded-xl border border-neutral-300 p-3 text-xs focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRequestChanges}
                      disabled={busy || !changeReason.trim()}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      {busy ? "Submitting…" : "Submit Revision Request"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setChangeFormOpen(false)}
                      className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={busy}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 size={14} />
                    <span>{busy ? "Recording…" : "Approve & Sign Off"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChangeFormOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-semibold cursor-pointer"
                  >
                    <AlertTriangle size={14} className="text-amber-500" />
                    <span>Request Changes</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right 1 Col: Revision History & Changes Requested */}
        <div className="space-y-6">
          <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                <History size={15} className="text-neutral-400" />
                <span>Revision History</span>
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              {state.revisions.map((rev) => (
                <div key={rev.id} className="space-y-1 pb-3 border-b border-neutral-100 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-900">
                      Revision #{rev.revisionNumber}
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      {formatDate(rev.createdAt)}
                    </span>
                  </div>
                  {rev.changeSummary && (
                    <p className="text-neutral-600 text-[11.5px] leading-relaxed">
                      {rev.changeSummary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {openChanges.length > 0 && (
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle size={15} className="text-amber-500" />
                  <span>Open Change Requests</span>
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                {openChanges.map((req) => (
                  <div key={req.id} className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1">
                    <div className="font-semibold text-amber-900">{req.reason}</div>
                    <div className="text-[10.5px] text-amber-700">Requested on {formatDate(req.createdAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Source PDF Preview Dialog */}
      {pdfPreviewUrl && (
        <SourcePdfPreviewDialog
          onClose={() => setPdfPreviewUrl(null)}
          url={pdfPreviewUrl}
          title={draft.sourceFileName || `${draft.title}.pdf`}
        />
      )}
    </div>
  );
}
