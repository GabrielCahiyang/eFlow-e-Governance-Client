import { readableUiError } from '../../../shared/userFacingError';
import { useCallback, useEffect, useId, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { BoundedTextarea } from "../../../components/ui/BoundedInput";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/button";
import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { INPUT_LIMITS, textLengthError } from "../../../shared/inputLimits";
import {
  approveSeal,
  discardSeal,
  loadSealConfiguration,
  loadSealStatus,
  prepareSeal,
  retrySeal,
} from "../services/publicationService";
import { isSealPending, publicRecordUrl, sealLabels } from "../presentation";
import type { ProjectSeal, SealConfiguration } from "../types";
import { ArchivePreview } from "./ArchivePreview";
import "../publication.css";
export function ProjectSealDialog({
  projectId,
  title,
  onClose,
}: {
  projectId: string;
  title: string;
  onClose: () => void;
}) {
  const [seal, setSeal] = useState<ProjectSeal | null>(null),
    [config, setConfig] = useState<SealConfiguration | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [correction, setCorrection] = useState(""),
    [correctionTouched, setCorrectionTouched] = useState(false);
  const correctionId = useId();
  const refresh = useCallback(async () => {
    const status = await loadSealStatus(projectId);
    setSeal(status.snapshot);
  }, [projectId]);
  // The configuration decides whether Prepare/Publish are enabled. It can fail
  // once while the secure tunnel rotates, so the Head can retry without
  // closing the dialog.
  const reloadConfig = useCallback(async () => {
    setBusy(true);
    try {
      setConfig(await loadSealConfiguration());
      setError("");
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : "The publication server is unavailable. Try again shortly.",
      );
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    Promise.allSettled([loadSealStatus(projectId), loadSealConfiguration()])
      .then(([status, c]) => {
        if (active) {
          if (status.status === "fulfilled") setSeal(status.value.snapshot);
          else
            setError(
              status.reason instanceof Error
                ? status.reason.message
                : "Could not load the saved publication.",
            );
          if (c.status === "fulfilled") setConfig(c.value);
          else if (status.status === "fulfilled")
            setError(
              c.reason instanceof Error && c.reason.message
                ? `${c.reason.message} You can still review the saved record.`
                : "The publication server (:8321) is unavailable. You can still review the saved record.",
            );
        }
      })
      .catch((e) => {
        if (active) setError(readableUiError(e, "We couldn’t load the publication record.", 'read'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId]);
  useEffect(() => {
    if (!isSealPending(seal?.state)) return;
    let active = true;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible")
        void loadSealStatus(projectId)
          .then((status) => {
            if (active) {setSeal(status.snapshot);setError('');}
          })
          .catch((e) => {
            if (active) setError(readableUiError(e, "We couldn’t check the latest publication status.", 'read'));
          });
    }, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [projectId, seal?.state]);
  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
      setReviewed(false);
    } catch (e) {
      setError(readableUiError(e, "Could not save publication.", 'write'));
    } finally {
      setBusy(false);
    }
  };
  const ready = seal?.state === "review_ready",
    sealed = seal?.state === "confirmed",
    needsConsent = ready || (seal?.state === "failed" && !!seal.approved_at);
  const correctionError = textLengthError(correction, "Correction note", {
    required: true,
    min: 10,
    max: INPUT_LIMITS.COMMENT,
  });
  const visibleCorrectionError =
    correctionTouched || correction.length > 0 ? correctionError : "";
  const publishDisabled =
    busy ||
    !reviewed ||
    !config?.worker_enabled ||
    (config.mode === "live" && !config.configured);
  const publishTip = busy
    ? ""
    : !config?.worker_enabled
      ? "Publishing service is unavailable right now. Ask your administrator to restore publishing."
      : config.mode === "live" && !config.configured
        ? "Live blockchain publishing is not configured yet."
        : !reviewed
          ? "Check the review confirmation box above before publishing."
          : config.mode === "simulation"
            ? "Runs a simulation of the prepared publication record without writing to the live chain."
            : "Publishes this reviewed record publicly and permanently locks this project version on Polygon Amoy. This cannot be undone.";
  const prepareDisabled = busy || !config?.worker_enabled;
  const prepareTip = busy
    ? ""
    : !config?.worker_enabled
      ? "Publishing service is unavailable right now. Check status again or contact your administrator."
      : "";
  const discardTip = busy
    ? ""
    : "Permanently discards this prepared publication preview so you can prepare a new one. This cannot be undone.";
  const retryDisabled =
    busy || (needsConsent && !reviewed) || !config?.worker_enabled;
  const retryTip = busy
    ? ""
    : !config?.worker_enabled
      ? "Publishing service is unavailable right now."
      : needsConsent && !reviewed
        ? "Check the review confirmation box above before retrying publication."
        : "Retries publishing the saved record to Polygon Amoy.";
  const correctionDisabled =
    busy || !config?.worker_enabled || Boolean(correctionError);
  const correctionTip = busy
    ? ""
    : !config?.worker_enabled
      ? "Publishing service is unavailable right now."
      : correctionError
        ? correctionError
        : "Prepares a new linked correction preview. The original sealed certificate remains permanent.";
  return (
    <Modal
      isOpen
      title="Seal project on blockchain"
      description={title}
      width="max-w-5xl"
      className="project-seal-dialog"
      preventClose={busy}
      onClose={onClose}
      footer={
        <div className="project-seal-footer">
          <span>
            <LockKeyhole size={15} />
            Polygon Amoy · testnet
          </span>
          <div>
            <Button variant="outline" disabled={busy} onClick={onClose}>
              Close
            </Button>
            {ready && (
              <WorkspaceTooltip content={publishTip} disabled={!publishTip}>
                <span className="inline-flex">
                  <Button
                    disabled={publishDisabled}
                    onClick={() => void act(() => approveSeal(seal))}
                  >
                    <ShieldCheck size={16} />
                    {config?.mode === "simulation"
                      ? "Run simulation"
                      : "Publish and seal"}
                  </Button>
                </span>
              </WorkspaceTooltip>
            )}
          </div>
        </div>
      }
    >
      {error && (
        <div className="project-seal-error" role="alert">
          <AlertTriangle size={20} />
          <div>
            <strong>Publication needs attention</strong>
            <p>{error}</p>
          </div>
        </div>
      )}
      {loading ? (
        <div className="project-seal-loading" role="status">
          <LoaderCircle size={26} className="animate-spin" />
          Checking publication…
        </div>
      ) : (
        <>
          {!config && (
            <div className="project-seal-note" role="status">
              Publishing status could not be checked, so sealing is paused. You
              can still review saved records.{" "}
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void reloadConfig()}
              >
                Check again
              </Button>
            </div>
          )}
          {config && !config.worker_enabled && (
            <div className="project-seal-note">
              Publishing is unavailable right now. You can still view saved seals. Ask your administrator to restore publishing before preparing a new seal.
            </div>
          )}
          <div
            className={`project-seal-status ${sealed ? "is-sealed" : ""}`}
            role="status"
          >
            {sealed ? (
              <CheckCircle2 size={28} />
            ) : isSealPending(seal?.state) ? (
              <LoaderCircle size={28} className="animate-spin" />
            ) : (
              <ShieldCheck size={28} />
            )}
            <div>
              <strong>
                {seal ? sealLabels[seal.state] : "Archived · Not sealed"}
              </strong>
              <p>
                {sealed
                  ? "This reviewed version has a confirmed Amoy certificate."
                  : config?.message ||
                    "Your archived project stays private until you approve publication."}
              </p>
            </div>
          </div>
          {seal?.error && (
            <div
              className={
                seal.state === "failed"
                  ? "project-seal-error"
                  : "project-seal-note"
              }
              role={seal.state === "failed" ? "alert" : "status"}
            >
              {seal.error}
            </div>
          )}
          {(!seal ||
            seal.state === "cancelled" ||
            seal.state === "simulation") && (
            <div className="project-seal-intro">
              <h3>Review first. Publish once.</h3>
              <p>
                Prepare a permanent copy of project details, tasks, subtasks,
                budgets, reviews and evidence. Account passwords, personnel
                health records and private personnel files are excluded.
              </p>
              <p>
                After approval, this version is locked. Later corrections keep
                the original certificate.
              </p>
              <WorkspaceTooltip content={prepareTip} disabled={!prepareTip}>
                <span className="inline-flex">
                  <Button
                    disabled={prepareDisabled}
                    onClick={() => void act(() => prepareSeal(projectId))}
                  >
                    Prepare project preview
                  </Button>
                </span>
              </WorkspaceTooltip>
            </div>
          )}
          {seal?.manifest && (
            <ArchivePreview
              seal={seal}
              onError={setError}
              onBusy={setBusy}
              onUpdated={async () => {
                await refresh();
                setReviewed(false);
              }}
            />
          )}
          {needsConsent && (
            <div className="project-seal-review">
              <label>
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                <span>
                  I reviewed the full record and files. I understand this
                  publishes them publicly and locks this project version.
                </span>
              </label>
              {ready && (
                <WorkspaceTooltip content={discardTip} disabled={!discardTip}>
                  <span className="inline-flex">
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void act(() => discardSeal(seal.id))}
                    >
                      Discard preview
                    </Button>
                  </span>
                </WorkspaceTooltip>
              )}
            </div>
          )}
          {seal?.state === "failed" && (
            <>
              <WorkspaceTooltip content={retryTip} disabled={!retryTip}>
                <span className="inline-flex">
                  <Button
                    disabled={retryDisabled}
                    onClick={() => void act(() => retrySeal(seal.id))}
                  >
                    Retry saved publication
                  </Button>
                </span>
              </WorkspaceTooltip>
              {!seal.approved_at && (
                <WorkspaceTooltip content={discardTip} disabled={!discardTip}>
                  <span className="inline-flex">
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void act(() => discardSeal(seal.id))}
                    >
                      Discard preview
                    </Button>
                  </span>
                </WorkspaceTooltip>
              )}
              {seal.archive_uri && (
                <p>
                  Approved files may already be public. Retrying continues the
                  same publication.
                </p>
              )}
            </>
          )}
          {sealed && (
            <div className="project-seal-links">
              <a
                href={publicRecordUrl(seal.id)}
                target="_blank"
                rel="noopener noreferrer"
              >
                View public project record <ExternalLink size={15} />
              </a>
              <a
                href={`https://amoy.polygonscan.com/tx/${seal.tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Amoy transaction <ExternalLink size={15} />
              </a>
              <code>{seal.archive_uri}</code>
            </div>
          )}
          {sealed && (
            <section className="project-seal-review">
              <h3>Append a correction</h3>
              <p>
                Add an explanation and a new linked certificate. The original
                record and certificate stay available.
              </p>
              <div className="grid gap-1.5">
                <label htmlFor={correctionId}>
                  Correction note{" "}
                  <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
                    *
                  </span>
                </label>
                <BoundedTextarea
                  id={correctionId}
                  value={correction}
                  maxLength={INPUT_LIMITS.COMMENT}
                  disabled={busy}
                  aria-required="true"
                  error={visibleCorrectionError || undefined}
                  placeholder="Explain the correction or appended context (at least 10 characters)…"
                  onChange={(e) => {
                    setCorrection(e.target.value);
                    if (!correctionTouched) setCorrectionTouched(true);
                  }}
                  onBlur={() => setCorrectionTouched(true)}
                  rows={3}
                />
              </div>
              <WorkspaceTooltip
                content={correctionTip}
                disabled={!correctionTip}
              >
                <span className="inline-flex">
                  <Button
                    disabled={correctionDisabled}
                    onClick={() => {
                      setCorrectionTouched(true);
                      if (correctionError) return;
                      void act(async () => {
                        await prepareSeal(projectId, correction.trim());
                        setCorrection("");
                        setCorrectionTouched(false);
                      });
                    }}
                  >
                    Prepare linked correction
                  </Button>
                </span>
              </WorkspaceTooltip>
            </section>
          )}
        </>
      )}
    </Modal>
  );
}
