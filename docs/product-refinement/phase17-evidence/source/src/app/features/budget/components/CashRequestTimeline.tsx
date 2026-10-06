import { useReviewedMutation } from "../../../shared/useReviewedMutation";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import type { ConfirmationOptions } from "../../../components/ui/useConfirmation";
import { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  FileText,
  ReceiptText,
  RotateCcw,
  XCircle,
} from "lucide-react";
import type { DepartmentBudgetBundle, PettyCashRequest } from "../types";
import {
  acknowledgePettyCashRelease,
  cancelContextualCashRequest,
  createReceiptSignedUrl,
} from "../services/budgetService";
import { peso, StatusPill } from "./budgetUi";
import { CashLiquidationDialog } from "./CashLiquidationDialog";
import { isLiquidationCurrentlyOverdue } from "../selectors/cashWorkflowRules";

export function CashRequestTimeline({
  data,
  requests,
  currentUserId,
  orgId,
  onCorrect,
  onChanged,
}: {
  data: DepartmentBudgetBundle;
  requests: PettyCashRequest[];
  currentUserId: string;
  orgId: string;
  onCorrect: (request: PettyCashRequest) => void;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState("");
  const safety = useReviewedMutation(`${orgId}:${currentUserId}`);
  const latestRequests = useRef(requests);
  latestRequests.current = requests;
  const [liquidating, setLiquidating] = useState<PettyCashRequest>();
  const lineById = useMemo(
    () => new Map(data.allocationLines.map((line) => [line.id, line])),
    [data.allocationLines],
  );

  const act = async (
    id: string,
    operation: () => Promise<void>,
    confirmation?: ConfirmationOptions,
    validate?: () => void,
  ) => {
    if (safety.pending) return;
    setBusy(id);
    try {
      await safety.run({
        key: id,
        confirmation,
        validate,
        operation,
        success: "Funding action recorded.",
        refresh: onChanged,
      });
    } finally {
      setBusy("");
    }
  };
  const cancel = (request: PettyCashRequest) => {
    let reason = "";
    void act(
      request.id,
      () => cancelContextualCashRequest(request.id, reason),
      {
        title: "Cancel cash request?",
        description: `FR-${String(request.requestNumber).padStart(5, "0")} · ${request.purpose}. Cancelling withdraws this request; existing server checks protect released funds.`,
        actionLabel: "Cancel request",
        danger: true,
        impact: `Requested ${peso.format(request.requestedAmount)} · current status ${request.status.replace(/_/g, " ")}`,
        reason: {
          label: "Cancellation reason",
          onAccept: (value) => {
            reason = value;
          },
        },
      },
      () => {
        const current = latestRequests.current.find(
          (item) => item.id === request.id,
        );
        if (
          !current ||
          current.status !== request.status ||
          current.updatedAt !== request.updatedAt ||
          current.requesterId !== currentUserId
        )
          throw new Error(
            "The cash request changed. Review its current status before cancelling.",
          );
      },
    );
  };

  if (!requests.length && !safety.message && !safety.pending) return null;
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
        <Clock3 size={10} /> Funding activity
      </div>
      {safety.dialog}
      {safety.message && (
        <FeedbackState tone={safety.tone} title="Funding result">
          <p>{safety.message}</p>
          <button
            type="button"
            onClick={() => void onChanged().catch(() => {})}
          >
            Refresh funding
          </button>
        </FeedbackState>
      )}
      {requests.map((request) => {
        const line = request.allocationLineId
          ? lineById.get(request.allocationLineId)
          : undefined;
        const releases = data.releases.filter(
          (item) => item.requestId === request.id,
        );
        const latest = data.liquidations
          .filter((item) => item.requestId === request.id)
          .sort((left, right) => right.version - left.version)[0];
        const attachments = data.requestAttachments.filter(
          (item) => item.requestId === request.id,
        );
        const unacknowledged = releases.find(
          (item) =>
            item.status === "released" &&
            item.recipientId === currentUserId &&
            !item.acknowledgedAt,
        );
        const canCorrect =
          request.requesterId === currentUserId &&
          ["leader_changes_requested", "department_changes_requested"].includes(
            request.status,
          );
        const canCancel =
          request.requesterId === currentUserId &&
          ![
            "partially_released",
            "released",
            "liquidation_submitted",
            "pending_leader_liquidation_review",
            "pending_department_settlement",
            "changes_requested",
            "overdue_liquidation",
            "settled",
            "rejected",
            "cancelled",
            "expired",
          ].includes(request.status);
        const canLiquidate =
          request.cashRecipientId === currentUserId &&
          ["released", "changes_requested", "overdue_liquidation"].includes(
            request.status,
          );
        const liquidationOverdue =
          isLiquidationCurrentlyOverdue(request) &&
          request.status !== "settled";
        return (
          <article
            key={request.id}
            className="rounded-xl border border-neutral-200 bg-white p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <strong className="text-[10px] text-neutral-900">
                    FR-{String(request.requestNumber).padStart(5, "0")}
                  </strong>
                  <StatusPill status={request.status} />
                </div>
                <div className="mt-1 text-[10px] text-neutral-700">
                  {request.purpose}
                </div>
                {line && (
                  <div className="mt-1 text-[8.8px] text-neutral-400">
                    {line.category} · {line.particular} · {line.fundSource}
                  </div>
                )}
              </div>
              <strong className="shrink-0 text-[11px] text-neutral-900">
                {peso.format(request.approvedAmount ?? request.requestedAmount)}
              </strong>
            </div>
            <div className="mt-2 text-[8.8px] text-neutral-500">
              Operational endorsement → fiscal authorization → release →
              receipts and return
            </div>
            {request.reservationExpiresAt &&
              [
                "pending",
                "pending_leader_review",
                "pending_department_approval",
              ].includes(request.status) && (
                <div className="mt-1 text-[8.8px] text-amber-700">
                  Temporary hold—not approved spending · expires{" "}
                  {new Date(request.reservationExpiresAt).toLocaleDateString()}
                </div>
              )}
            {[
              "leader_changes_requested",
              "department_changes_requested",
            ].includes(request.status) && (
              <div className="mt-1 text-[8.8px] text-blue-700">
                No funds are held while this request is waiting for correction.
              </div>
            )}
            {attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {attachments.map((attachment) => (
                  <button
                    key={attachment.id}
                    type="button"
                    onClick={async () =>
                      window.open(
                        await createReceiptSignedUrl(attachment.filePath),
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-[8.8px] text-neutral-600"
                  >
                    <FileText size={9} /> {attachment.fileName}
                  </button>
                ))}
              </div>
            )}
            {releases.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {releases.map((release) => (
                  <span
                    key={release.id}
                    className="rounded-md bg-blue-50 px-2 py-1 text-[8.8px] text-blue-700"
                  >
                    {peso.format(release.amount)} · {release.scheduledDate} ·{" "}
                    {release.acknowledgedAt ? "received" : release.status}
                  </span>
                ))}
              </div>
            )}
            {request.liquidationDueAt &&
              !["settled", "cancelled", "rejected", "expired"].includes(
                request.status,
              ) && (
                <div
                  className={`mt-2 rounded-md px-2 py-1.5 text-[8.8px] ${liquidationOverdue ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}
                >
                  {liquidationOverdue
                    ? "Liquidation is overdue. Submission remains open, but Head approval is required."
                    : `Receipts due ${new Date(request.liquidationDueAt).toLocaleDateString()} (${data.summary?.liquidationDueDays || 15}-day window).`}
                </div>
              )}
            {latest && (
              <div className="mt-2 rounded-lg bg-neutral-50 p-2">
                <div className="flex flex-wrap items-center gap-1.5 text-[8.8px] text-neutral-500">
                  <span>Liquidation {latest.version}</span>
                  <StatusPill status={latest.status} />
                  <span>{peso.format(latest.declaredSpent)} spent</span>
                  <span>{peso.format(latest.returnedAmount)} returned</span>
                </div>
                {latest.receipts.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {latest.receipts.map((receipt) => (
                      <button
                        key={receipt.id}
                        type="button"
                        onClick={async () =>
                          window.open(
                            await createReceiptSignedUrl(receipt.filePath),
                            "_blank",
                            "noopener,noreferrer",
                          )
                        }
                        className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[8.8px] text-neutral-600"
                      >
                        <ReceiptText size={9} className="mr-1 inline" />
                        {receipt.vendor} · {peso.format(receipt.amount)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {(canCorrect || canCancel || unacknowledged || canLiquidate) && (
              <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                {canCancel && (
                  <button
                    type="button"
                    disabled={safety.pending || busy === request.id}
                    onClick={() => cancel(request)}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-rose-200 px-2 text-[8.8px] text-rose-700"
                  >
                    <XCircle size={9} /> Cancel
                  </button>
                )}
                {canCorrect && (
                  <button
                    type="button"
                    onClick={() => onCorrect(request)}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 text-[8.8px] text-amber-800"
                  >
                    <RotateCcw size={9} /> Correct
                  </button>
                )}
                {unacknowledged && (
                  <button
                    type="button"
                    disabled={safety.pending || busy === unacknowledged.id}
                    onClick={() =>
                      void act(unacknowledged.id, () =>
                        acknowledgePettyCashRelease(unacknowledged.id),
                      )
                    }
                    className="inline-flex h-7 items-center gap-1 rounded-md bg-blue-600 px-2 text-[8.8px] text-white"
                  >
                    <CheckCircle2 size={9} /> Acknowledge cash
                  </button>
                )}
                {canLiquidate && (
                  <button
                    type="button"
                    onClick={() => setLiquidating(request)}
                    className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-[8.8px] text-primary-foreground transition hover:bg-primary/90"
                  >
                    <ReceiptText size={9} />{" "}
                    {request.status === "changes_requested"
                      ? "Correct receipts"
                      : "Upload receipts"}
                  </button>
                )}
              </div>
            )}
          </article>
        );
      })}
      {liquidating && (
        <CashLiquidationDialog
          request={liquidating}
          orgId={orgId}
          perReceiptLimit={data.summary?.perReceiptLimit || 0}
          liquidationDueDays={data.summary?.liquidationDueDays || 15}
          allowReceiptOverride={Boolean(
            data.summary?.allowReceiptLimitOverride,
          )}
          onClose={() => setLiquidating(undefined)}
          onSaved={async () => {
            setLiquidating(undefined);
            await onChanged();
          }}
        />
      )}
    </div>
  );
}
