import * as React from "react";
import { useReviewedMutation } from "../../../shared/useReviewedMutation";
import type { CollaborationDraft, ProposalGovernanceState } from "../types";
import type { Organization } from "../../../types";

export function useGovernanceSafety({
  draft,
  isOwner,
  actingOrgId,
  governance,
  organizations,
  performAction,
  onRefresh,
}: {
  draft: CollaborationDraft;
  isOwner: boolean;
  actingOrgId?: string;
  governance: ProposalGovernanceState;
  organizations: Organization[];
  performAction: (
    operation: () => Promise<void>,
    success: string,
  ) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [receipts, setReceipts] = React.useState<Record<string, number>>({});
  const safety = useReviewedMutation(`${draft.id}:${actingOrgId || ""}`);
  const latest = React.useRef({ draft, isOwner, actingOrgId, governance });
  latest.current = { draft, isOwner, actingOrgId, governance };
  const onAct = async (
    operation: () => Promise<void>,
    success: string,
    impact?: React.ReactNode,
  ) => {
    const labels: Record<string, string> = {
      "Governance roster and approval policy saved.":
        "Save governance roster and approval policy",
      "Task review route updated.": "Update task review route",
      "Recusal recorded and delegation updated.":
        "Record recusal and delegation",
      "Proposal closeout requested.": "Request proposal closeout",
      "Closeout decision recorded.": "Record closeout decision",
      "Proposal delivery completed atomically.": "Complete proposal delivery",
      "Proposal archived. Linked tasks were removed from active Task Boards.":
        "Archive proposal delivery",
      "Formal governance record saved.": "Save formal governance record",
    };
    const label = labels[success] || "Confirm governance change";
    const severe =
      label === "Complete proposal delivery" ||
      label === "Archive proposal delivery";
    await safety.run({
      key: `${label}:${draft.currentRevisionId || ""}:${draft.status}:${JSON.stringify(governance)}`,
      confirmation: {
        title: `${label}?`,
        description: `“${draft.title}” · ${organizations.find((org) => org.id === actingOrgId)?.name || "Plan owner"}. Review the official record change before continuing.`,
        actionLabel: label,
        danger: severe,
        confirmationText: severe ? draft.title : undefined,
        impact: (
          <div className="space-y-3">
            {impact}
            <p>
              Current plan: {draft.status.replace(/_/g, " ")} · revision{" "}
              {draft.currentRevisionNumber || 1}. Existing server checks apply
              to the current approval, task, evidence and financial state.
            </p>
          </div>
        ),
      },
      validate: () => {
        const current = latest.current;
        if (
          current.draft.id !== draft.id ||
          current.draft.currentRevisionId !== draft.currentRevisionId ||
          current.draft.status !== draft.status ||
          current.isOwner !== isOwner ||
          current.actingOrgId !== actingOrgId ||
          JSON.stringify(current.governance) !== JSON.stringify(governance)
        )
          throw new Error(
            "The plan or your authority changed. Refresh and review the current action.",
          );
      },
      operation: async () => {
        let saved = false;
        let failure: unknown;
        try {
          await performAction(async () => {
            try {
              await operation();
              saved = true;
            } catch (error) {
              failure = error;
              throw error;
            }
          }, success);
        } catch (error) {
          // The service receipt precedes the parent's refresh/toast. Preserve it.
          if (!saved) throw error;
        }
        if (!saved)
          throw (
            failure || new Error("The governance action could not be verified.")
          );
      },
      success,
      onSaved: () =>
        setReceipts((current) => ({
          ...current,
          [label]: (current[label] || 0) + 1,
        })),
      refresh: onRefresh,
    });
  };
  return { safety, receipts, onAct };
}
