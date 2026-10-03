import { useMemo, useState } from "react";
import { Banknote, CheckCircle2, Clock3, ReceiptText } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import type {
  DepartmentBudgetBundle,
  PettyCashRelease,
  PettyCashRequest,
} from "../types";
import { BudgetEmpty, peso, StatusPill } from "./budgetUi";
import { CashReleaseOverrideDialog } from "./CashReleaseOverrideDialog";
import { DisbursementVoucherDialog } from "./DisbursementVoucherDialog";
import { VoucherConfirmDialog } from "./VoucherConfirmDialog";
import { getScheduledReleaseSummary } from "../selectors/cashWorkflowRules";

type ActiveDialog =
  | { kind: "release"; release: PettyCashRelease; request?: PettyCashRequest }
  | {
      kind: "acknowledge";
      release: PettyCashRelease;
      request?: PettyCashRequest;
    };

export function BudgetReleasesPanel({
  data,
  onChanged,
}: {
  data: DepartmentBudgetBundle;
  onChanged: () => Promise<void>;
}) {
  const { userProfile, can } = useAuth();
  const currentUserId = userProfile?.id || "";
  const canRelease = userProfile?.role === "accounting_staff" && can("accounting.release_cash");
  const canOverride = canRelease;
  const fiscalYear = data.summary?.fiscalYear ?? new Date().getFullYear();
  const [override, setOverride] = useState<PettyCashRelease>();
  const [active, setActive] = useState<ActiveDialog>();
  const [message, setMessage] = useState("");
  const requestById = useMemo(
    () => new Map(data.requests.map((item) => [item.id, item])),
    [data.requests],
  );
  const releaseSummary = useMemo(
    () => getScheduledReleaseSummary(data.releases),
    [data.releases],
  );
  const orderedReleases = useMemo(
    () => [...data.releases].sort((left, right) => {
      if (left.status === "scheduled" && right.status !== "scheduled") return -1;
      if (left.status !== "scheduled" && right.status === "scheduled") return 1;
      return left.scheduledDate.localeCompare(right.scheduledDate);
    }),
    [data.releases],
  );
  const refresh = async () => {
    setMessage("");
    try {
      await onChanged();
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : "List could not refresh. Reload the page before taking another action.",
      );
    }
  };
  const summaryCards = (
    <div className="grid gap-3 sm:grid-cols-3">
      <ReleaseSummaryCard
        label="Cash to release"
        value={peso.format(releaseSummary.scheduledAmount)}
        note={`${releaseSummary.scheduledCount} scheduled tranche${releaseSummary.scheduledCount === 1 ? "" : "s"}`}
        urgent={releaseSummary.dueCount > 0}
      />
      <ReleaseSummaryCard
        label="Due now"
        value={peso.format(releaseSummary.dueAmount)}
        note={`${releaseSummary.dueCount} tranche${releaseSummary.dueCount === 1 ? "" : "s"} ready for release`}
        urgent={releaseSummary.dueCount > 0}
      />
      <ReleaseSummaryCard
        label="Scheduled later"
        value={String(releaseSummary.futureCount)}
        note="Future release tranches"
      />
    </div>
  );
  if (!data.releases.length && !data.liquidations.length)
    return (
      <div className="space-y-4">
        {summaryCards}
        <BudgetEmpty
          title="No releases or liquidations"
          description="Approved requests will be scheduled against the daily release ceiling. Released cash remains here until its receipts and returns are settled."
        />
      </div>
    );
  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-700">
          {message}
        </div>
      )}
      {summaryCards}
      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <header className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
          <Banknote size={14} />
          <h3 className="text-[14px] font-semibold">Voucher &amp; release schedule</h3>
          <span className="ml-auto text-[12px] text-neutral-500">
            Daily ceiling is enforced by the server
          </span>
        </header>
        {orderedReleases.map((release) => {
          const request = requestById.get(release.requestId);
          const canAcknowledge =
            release.status === "released" &&
            release.recipientId === currentUserId &&
            !release.acknowledgedAt;
          return (
            <div
              key={release.id}
              className="grid items-center gap-3 border-b border-neutral-100 p-4 last:border-0 md:grid-cols-[1fr_auto_auto_auto]"
            >
              <div>
                <div className="text-[12px] font-medium">
                  PC-{String(request?.requestNumber || 0).padStart(5, "0")} ·{" "}
                  {request?.subtaskTitle || request?.taskTitle || "Funded work"}
                </div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  Recipient:{" "}
                  {request?.cashRecipientName ||
                    request?.requesterName ||
                    "Assigned recipient"}{" "}
                  · scheduled {release.scheduledDate}
                </div>
                <div className="mt-1 font-mono text-[11px] text-neutral-500">
                  {release.voucherNumber || "Voucher number assigned by the accounting migration"}
                  {release.status === "released" ? ` · ${release.releaseMethod || "cash"}${release.chequeNumber ? ` ${release.chequeNumber}` : ""}` : ""}
                </div>
                {release.releasedAt && (
                  <div className="mt-1 text-[11px] text-neutral-500">
                    Released {new Date(release.releasedAt).toLocaleString()}
                  </div>
                )}
              </div>
              <StatusPill status={release.status} />
              <strong className="text-[13px] tabular-nums">
                {peso.format(release.amount)}
              </strong>
              <div className="flex justify-end">
                {release.status === "scheduled" && canRelease ? (
                  <>
                    <button
                      onClick={() => {
                        setMessage("");
                        setActive({ kind: "release", release, request });
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-700 px-3 text-[12px] text-white disabled:opacity-40"
                    >
                      <Banknote size={10} /> Mark released
                    </button>
                    {canOverride && <button
                        onClick={() => {
                          setMessage("");
                          setOverride(release);
                        }}
                        className="ml-2 inline-flex h-8 items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 text-[12px] text-amber-900 disabled:opacity-40"
                      >
                        <Clock3 size={10} /> Override schedule
                      </button>}
                  </>
                ) : canAcknowledge ? (
                  <button
                    onClick={() => {
                      setMessage("");
                      setActive({ kind: "acknowledge", release, request });
                    }}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-blue-600 px-3 text-[12px] text-white disabled:opacity-40"
                  >
                    <CheckCircle2 size={10} /> Acknowledge
                  </button>
                ) : release.acknowledgedAt ? (
                  <span className="inline-flex items-center gap-1 text-[12px] text-emerald-700">
                    <CheckCircle2 size={10} /> Received
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </section>
      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <header className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
          <ReceiptText size={14} />
          <h3 className="text-[14px] font-semibold">Liquidation timeline</h3>
        </header>
        {data.requests
          .filter(
            (request) =>
              request.releasedAmount ||
              ["settled", "overdue_liquidation"].includes(request.status),
          )
          .map((request) => {
            const latest = data.liquidations.find(
              (item) => item.requestId === request.id,
            );
            return (
              <div
                key={request.id}
                className="grid gap-3 border-b border-neutral-100 p-4 last:border-0 md:grid-cols-[1fr_auto_auto]"
              >
                <div>
                  <div className="text-[12px] font-medium">
                    {request.subtaskTitle || request.taskTitle || "Funded work"}
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    {request.requesterName} · {request.purpose}
                  </div>
                </div>
                <div className="text-[11px] text-neutral-500">
                  <Clock3 size={10} className="mr-1 inline" />
                  {request.liquidationDueAt
                    ? `Due ${new Date(request.liquidationDueAt).toLocaleDateString()}`
                    : "Awaiting full release"}
                </div>
                <div className="text-right">
                  <StatusPill status={request.status} />
                  <div className="mt-1 text-[11px] text-neutral-500">
                    {latest
                      ? `${peso.format(latest.declaredSpent)} spent · ${peso.format(latest.returnedAmount)} returned`
                      : `${peso.format(request.releasedAmount || 0)} released`}
                  </div>
                </div>
              </div>
            );
          })}
      </section>
      {override && (
        <CashReleaseOverrideDialog
          key={override.id}
          release={override}
          request={requestById.get(override.requestId)}
          dailyLimit={data.summary?.dailyPettyCashReleaseLimit}
          onClose={() => setOverride(undefined)}
          onReleased={async () => {
            try {
              await onChanged();
            } catch {
              setMessage(
                "Cash was recorded as released, but the list could not refresh. Refresh the page before taking another action.",
              );
            }
          }}
        />
      )}
      {active?.kind === "release" && (
        <DisbursementVoucherDialog
          key={active.release.id}
          release={active.release}
          request={active.request}
          fiscalYear={fiscalYear}
          onClose={() => setActive(undefined)}
          onReleased={refresh}
        />
      )}
      {active?.kind === "acknowledge" && (
        <VoucherConfirmDialog
          key={active.release.id}
          release={active.release}
          request={active.request}
          fiscalYear={fiscalYear}
          onClose={() => setActive(undefined)}
          onAcknowledged={refresh}
        />
      )}
    </div>
  );
}

function ReleaseSummaryCard({
  label,
  value,
  note,
  urgent = false,
}: {
  label: string;
  value: string;
  note: string;
  urgent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 ${urgent ? "border-amber-200 bg-amber-50" : "border-neutral-200 bg-white"}`}>
      <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">{label}</div>
      <div className={`mt-1 text-right text-[16px] font-semibold tabular-nums ${urgent ? "text-amber-900" : "text-neutral-950"}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-neutral-500">{note}</div>
    </div>
  );
}
