import { useMemo, useRef, useState } from "react";
import { AttentionBox, Button, Label } from "@vibe/core";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import {
  CheckCircle2,
  ExternalLink,
  ReceiptText,
  RotateCcw,
} from "lucide-react";
import {
  createReceiptSignedUrl,
  decidePettyCashLiquidation,
} from "../services/budgetService";
import type { DepartmentBudgetBundle } from "../types";
import { peso } from "./budgetUi";
import { isLiquidationLate } from "../selectors/cashWorkflowRules";
import { useAuth } from "../../../contexts/AuthContext";

import { useConfirmation } from "../../../components/ui/useConfirmation";
import { useExplicitDraft } from "../../../shared/useExplicitDraft";
import { requestNavigation } from "../../../shared/navigationGuard";
import { Button as ActionButton } from "../../../components/ui/button";
import { fetchDepartmentBudgetBundle } from "../services/budgetService";
import {
  financialOutcome,
  recordFinancialOutcome,
  financialFailureIsUncertain,
  financialErrorMessage,
} from "../financialReceipts";
export function AccountingSettlementQueue({
  data,
  onChanged,
}: {
  data: DepartmentBudgetBundle;
  onChanged: () => Promise<void>;
}) {
  const { userProfile, can } = useAuth();
  const canSettle =
    userProfile?.role === "accounting_staff" &&
    can("accounting.settle_liquidation") &&
    !(data as DepartmentBudgetBundle & { error?: string }).error;
  const items = useMemo(
    () =>
      data.liquidations.filter(
        (item) => item.status === "pending_department_settlement",
      ),
    [data.liquidations],
  );
  const requestById = useMemo(
    () => new Map(data.requests.map((request) => [request.id, request])),
    [data.requests],
  );
  const [busy, setBusy] = useState("");
  const [rejecting, setRejecting] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const latestData = useRef(data);
  latestData.current = data;
  const pending = useRef(false);
  const confirmation = useConfirmation();
  const [receipt, setReceipt] = useState("");
  const [uncertain, setUncertain] = useState("");
  const draft = useExplicitDraft(
    "Settlement review reason",
    Boolean(reason.trim()),
    Boolean(busy),
    () => {
      setReason("");
      setRejecting("");
    },
  );
  const keyFor = (id: string) => `settlement:${userProfile?.id}:${id}`;
  const verify = async () => {
    if (!uncertain || !data.summary || pending.current) return;
    pending.current = true;
    setBusy(uncertain);
    try {
      const next = await fetchDepartmentBudgetBundle(
        data.summary.orgId,
        data.summary.fiscalYear,
      );
      const row = next.liquidations.find((item) => item.id === uncertain);
      if (row && row.status !== "pending_department_settlement") {
        recordFinancialOutcome(keyFor(uncertain), "saved");
        setReceipt(
          `${row.liquidationNumber || row.id}: ${row.status}. Verified from current financial records.`,
        );
        setUncertain("");
        draft.markClean();
        setReason("");
        setRejecting("");
      } else
        setError(
          "The package is still pending or unavailable. Its outcome is not confirmed; do not resubmit. Review the financial history with Accounting before another decision.",
        );
      await onChanged();
    } catch (caught) {
      setError(financialErrorMessage(caught));
    } finally {
      pending.current = false;
      setBusy("");
    }
  };
  const decide = async (id: string, approve: boolean) => {
    const item = data.liquidations.find((row) => row.id === id);
    const request = item && requestById.get(item.requestId);
    if (
      !canSettle ||
      pending.current ||
      !item ||
      !request ||
      item.status !== "pending_department_settlement" ||
      [
        request.cashRecipientId,
        request.requesterId,
        request.taskLeaderId,
      ].includes(userProfile?.id) ||
      (approve &&
        isLiquidationLate(request, item) &&
        !item.departmentDecidedAt) ||
      (!approve && !reason.trim())
    )
      return;
    if (financialOutcome(keyFor(id))) {
      setUncertain(financialOutcome(keyFor(id)) === "uncertain" ? id : "");
      setError(
        "A previous decision already has a saved or uncertain result. Verify current records before continuing.",
      );
      return;
    }
    const reviewedSnapshot = JSON.stringify({ item, request });
    pending.current = true;
    draft.pendingRef.current = true;
    setBusy(id);
    setError("");
    try {
      if (
        !(await confirmation.confirm({
          title: approve
            ? "Settle and post liquidation?"
            : "Request liquidation corrections?",
          description: `${request.cashRecipientName || request.requesterName || "Recipient"} · ${request.taskTitle || "Funded work"}. ${item.liquidationNumber || item.id} · version ${item.version}. Expense ${peso.format(item.declaredSpent)}, returned cash ${peso.format(item.returnedAmount)}, ${item.receipts.length} evidence records. ${item.departmentDecidedAt ? "Head authorization recorded." : "No late-package Head authorization recorded."} ${approve ? "Settlement clears the advance through the existing balanced posting; financial history cannot be edited." : "Reason: " + reason.trim()}`,
          actionLabel: approve ? "Confirm settlement" : "Send corrections",
        }))
      )
        return;
      const currentItem = latestData.current.liquidations.find(
        (row) => row.id === id,
      );
      const currentRequest = latestData.current.requests.find(
        (row) => row.id === currentItem?.requestId,
      );
      if (
        JSON.stringify({ item: currentItem, request: currentRequest }) !==
        reviewedSnapshot
      ) {
        setError(
          "The liquidation package changed while being reviewed. Review its current evidence and authorization before deciding.",
        );
        return;
      }
      await decidePettyCashLiquidation(
        id,
        approve,
        approve
          ? "Receipts verified and balanced journal settlement approved"
          : reason.trim(),
      );
      recordFinancialOutcome(keyFor(id), "saved");
      setReceipt(
        `${item.liquidationNumber || item.id}: ${approve ? "Settlement recorded" : "Corrections requested"}. Refreshing canonical records.`,
      );
      draft.markClean();
      setRejecting("");
      setReason("");
      await onChanged();
    } catch (caught) {
      if (
        !financialOutcome(keyFor(id)) &&
        financialFailureIsUncertain(caught)
      ) {
        recordFinancialOutcome(keyFor(id), "uncertain");
        setUncertain(id);
      }
      setError(
        financialErrorMessage(caught) +
          (financialOutcome(keyFor(id)) === "saved"
            ? " Decision saved; refresh failed. Do not repeat it."
            : financialOutcome(keyFor(id)) === "uncertain"
              ? " Outcome uncertain. Verify before resubmitting."
              : " Your review reason is retained."),
      );
    } finally {
      pending.current = false;
      draft.pendingRef.current = false;
      setBusy("");
    }
  };
  const openReceipt = async (path: string) => {
    try {
      window.open(
        await createReceiptSignedUrl(path),
        "_blank",
        "noopener,noreferrer",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The receipt could not be opened.",
      );
    }
  };
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {confirmation.dialog}
      <header className="flex items-center gap-2 border-b border-neutral-100 p-4">
        <ReceiptText size={15} />
        <div>
          <h2 className="text-[12px] font-semibold">
            Accounting settlement queue
          </h2>
          <p className="mt-0.5 text-[9.5px] text-neutral-500">
            Verify immutable evidence, returned change, and the balanced posting
            before settlement.
          </p>
        </div>
        <Label
          className="ml-auto"
          color={items.length ? "dark" : "positive"}
          text={`${items.length} pending`}
        />
      </header>
      <div className="space-y-3 p-4">
        {receipt && (
          <p
            role="status"
            className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            {receipt}
          </p>
        )}
        {uncertain && (
          <ActionButton
            variant="outline"
            disabled={Boolean(busy)}
            onClick={() => void verify()}
          >
            Verify settlement outcome
          </ActionButton>
        )}
        {error && <AttentionBox type="negative" text={error} />}
        {items.length ? (
          <AnimatePresence mode="popLayout">
            {items.map((item) => {
              const request = requestById.get(item.requestId);
              const late = isLiquidationLate(request, item);
              const awaitingHead = late && !item.departmentDecidedAt;
              const ownFunds = Boolean(
                userProfile?.id &&
                  [
                    request?.cashRecipientId,
                    request?.requesterId,
                    request?.taskLeaderId,
                  ].includes(userProfile.id),
              );
              const canDecide = canSettle && !ownFunds;
              return (
                <m.article
                  layout
                  exit={{ opacity: 0, height: 0 }}
                  key={item.id}
                  className="rounded-xl border border-neutral-200 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[9.5px] text-blue-700">
                          {item.liquidationNumber || `LIQ v${item.version}`}
                        </span>
                        <span className="text-[11px] font-semibold text-neutral-900">
                          {request?.subtaskTitle ||
                            request?.taskTitle ||
                            "Funded work"}
                        </span>
                      </div>
                      <p className="mt-1 text-[9.5px] text-neutral-500">
                        {request?.requesterName || "Recipient"} ·{" "}
                        {request?.purpose}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Label
                          color="dark"
                          text={`${peso.format(item.declaredSpent)} expense`}
                        />
                        <Label
                          color={item.returnedAmount ? "positive" : "dark"}
                          text={`${peso.format(item.returnedAmount)} returned`}
                        />
                        {item.refundReceiptNumber && (
                          <Label
                            color="primary"
                            text={`Refund OR ${item.refundReceiptNumber}`}
                          />
                        )}
                        {late && (
                          <Label
                            color={awaitingHead ? "negative" : "positive"}
                            text={
                              awaitingHead
                                ? "Late · Head approval required"
                                : "Late · Head approved"
                            }
                          />
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.receipts.map((receipt) => (
                          <Button
                            key={receipt.id}
                            kind="tertiary"
                            size="small"
                            onClick={() => void openReceipt(receipt.filePath)}
                          >
                            <ExternalLink size={12} />{" "}
                            {receipt.receiptNumber || receipt.fileName}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        kind="secondary"
                        size="small"
                        disabled={Boolean(busy) || !canDecide}
                        onClick={() => {
                          setRejecting(item.id);
                          setReason("");
                        }}
                      >
                        <RotateCcw size={12} /> Request changes
                      </Button>
                      <Button
                        kind="primary"
                        color="positive"
                        size="small"
                        loading={busy === item.id}
                        disabled={Boolean(busy) || awaitingHead || !canDecide}
                        onClick={() => void decide(item.id, true)}
                      >
                        <CheckCircle2 size={12} />{" "}
                        {awaitingHead ? "Awaiting Head" : "Settle & post"}
                      </Button>
                    </div>
                  </div>
                  {ownFunds && (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      You cannot settle your own cash request, receipt or task
                      leadership package. An independent authorized Accounting
                      Staff member must review it.
                    </p>
                  )}
                  {awaitingHead && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[9.5px] text-amber-900">
                      The Head must authorize this late package in Financial
                      Approvals before Accounting Staff can settle it.
                    </div>
                  )}
                  {rejecting === item.id && (
                    <m.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-4 border-t border-neutral-100 pt-4"
                    >
                      <label className="text-[9.5px] text-neutral-500">
                        Required correction
                        <textarea
                          aria-label="Required liquidation correction"
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          rows={2}
                          className="mt-1 w-full rounded-lg border border-neutral-200 p-2 text-[10px]"
                        />
                      </label>
                      <div className="mt-2 flex justify-end gap-2">
                        <Button
                          kind="tertiary"
                          size="small"
                          onClick={() => {
                            void requestNavigation(() => {
                              setRejecting("");
                              setReason("");
                            });
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          kind="primary"
                          color="negative"
                          size="small"
                          loading={busy === item.id}
                          disabled={
                            !reason.trim() || Boolean(busy) || !canDecide
                          }
                          onClick={() => void decide(item.id, false)}
                        >
                          Send correction
                        </Button>
                      </div>
                    </m.div>
                  )}
                </m.article>
              );
            })}
          </AnimatePresence>
        ) : (
          <div className="py-8 text-center">
            <CheckCircle2 size={28} className="mx-auto text-emerald-500" />
            <h3 className="mt-2 text-[11.5px] font-semibold">
              Settlement queue is clear
            </h3>
            <p className="mt-1 text-[9.5px] text-neutral-500">
              Leader-endorsed liquidations will appear here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
