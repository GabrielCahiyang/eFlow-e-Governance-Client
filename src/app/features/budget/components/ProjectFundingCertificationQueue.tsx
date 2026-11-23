import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ExternalLink, RefreshCw, ShieldCheck, X } from "lucide-react";
import { supabase } from "../../../../lib/supabase";
import { Button } from "../../../components/ui/button";
import { DecisionModal } from "../../../components/ui/DecisionModal";
import { readableUiError } from "../../../shared/userFacingError";
import { formatManilaDateTime } from "../../../shared/calendarDisplay";
import type { PendingFundingCertification } from "../../project-setup";
import { writeNavigationLocation } from "../../navigation";
import { useNotificationNavigationIntent } from "../../notifications";
import { peso } from "./budgetUi";

interface ProjectFundingCertificationQueueProps {
  orgId: string;
  focusProjectId?: string;
  focusRequestId?: string;
  onChanged?: () => Promise<void> | void;
}

export function ProjectFundingCertificationQueue({
  orgId,
  focusProjectId,
  focusRequestId,
  onChanged,
}: ProjectFundingCertificationQueueProps) {
  const [items, setItems] = useState<PendingFundingCertification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [declineTarget, setDeclineTarget] = useState<PendingFundingCertification | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [intentFocus, setIntentFocus] = useState<{ projectId?: string; requestId?: string } | null>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  useNotificationNavigationIntent(
    (intent) => intent.kind === "budget" && intent.financialRecordType === "project_funding",
    (intent) => {
      if (loading) return false;
      setIntentFocus({
        projectId: intent.projectId,
        requestId: intent.financialRecordId,
      });
      return true;
    },
    [loading],
  );

  const activeFocusRequestId = focusRequestId || intentFocus?.requestId;
  const activeFocusProjectId = focusProjectId || intentFocus?.projectId;

  const load = useCallback(async () => {
    if (!orgId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "list_pending_project_funding_certifications",
        { p_org_id: orgId },
      );
      if (rpcError) throw rpcError;
      setItems(Array.isArray(data) ? (data as PendingFundingCertification[]) : []);
    } catch (caught) {
      setError(readableUiError(caught, "Could not load project funding certification requests.", "read"));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
    const onSetupUpdate = () => void load();
    window.addEventListener("eflow:project-setup", onSetupUpdate);
    return () => window.removeEventListener("eflow:project-setup", onSetupUpdate);
  }, [load]);

  useEffect(() => {
    if (loading || (!activeFocusRequestId && !activeFocusProjectId)) return;
    const matched = items.find(
      (item) =>
        (activeFocusRequestId && item.id === activeFocusRequestId) ||
        (activeFocusProjectId && item.projectId === activeFocusProjectId),
    );
    if (!matched) return;
    const node = cardRefs.current[matched.id];
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeFocusProjectId, activeFocusRequestId, items, loading]);

  const decide = async (
    item: PendingFundingCertification,
    approve: boolean,
    reason: string,
  ) => {
    if (busyId) return false;
    setBusyId(item.id);
    setError("");
    setNotice("");
    const isHeadStage = item.status === "pending";
    try {
      const rpcName = isHeadStage ? "decide_project_funding" : "certify_project_funding";
      const { error: rpcError } = await supabase.rpc(rpcName, {
        p_request: item.id,
        p_approve: approve,
        p_reason: reason,
      });
      if (rpcError) throw rpcError;
      setNotice(
        isHeadStage
          ? approve
            ? `Endorsed ${peso.format(item.totalAmount)} for "${item.projectTitle}" and forwarded to Accounting Staff for certification.`
            : `Declined funding request for "${item.projectTitle}".`
          : approve
            ? `Certified ${peso.format(item.totalAmount)} for "${item.projectTitle}". Funds are reserved and the project is now Waiting for activation.`
            : `Declined funding certification for "${item.projectTitle}".`,
      );
      window.dispatchEvent(new Event("eflow:project-setup"));
      await load();
      await onChanged?.();
      return true;
    } catch (caught) {
      setError(readableUiError(caught, "Could not process funding approval.", "write"));
      return false;
    } finally {
      setBusyId("");
    }
  };

  if (!loading && !error && items.length === 0 && !notice) {
    return null;
  }

  return (
    <section
      className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3"
      aria-label="Project funding certifications"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <ShieldCheck size={16} className="text-amber-700" aria-hidden="true" />
            Project funding approvals ({items.length})
          </h2>
          <p className="text-xs text-neutral-600">
            Funded projects stay Pending approval until both Office Head endorsement and independent Accounting Staff certification pass, then move to Waiting for activation.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || Boolean(busyId)}
          onClick={() => void load()}
        >
          <RefreshCw size={14} aria-hidden="true" className={loading ? "animate-spin" : undefined} />
          <span className="ml-1.5">Refresh</span>
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {notice}
        </p>
      )}

      {loading && items.length === 0 ? (
        <p role="status" className="text-xs text-neutral-600">
          Checking pending project funding requests…
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const pending = busyId === item.id;
            const isHeadStage = item.status === "pending";
            const submittedAt = item.createdAt ? formatManilaDateTime(item.createdAt, "") : "";
            const isFocused = Boolean(
              (activeFocusRequestId && item.id === activeFocusRequestId) ||
                (!activeFocusRequestId && activeFocusProjectId && item.projectId === activeFocusProjectId),
            );
            return (
              <article
                key={item.id}
                ref={(node) => {
                  cardRefs.current[item.id] = node;
                }}
                data-focused={isFocused ? "true" : undefined}
                className={`rounded-lg border bg-white p-4 shadow-xs space-y-2.5 transition-shadow ${
                  isFocused
                    ? "border-[var(--eflow-primary)] ring-2 ring-[var(--eflow-primary)]/25"
                    : "border-amber-200/90"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-neutral-900">{item.projectTitle}</h3>
                      <span className="inline-flex items-center rounded-[5px] border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        {isHeadStage
                          ? "Step 1/2 · Pending Head approval"
                          : "Step 2/2 · Pending Accounting certification"}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600">
                      Requested by <strong>{item.requestedByName}</strong>
                      {item.headApprovedByName ? (
                        <>
                          {" · "}Endorsed by <strong>{item.headApprovedByName}</strong>
                        </>
                      ) : null}
                      {submittedAt ? ` · ${submittedAt}` : ""}
                      {item.publicationState === "draft" ? " · Pending project" : ""}
                    </p>
                  </div>
                  <strong className="text-sm font-semibold text-neutral-900 tabular-nums">
                    {peso.format(item.totalAmount)}
                  </strong>
                </div>

                {item.reason && (
                  <p className="text-xs text-neutral-700">
                    <span className="font-medium text-neutral-900">Justification:</span> {item.reason}
                  </p>
                )}

                {item.lines.length > 0 && (
                  <ul className="space-y-1 rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                    {item.lines.map((line, index) => (
                      <li key={`${item.id}-${line.partitionId}-${index}`} className="flex flex-wrap justify-between gap-2">
                        <span>
                          {line.fiscalYear ? `FY ${line.fiscalYear} · ` : ""}
                          {line.sourceName}
                          <span className="text-neutral-500"> ({peso.format(line.available)} available)</span>
                        </span>
                        <strong className="text-neutral-900 tabular-nums">{peso.format(line.amount)}</strong>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  {item.projectId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={Boolean(busyId)}
                      onClick={() =>
                        writeNavigationLocation("projects", item.projectTitle, "push", {
                          parameters: { project: item.projectId, view: "budget" },
                        })
                      }
                    >
                      <ExternalLink size={13} aria-hidden="true" />
                      <span className="ml-1.5">Open project</span>
                    </Button>
                  )}
                  {isHeadStage && item.canEndorse ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={Boolean(busyId)}
                        onClick={() => {
                          setDeclineTarget(item);
                          setDeclineReason("");
                          setError("");
                        }}
                      >
                        <X size={14} aria-hidden="true" />
                        <span className="ml-1">Decline</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={Boolean(busyId)}
                        onClick={() =>
                          void decide(item, true, "Endorsed by Office Head for Accounting certification")
                        }
                      >
                        <Check size={14} aria-hidden="true" />
                        <span className="ml-1">{pending ? "Endorsing…" : "Endorse for Accounting"}</span>
                      </Button>
                    </>
                  ) : item.canCertify ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={Boolean(busyId)}
                        onClick={() => {
                          setDeclineTarget(item);
                          setDeclineReason("");
                          setError("");
                        }}
                      >
                        <X size={14} aria-hidden="true" />
                        <span className="ml-1">Decline</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={Boolean(busyId)}
                        onClick={() =>
                          void decide(item, true, "Certified fund availability by Accounting Staff")
                        }
                      >
                        <Check size={14} aria-hidden="true" />
                        <span className="ml-1">{pending ? "Certifying…" : "Certify & reserve funds"}</span>
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-amber-800">
                      {isHeadStage
                        ? "Awaiting Office Head endorsement before forwarding to Accounting Staff."
                        : "Requires an independent Accounting Staff member (cannot self-certify)."}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {declineTarget && (
        <DecisionModal
          title={
            declineTarget.status === "pending"
              ? "Decline project funding request"
              : "Decline project funding certification"
          }
          description={`Explain why ${peso.format(declineTarget.totalAmount)} for "${declineTarget.projectTitle}" cannot be approved right now.`}
          decision="changes"
          confirmLabel={declineTarget.status === "pending" ? "Decline request" : "Decline certification"}
          requireReason
          reason={declineReason}
          onReasonChange={setDeclineReason}
          busy={Boolean(busyId)}
          error={error}
          onCancel={() => {
            setDeclineTarget(null);
            setDeclineReason("");
            setError("");
          }}
          onConfirm={() => {
            const target = declineTarget;
            void decide(target, false, declineReason.trim()).then((ok) => {
              if (ok) {
                setDeclineTarget(null);
                setDeclineReason("");
              }
            });
          }}
        />
      )}
    </section>
  );
}
