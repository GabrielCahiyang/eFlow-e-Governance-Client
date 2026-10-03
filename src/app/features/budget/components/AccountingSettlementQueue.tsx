import { useMemo, useState } from "react";
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

export function AccountingSettlementQueue({
  data,
  onChanged,
}: {
  data: DepartmentBudgetBundle;
  onChanged: () => Promise<void>;
}) {
  const { userProfile, can } = useAuth();
  const canSettle = userProfile?.role === "accounting_staff" && can("accounting.settle_liquidation");
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
  const decide = async (id: string, approve: boolean) => {
    if (!canSettle) return;
    setBusy(id);
    setError("");
    try {
      await decidePettyCashLiquidation(
        id,
        approve,
        approve
          ? "Receipts verified and balanced journal settlement approved"
          : reason.trim(),
      );
      setRejecting("");
      setReason("");
      await onChanged();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The liquidation decision could not be recorded.",
      );
    } finally {
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
        {error && <AttentionBox type="negative" text={error} />}
        {items.length ? (
          <AnimatePresence mode="popLayout">
            {items.map((item) => {
              const request = requestById.get(item.requestId);
              const late = isLiquidationLate(request, item);
              const awaitingHead = late && !item.departmentDecidedAt;
              const ownFunds = Boolean(userProfile?.id && [request?.cashRecipientId, request?.requesterId, request?.taskLeaderId].includes(userProfile.id));
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
                          <Label color={awaitingHead ? "negative" : "positive"} text={awaitingHead ? "Late · Head approval required" : "Late · Head approved"} />
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
                        <CheckCircle2 size={12} /> {awaitingHead ? "Awaiting Head" : "Settle & post"}
                      </Button>
                    </div>
                  </div>
                  {awaitingHead && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[9.5px] text-amber-900">
                      The Head must authorize this late package in Financial Approvals before Accounting Staff can settle it.
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
                          onClick={() => setRejecting("")}
                        >
                          Cancel
                        </Button>
                        <Button
                          kind="primary"
                          color="negative"
                          size="small"
                          loading={busy === item.id}
                          disabled={!reason.trim() || Boolean(busy) || !canDecide}
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
