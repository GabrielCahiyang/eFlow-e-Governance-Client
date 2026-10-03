import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@vibe/core";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { Banknote, Check, FileCheck2, WalletCards, X } from "lucide-react";
import { BxSliderAlt, BxsBolt, BxsCheckShield } from "../../../components/ui/boxicons";
import { Textarea } from "../../../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { useAuth } from "../../../contexts/AuthContext";
import { motionTransition } from "../../../shared/motion/motionTokens";
import type { DepartmentBudgetBundle } from "../types";
import {
  createReceiptSignedUrl,
  authorizeLateLiquidation,
  decidePettyCashLiquidation,
  decidePettyCashLiquidationLeaderReview,
  decidePettyCashLeaderReview,
  decidePettyCashRequest,
  decideWorkBudgetAllocation,
  markPettyCashReleased,
} from "../services/budgetService";
import { BudgetEmpty, peso, StatusPill } from "./budgetUi";
import { useApprovalThreshold } from "../hooks/useApprovalThreshold";
import { ApprovalThresholdDialog } from "./ApprovalThresholdDialog";
import { isLiquidationLate } from "../selectors/cashWorkflowRules";

type RejectionTarget = {
  id: string;
  kind: "allocation" | "request_leader" | "request_department" | "liquidation_leader" | "liquidation_department";
  title: string;
};

