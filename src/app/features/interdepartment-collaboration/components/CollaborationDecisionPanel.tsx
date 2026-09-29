import * as React from "react";
import { Button } from "@vibe/core";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import type { Organization } from "../../../types";
import { PARTICIPATION_ROLE_LABELS } from "../constants";
import type { CollaborationDecision, CollaborationParticipant } from "../types";

export function CollaborationDecisionPanel({
  organizations,
  eligibleOrganizations,
  selectedOrgId,
  busy,
  onSelectOrg,
  onDecide,
}: {
  organizations: Organization[];
  eligibleOrganizations: CollaborationParticipant[];
  selectedOrgId?: string;
  busy: boolean;
  onSelectOrg: (orgId: string) => void;
  onDecide: (decision: CollaborationDecision, reason: string) => Promise<void>;
}) {
  const [decision, setDecision] = React.useState<CollaborationDecision | null>(
    null,
  );
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState("");
  const selected =
    eligibleOrganizations.find((item) => item.orgId === selectedOrgId) ||
    eligibleOrganizations[0];

  const actingOrgName =
    organizations.find((org) => org.id === selected?.orgId)?.name ||
    "Authorized Department";

  return (
    <section className="eflow-section-card">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2>Department participation approval</h2>
          <p className="m-0 mt-1 text-xs text-secondary">
            Formal department approval or revision request on the active proposal snapshot.
          </p>
        </div>

        {eligibleOrganizations.length > 1 && (
          <select
            value={selected?.orgId}
            onChange={(event) => onSelectOrg(event.target.value)}
            className="eflow-control"
            aria-label="Acting department selector"
          >
            {eligibleOrganizations.map((participant) => (
              <option key={participant.orgId} value={participant.orgId}>
                {organizations.find((org) => org.id === participant.orgId)?.name}{" "}
                · {PARTICIPATION_ROLE_LABELS[participant.participationRole]}
              </option>
            ))}
          </select>
        )}
      </header>

      <div className="p-5">
        <div className="flex items-center gap-2 text-xs text-secondary mb-4">
          <span>Acting on behalf of:</span>
          <span className="font-semibold text-neutral-900">{actingOrgName}</span>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Button
            data-testid="approve-collaboration-revision"
            size="small"
            onClick={() => setDecision("approved")}
          >
            <CheckCircle2 size={14} className="mr-1.5" />
            Approve participation
          </Button>

          <Button
            kind="secondary"
            size="small"
            onClick={() => setDecision("changes_requested")}
          >
            <Clock3 size={14} className="mr-1.5 text-amber-600" />
            Request changes
          </Button>

          <Button
            kind="tertiary"
            size="small"
            onClick={() => setDecision("declined")}
          >
            <XCircle size={14} className="mr-1.5 text-red-600" />
            Decline
          </Button>
        </div>

        {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
        {decision && (
          <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50/70 p-4">
            <div className="text-xs font-semibold text-neutral-900 mb-2">
              {decision === "approved"
                ? "Approval note (optional)"
                : "Why are updates needed or participation declined?"}
            </div>
            <p className="mb-2 text-xs text-neutral-600">{decision === "approved" ? "Confirm that your department agrees to its responsibilities and assigned staff in this saved work plan." : "The lead department will receive your decision and explanation."}</p>
            <textarea
              aria-label="Decision explanation"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder={
                decision === "approved"
                  ? "Add optional comments or endorsement details…"
                  : "Provide specific details on what changes are needed before approval…"
              }
              className="eflow-control w-full h-auto py-2 leading-relaxed"
            />

            <div className="mt-3 flex justify-end gap-2">
              <Button
                kind="tertiary"
                size="small"
                onClick={() => {
                  setDecision(null);
                  setReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                data-testid="confirm-collaboration-decision"
                size="small"
                disabled={
                  busy ||
                  !selected ||
                  (decision !== "approved" && !reason.trim())
                }
                onClick={async () => {
                  setError("");
                  try { await onDecide(decision, reason); setDecision(null); setReason(""); }
                  catch (failure) { setError(failure instanceof Error ? failure.message : "Decision could not be saved."); }
                }}
              >
                {busy ? "Recording…" : "Confirm decision"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
