import {
  Button,
  EmptyState,
  Label,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@vibe/core";
import { Open } from "@vibe/icons";
import type { Organization } from "../../../types";
import { COLLABORATION_STATUS_LABELS } from "../constants";
import { isActiveCollaborationDraft } from "../selectors/draftVisibility";
import type { CollaborationDraft } from "../types";

export function CollaborationDraftList({
  drafts,
  organizations,
  mode,
  currentOrgId,
  accessibleOrgIds = [],
  showAll = false,
  onOpen,
}: {
  drafts: CollaborationDraft[];
  organizations: Organization[];
  mode: "owned" | "waiting" | "incoming";
  currentOrgId: string;
  accessibleOrgIds?: string[];
  showAll?: boolean;
  onOpen: (draftId: string) => void;
}) {
  const accessible = new Set(
    [currentOrgId, ...accessibleOrgIds].filter(Boolean),
  );
  const rows = drafts
    .filter(isActiveCollaborationDraft)
    .filter((draft) =>
      showAll
        ? true
          : mode === "owned"
          ? draft.ownerOrgId === currentOrgId
          : mode === "waiting"
            ? draft.ownerOrgId === currentOrgId && ["in_review", "changes_requested"].includes(draft.status)
            : ["in_review", "changes_requested", "ready_to_commit"].includes(draft.status) && draft.snapshot.organizations.some(
              (org) =>
                org.participationRole !== "owner" && accessible.has(org.orgId),
            ),
    );

  if (!rows.length) {
    return (
      <EmptyState
        title={
          mode === "owned"
            ? "No work plans in preparation"
            : mode === "waiting"
              ? "No work plans waiting for approval"
              : "No incoming reviews"
        }
        description={
          mode === "owned"
            ? "Create a custom work plan or import a document when work is ready to be coordinated across offices."
            : mode === "waiting"
              ? "Work plans awaiting partner decisions will appear here."
              : "You're caught up. Work plans waiting for your review will appear here."
        }
      />
    );
  }

  // --- Incoming Reviews: Decision Queue Layout ---
  if (mode === "incoming" || mode === "waiting") {
    const columns = [
      "proposal",
      "requested_by",
      "approval_progress",
      "waiting_time",
      "actions",
    ].map((id) => ({ id, title: id }));

    return (
      <section className="eflow-decision-card">
        <header className="eflow-decision-header">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="m-0 text-base font-bold text-neutral-900">
                {mode === "waiting" ? "Waiting for approval" : "Incoming reviews"}
              </h2>
              <Label
                text={`${rows.length} waiting`}
                color="working_orange"
              />
            </div>
            <p className="m-0 mt-1 text-xs text-secondary">
              {mode === "waiting" ? "Work plans currently awaiting partner approval." : "Proposals and work plans from partner offices waiting for your review."}
            </p>
          </div>
        </header>
        <TableContainer className="eflow-project-table">
          <Table
            columns={columns}
            emptyState={
              <EmptyState
                title="No reviews waiting"
                description="No incoming review requests require action."
              />
            }
            errorState={
              <EmptyState
                title="Reviews could not load"
                description="Try again in a moment."
              />
            }
          >
            <TableHeader>
              <TableHeaderCell title="Work plan" />
              <TableHeaderCell title="Requested by" />
              <TableHeaderCell title="Approval progress" />
              <TableHeaderCell title="Waiting" />
              <TableHeaderCell title="Action" />
            </TableHeader>
            <TableBody>
              {rows.map((draft) => {
                const owner = organizations.find(
                  (org) => org.id === draft.ownerOrgId,
                );
                const approvedCount = draft.approvedOrganizations ?? 0;
                const totalRequired =
                  draft.requiredOrganizations ??
                  draft.snapshot.organizations.length;
                return (
                  <TableRow key={draft.id} className="eflow-project-row">
                    <TableCell>
                      <Button
                        kind="tertiary"
                        size="small"
                        className="eflow-project-row-title"
                        onClick={() => onOpen(draft.id)}
                      >
                        {draft.title}
                      </Button>
                      <span className="eflow-project-row-description">
                        Revision {draft.currentRevisionNumber || 1} ·{" "}
                        {draft.sourceType === "ai_pdf"
                          ? "AI PDF proposal"
                          : "Manual work plan"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-neutral-800">
                        {owner?.name || "Organization unavailable"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-semibold text-neutral-700">
                        {approvedCount} / {totalRequired} approved
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-secondary">
                        {updatedLabel(draft.updatedAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        kind="secondary"
                        size="small"
                        rightIcon={Open}
                        onClick={() => onOpen(draft.id)}
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </section>
    );
  }

  // --- Owned Collaboration Drafts: Planning Portfolio Layout ---
  const columns = [
    "proposal",
    "owner",
    "participants",
    "approval",
    "updated",
    "actions",
  ].map((id) => ({ id, title: id }));

  return (
    <TableContainer className="eflow-project-table">
      <Table
        columns={columns}
        emptyState={
          <EmptyState
            title="No drafts"
            description="There are no matching collaboration drafts."
          />
        }
        errorState={
          <EmptyState
            title="Collaboration drafts could not load"
            description="Try again in a moment."
          />
        }
      >
        <TableHeader>
          <TableHeaderCell title="Work plan" />
          <TableHeaderCell title="Owner office" />
          <TableHeaderCell title="Participating offices" />
          <TableHeaderCell title="Review status" />
          <TableHeaderCell title="Updated" />
          <TableHeaderCell title="Actions" />
        </TableHeader>
        <TableBody>
          {rows.map((draft) => {
            const owner = organizations.find(
              (org) => org.id === draft.ownerOrgId,
            );
            const participants = draft.snapshot.organizations
              .map(
                (selection) =>
                  organizations.find((org) => org.id === selection.orgId)?.name,
              )
              .filter(Boolean);
            const reviewStatus =
              draft.status === "ready_to_commit"
                ? "Ready to commit"
                : COLLABORATION_STATUS_LABELS[draft.status];
            return (
              <TableRow key={draft.id} className="eflow-project-row">
                <TableCell>
                  <Button
                    kind="tertiary"
                    size="small"
                    className="eflow-project-row-title"
                    onClick={() => onOpen(draft.id)}
                  >
                    {draft.title}
                  </Button>
                  <span className="eflow-project-row-description">
                    Revision {draft.currentRevisionNumber || 1} ·{" "}
                    {draft.sourceType === "ai_pdf"
                      ? "AI PDF proposal"
                      : "Manual work plan"}
                  </span>
                </TableCell>
                <TableCell>
                  {owner?.name || "Organization unavailable"}
                </TableCell>
                <TableCell>
                  {participants.join(", ") || "No participants"}
                </TableCell>
                <TableCell>
                  <Label
                    text={reviewStatus}
                    color={
                      draft.status === "changes_requested"
                        ? "negative"
                        : draft.status === "ready_to_commit"
                          ? "positive"
                          : "primary"
                    }
                  />
                </TableCell>
                <TableCell>{updatedLabel(draft.updatedAt)}</TableCell>
                <TableCell>
                  <Button
                    kind="tertiary"
                    size="small"
                    rightIcon={Open}
                    onClick={() => onOpen(draft.id)}
                  >
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function updatedLabel(updatedAt: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - updatedAt) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}