export function BudgetApprovalQueue({
  data,
  onChanged,
  focusRecordId,
}: {
  data: DepartmentBudgetBundle;
  onChanged: () => Promise<void>;
  focusRecordId?: string;
}) {
  const { userProfile, can } = useAuth();
  const currentUserId = userProfile?.id || "";
  const orgId = userProfile?.org_id || userProfile?.departmentId || data.summary?.orgId || "";
  const isDepartmentApprover = ["head", "head"].includes(userProfile?.role || "");
  const isHead = ["head", "head"].includes(userProfile?.role || "");
  const canSettle = userProfile?.role === "accounting_staff" && can("accounting.settle_liquidation");
  const canRelease = userProfile?.role === "accounting_staff" && can("accounting.release_cash");
  const { threshold, setThreshold, defaultThreshold } = useApprovalThreshold(orgId);
  const [thresholdDialogOpen, setThresholdDialogOpen] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [rejection, setRejection] = useState<RejectionTarget | null>(null);
  const pendingAllocations = data.allocations.filter((item) => isDepartmentApprover && item.status === "pending" && item.requestedBy !== currentUserId);
  const pendingRequests = data.requests.filter((item) => (isDepartmentApprover && item.status === "pending_department_approval" && item.requesterId !== currentUserId) || (item.status === "pending_leader_review" && item.taskLeaderId === currentUserId && item.requesterId !== currentUserId));
  const tier1DepartmentRequests = isDepartmentApprover
    ? pendingRequests.filter((item) => item.status === "pending_department_approval" && item.requestedAmount <= threshold)
    : [];
  const pendingLiquidations = data.liquidations.filter((item) => {
    const request = data.requests.find((candidate) => candidate.id === item.requestId);
    const lateAuthorization = isHead && isLiquidationLate(request,item) && !item.departmentDecidedAt;
    return ((lateAuthorization || canSettle) && item.status === "pending_department_settlement" && request?.cashRecipientId !== currentUserId && request?.requesterId !== currentUserId && request?.taskLeaderId !== currentUserId) || (item.status === "pending_leader_review" && request?.taskLeaderId === currentUserId && request?.cashRecipientId !== currentUserId);
  });
  const dueReleases = data.releases.filter((item) => canRelease && item.status === "scheduled" && item.scheduledDate <= new Date().toISOString().slice(0, 10));
  const requestById = useMemo(
    () => new Map(data.requests.map((item) => [item.id, item])),
    [data.requests],
  );
  const commitmentById = useMemo(() => new Map(data.commitments.map((item) => [item.id, item])), [data.commitments]);
  const lineById = useMemo(() => new Map(data.allocationLines.map((item) => [item.id, item])), [data.allocationLines]);
  useEffect(() => {
    if (!focusRecordId) return;
    const timer = window.setTimeout(() => document.getElementById(`financial-record-${focusRecordId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
    return () => window.clearTimeout(timer);
  }, [focusRecordId]);

  const act = async (id: string, operation: () => Promise<void>) => {
    setBusy(id);
    setMessage("");
    try {
      await operation();
      await onChanged();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Decision could not be saved.");
      return false;
    } finally {
      setBusy("");
    }
  };

  const confirmRejection = async (reason: string) => {
    if (!rejection) return;
    const operation = rejection.kind === "allocation"
      ? () => decideWorkBudgetAllocation(rejection.id, false, reason)
      : rejection.kind === "request_leader"
        ? () => decidePettyCashLeaderReview(rejection.id, false, reason)
        : rejection.kind === "request_department"
          ? () => decidePettyCashRequest(rejection.id, false, reason)
          : rejection.kind === "liquidation_leader"
            ? () => decidePettyCashLiquidationLeaderReview(rejection.id, false, reason)
            : () => isHead ? authorizeLateLiquidation(rejection.id, false, reason) : decidePettyCashLiquidation(rejection.id, false, reason);
    if (await act(rejection.id, operation)) setRejection(null);
  };

  const handleBatchAuthorizeTier1 = async () => {
    if (batchBusy || !tier1DepartmentRequests.length) return;
    setBatchBusy(true);
    setMessage("");
    try {
      for (const item of tier1DepartmentRequests) {
        await decidePettyCashRequest(item.id, true, "Fast-track fiscal authorization approved");
      }
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Some requests could not be fast-track authorized.");
    } finally {
      setBatchBusy(false);
    }
  };

  if (!pendingAllocations.length && !pendingRequests.length && !pendingLiquidations.length && !dueReleases.length) {
    return (
      <div className="space-y-4">
        {isDepartmentApprover && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-border bg-card px-4 py-3 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
                <BxSliderAlt size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11.5px] font-semibold text-neutral-900">Approval Governance Threshold</span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-800">
                    Fast-Track Limit: {peso.format(threshold)}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-neutral-500">
                  Requests ≤ {peso.format(threshold)} are flagged as Tier 1 (Fast-Track). Larger amounts require full multi-tier governance.
                </p>
              </div>
            </div>
            <Button
              kind="secondary"
              size="small"
              onClick={() => setThresholdDialogOpen(true)}
            >
              <BxSliderAlt size={13} className="mr-1" />
              Adjust Threshold
            </Button>
          </div>
        )}
        <BudgetEmpty title="Approval inbox is clear" description="New task-linked cash requests, release actions, and receipt settlements will appear here." />
        {thresholdDialogOpen && (
          <ApprovalThresholdDialog
            currentThreshold={threshold}
            defaultThreshold={defaultThreshold}
            onClose={() => setThresholdDialogOpen(false)}
            onSave={setThreshold}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-700">{message}</div>}

      {isDepartmentApprover && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-border bg-card px-4 py-3 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
              <BxSliderAlt size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11.5px] font-semibold text-neutral-900">Approval Governance Threshold</span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-800">
                  Fast-Track Limit: {peso.format(threshold)}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-neutral-500">
                Requests ≤ {peso.format(threshold)} are flagged as Tier 1 (Fast-Track). Larger amounts require full multi-tier governance.
              </p>
            </div>
          </div>
          <Button
            kind="secondary"
            size="small"
            onClick={() => setThresholdDialogOpen(true)}
          >
            <BxSliderAlt size={13} className="mr-1" />
            Adjust Threshold
          </Button>
        </div>
      )}

      {pendingAllocations.length > 0 && (
        <QueueSection icon={<WalletCards size={14} />} title="Legacy subtask allocation proposals" count={pendingAllocations.length}>
          {pendingAllocations.map((item) => (
            <QueueRow
              key={item.id}
              recordId={item.id}
              focused={focusRecordId === item.id}
              title={item.reason}
              meta={`Requested allocation · ${peso.format(item.amount)}`}
              status={item.status}
              actions={(
                <DecisionButtons
                  busy={busy === item.id}
                  onApprove={() => void act(item.id, () => decideWorkBudgetAllocation(item.id, true, "Approved for the assigned work"))}
                  onReject={() => setRejection({ id: item.id, kind: "allocation", title: "Decline subtask budget" })}
                />
              )}
            />
          ))}
        </QueueSection>
      )}

      {pendingRequests.length > 0 && (
        <QueueSection
          icon={<WalletCards size={14} />}
          title="Task-linked cash requests"
          count={pendingRequests.length}
          action={
            isDepartmentApprover && tier1DepartmentRequests.length > 1 ? (
              <Button
                kind="primary"
                color="positive"
                size="small"
                disabled={batchBusy || Boolean(busy)}
                loading={batchBusy}
                onClick={() => void handleBatchAuthorizeTier1()}
              >
                <BxsBolt size={12} className="mr-1" />
                Quick Authorize All Tier 1 ({tier1DepartmentRequests.length})
              </Button>
            ) : undefined
          }
        >
          {pendingRequests.map((item) => {
            const line = item.allocationLineId ? lineById.get(item.allocationLineId) : undefined;
            const attachments = data.requestAttachments.filter((attachment) => attachment.requestId === item.id);
            const hierarchy = [commitmentById.get(item.commitmentId)?.title, item.taskTitle, item.subtaskTitle].filter(Boolean).join(" → ");
            const isTier1 = item.requestedAmount <= threshold;
            const isLeaderReview = item.status === "pending_leader_review";
            const tierBadge = isTier1 ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-800">
                <BxsBolt size={10} className="text-emerald-700" />
                Tier 1 · Fast-Track (≤ {peso.format(threshold)})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-800">
                <BxsCheckShield size={10} className="text-amber-700" />
                Tier 2 · Escalated (&gt; {peso.format(threshold)})
              </span>
            );
            const approveLabel = isLeaderReview
              ? (isTier1 ? "Endorse (Fast-Track)" : "Endorse to Head")
              : (isTier1 ? "Quick Authorize" : "Authorize");

            return (
            <QueueRow
              key={item.id}
              recordId={item.id}
              focused={focusRecordId === item.id}
              title={`FR-${String(item.requestNumber).padStart(5, "0")} · ${hierarchy || "Funded work"}`}
              meta={`${item.requesterName || "Member"} · ${item.purpose} · ${peso.format(item.requestedAmount)} · ${isLeaderReview ? "Operational endorsement" : "Fiscal authorization"}${line ? ` · ${line.category} / ${line.particular} / ${line.fundSource}` : ""}`}
              status={item.status}
              tierBadge={tierBadge}
              details={attachments.length ? <div className="mt-2 flex flex-wrap gap-1.5">{attachments.map((attachment) => <button key={attachment.id} type="button" onClick={async () => window.open(await createReceiptSignedUrl(attachment.filePath), "_blank", "noopener,noreferrer")} className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[8.8px] text-neutral-600">{attachment.fileName}</button>)}</div> : undefined}
              actions={(
                <DecisionButtons
                  busy={busy === item.id || batchBusy}
                  approveLabel={approveLabel}
                  onApprove={() => void act(item.id, () => isLeaderReview
                    ? decidePettyCashLeaderReview(item.id, true, isTier1 ? "Operationally endorsed under fast-track limit" : "Operationally endorsed for fiscal authorization")
                    : decidePettyCashRequest(item.id, true, isTier1 ? "Fast-track fiscal authorization approved" : "Fiscal authorization approved")
                  )}
                  onReject={() => setRejection({ id: item.id, kind: isLeaderReview ? "request_leader" : "request_department", title: isLeaderReview ? "Return cash request" : "Decline cash request" })}
                />
              )}
            />
          );})}
        </QueueSection>
      )}

      {pendingLiquidations.length > 0 && (
        <QueueSection icon={<FileCheck2 size={14} />} title="Receipt liquidations" count={pendingLiquidations.length}>
          {pendingLiquidations.map((item) => {
            const request = requestById.get(item.requestId);
            const late = isLiquidationLate(request, item);
            const needsHead = late && !item.departmentDecidedAt && item.status === "pending_department_settlement";
            return (
              <div id={`financial-record-${item.id}`} key={item.id} className={`border-b border-neutral-100 p-4 last:border-0 ${focusRecordId === item.id ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11.5px] font-medium text-neutral-900">{request && `FR-${String(request.requestNumber).padStart(5, "0")} · `}{[request ? commitmentById.get(request.commitmentId)?.title : undefined, request?.taskTitle, request?.subtaskTitle].filter(Boolean).join(" → ") || "Cash liquidation"}</div>
                    <div className="mt-1 text-[10px] text-neutral-500">{request?.requesterName} · spent {peso.format(item.declaredSpent)} · return {peso.format(item.returnedAmount)}</div>
                    {late && <div className="mt-1 inline-flex rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700">Submitted after the liquidation deadline · Head approval required</div>}
                    <div className="mt-1 text-[10px] text-neutral-600">{item.note}</div>
                  </div>
                  <DecisionButtons
                    busy={busy === item.id}
                    approveDisabled={needsHead && !isHead}
                    approveLabel={item.status === "pending_leader_review" ? "Submit to Accounting" : needsHead ? "Approve late liquidation" : "Settle liquidation"}
                    onApprove={() => void act(item.id, () => item.status === "pending_leader_review" ? decidePettyCashLiquidationLeaderReview(item.id, true, "Receipts endorsed for office settlement") : needsHead && isHead ? authorizeLateLiquidation(item.id, true, "Late package authorized for independent accounting settlement") : decidePettyCashLiquidation(item.id, true, "Receipts verified and settled"))}
                    onReject={() => setRejection({ id: item.id, kind: item.status === "pending_leader_review" ? "liquidation_leader" : "liquidation_department", title: "Request receipt corrections" })}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.receipts.map((receipt) => (
                    <button
                      key={receipt.id}
                      onClick={async () => window.open(await createReceiptSignedUrl(receipt.filePath), "_blank", "noopener,noreferrer")}
                      className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-left text-[9.5px] text-neutral-600 hover:border-neutral-300"
                    >
                      <strong>{receipt.vendor}</strong> · {peso.format(receipt.amount)}<br />
                      {receipt.fileName}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </QueueSection>
      )}

      {dueReleases.length > 0 && (
        <QueueSection icon={<Banknote size={14} />} title="Cash releases due" count={dueReleases.length}>
          {dueReleases.map((release) => {
            const request = requestById.get(release.requestId);
            return <QueueRow key={release.id} recordId={release.id} focused={focusRecordId === release.id} title={`FR-${String(request?.requestNumber || 0).padStart(5, "0")} · ${[request ? commitmentById.get(request.commitmentId)?.title : undefined, request?.taskTitle, request?.subtaskTitle].filter(Boolean).join(" → ") || "Funded work"}`} meta={`${release.scheduledDate} · recipient ${request?.cashRecipientName || request?.requesterName || "Member"} · ${peso.format(release.amount)}`} status={release.status} actions={<button disabled={busy === release.id} onClick={() => void act(release.id, () => markPettyCashReleased(release.id))} className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-700 px-3 text-[9.5px] text-white disabled:opacity-40"><Check size={11} /> Record release</button>} />;
          })}
        </QueueSection>
      )}

      {rejection && (
        <RejectionDialog
          title={rejection.title}
          busy={busy === rejection.id}
          onClose={() => setRejection(null)}
          onConfirm={confirmRejection}
        />
      )}

      {thresholdDialogOpen && (
        <ApprovalThresholdDialog
          currentThreshold={threshold}
          defaultThreshold={defaultThreshold}
          onClose={() => setThresholdDialogOpen(false)}
          onSave={setThreshold}
        />
      )}
    </div>
  );
}

function QueueSection({ icon, title, count, children, action }: { icon: ReactNode; title: string; count: number; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-border bg-card shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-[12px] font-semibold text-foreground">{title}</h3>
        <div className="ml-auto flex items-center gap-2">
          {action}
          <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] text-amber-700">{count}</span>
        </div>
      </header>
      <div className="divide-y divide-border/70">
        <AnimatePresence initial={false} mode="popLayout">
          {children}
        </AnimatePresence>
      </div>
    </section>
  );
}

function QueueRow({ recordId, title, meta, status, actions, details, focused = false, tierBadge }: { recordId: string; title: string; meta: string; status: string; actions: ReactNode; details?: ReactNode; focused?: boolean; tierBadge?: ReactNode }) {
  return (
    <m.div
      id={`financial-record-${recordId}`}
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={motionTransition.productive}
      className={`flex flex-wrap items-center gap-3 p-4 ${focused ? "bg-accent ring-1 ring-inset ring-primary/25" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="truncate text-[11.5px] font-medium text-neutral-900">{title}</div>
          <StatusPill status={status} />
          {tierBadge}
        </div>
        <div className="mt-1 text-[12px] text-neutral-500">{meta}</div>
        {details}
      </div>
      {actions}
    </m.div>
  );
}

function DecisionButtons({ busy, onApprove, onReject, approveLabel = "Approve", approveDisabled = false }: { busy: boolean; onApprove: () => void; onReject: () => void; approveLabel?: string; approveDisabled?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        kind="tertiary"
        color="negative"
        size="small"
        disabled={busy}
        onClick={onReject}
      >
        <X size={11} className="mr-1" />
        Decline
      </Button>
      <Button
        kind="primary"
        size="small"
        disabled={busy || approveDisabled}
        loading={busy}
        onClick={onApprove}
      >
        <Check size={11} className="mr-1" />
        {approveLabel}
      </Button>
    </div>
  );
}

function RejectionDialog({ title, busy, onClose, onConfirm }: { title: string; busy: boolean; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[480px]">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-destructive">Decision required</div>
          <DialogTitle className="text-[18px]">{title}</DialogTitle>
          <DialogDescription>Record a clear reason so the requester knows exactly what to correct.</DialogDescription>
        </DialogHeader>
        <div className="px-5 py-4">
          <Textarea autoFocus rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason or required correction" className="text-[12px]" />
        </div>
        <DialogFooter className="border-t border-border px-5 py-4 sm:justify-end">
          <Button kind="secondary" size="small" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button kind="primary" color="negative" size="small" disabled={busy || !reason.trim()} loading={busy} onClick={() => void onConfirm(reason.trim())}>Confirm decision</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
