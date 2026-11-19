import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, ShieldCheck, X } from "lucide-react";
import { supabase } from "../../../../lib/supabase";
import { Button } from "../../../components/ui/button";
import { DecisionModal } from "../../../components/ui/DecisionModal";
import { readableUiError } from "../../../shared/userFacingError";
import type { PendingFundingCertification } from "../../project-setup";
import { peso } from "./budgetUi";

interface ProjectFundingCertificationQueueProps {
  orgId: string;
  onChanged?: () => Promise<void> | void;
}

export function ProjectFundingCertificationQueue({
  orgId,
  onChanged,
}: ProjectFundingCertificationQueueProps) {
  const [items, setItems] = useState<PendingFundingCertification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [declineTarget, setDeclineTarget] = useState<PendingFundingCertification | null>(null);
  const [declineReason, setDeclineReason] = useState("");

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

  const decide = async (
    item: PendingFundingCertification,
    approve: boolean,
    reason: string,
  ) => {
    if (busyId) return false;
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      const { error: rpcError } = await supabase.rpc("certify_project_funding", {
        p_request: item.id,
        p_approve: approve,
        p_reason: reason,
      });
      if (rpcError) throw rpcError;
      setNotice(
        approve
          ? `Certified ${peso.format(item.totalAmount)} for "${item.projectTitle}". Funds are now reserved.`
          : `Declined funding certification for "${item.projectTitle}".`,
      );
      window.dispatchEvent(new Event("eflow:project-setup"));
      await load();
      await onChanged?.();
      return true;
    } catch (caught) {
      setError(readableUiError(caught, "Could not process funding certification.", "write"));
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
            Project funding certifications ({items.length})
          </h2>
          <p className="text-xs text-neutral-600">
            Independent Accounting Staff certification is required before Head-endorsed project funds are locked from the Office Budget.
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
            return (
              <article
                key={item.id}
                className="rounded-lg border border-amber-200/90 bg-white p-4 shadow-xs space-y-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900">{item.projectTitle}</h3>
                    <p className="text-xs text-neutral-600">
                      Requested by <strong>{item.requestedByName}</strong>
                      {item.headApprovedByName ? (
                        <>
                          {" · "}Endorsed by <strong>{item.headApprovedByName}</strong>
                        </>
                      ) : null}
                      {item.publicationState === "draft" ? " · Draft setup" : ""}
                    </p>
                  </div>
                  <strong className="text-sm font-semibold text-neutral-900">
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
                        <strong className="text-neutral-900">{peso.format(line.amount)}</strong>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  {item.canCertify ? (
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
                      Requires an independent Accounting Staff member (cannot self-certify).
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
          title="Decline project funding certification"
          description={`Explain why ${peso.format(declineTarget.totalAmount)} for "${declineTarget.projectTitle}" cannot be certified right now.`}
          decision="changes"
          confirmLabel="Decline certification"
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
