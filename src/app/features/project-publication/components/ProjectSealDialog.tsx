import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/button";
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
    [correction, setCorrection] = useState("");
  const refresh = useCallback(async () => {
    const status = await loadSealStatus(projectId);
    setSeal(status.snapshot);
  }, [projectId]);
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
              "The publication server is unavailable. You can still review the saved record.",
            );
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
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
            if (active) setError(e.message);
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
      setError(e instanceof Error ? e.message : "Could not save publication.");
    } finally {
      setBusy(false);
    }
  };
  const ready = seal?.state === "review_ready",
    sealed = seal?.state === "confirmed",
    needsConsent = ready || (seal?.state === "failed" && !!seal.approved_at);
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
              <Button
                disabled={
                  busy ||
                  !reviewed ||
                  !config?.worker_enabled ||
                  (config.mode === "live" && !config.configured)
                }
                onClick={() => void act(() => approveSeal(seal))}
              >
                <ShieldCheck size={16} />
                {config?.mode === "simulation"
                  ? "Run simulation"
                  : "Publish and seal"}
              </Button>
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
          {config && !config.worker_enabled && (
            <div className="project-seal-note">
              The publication worker is not enabled yet. Your project stays
              private.
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
              <Button
                disabled={busy || !config?.worker_enabled}
                onClick={() => void act(() => prepareSeal(projectId))}
              >
                Prepare project preview
              </Button>
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
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void act(() => discardSeal(seal.id))}
                >
                  Discard preview
                </Button>
              )}
            </div>
          )}
          {seal?.state === "failed" && (
            <>
              <Button
                disabled={
                  busy || (needsConsent && !reviewed) || !config?.worker_enabled
                }
                onClick={() => void act(() => retrySeal(seal.id))}
              >
                Retry saved publication
              </Button>
              {!seal.approved_at && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void act(() => discardSeal(seal.id))}
                >
                  Discard preview
                </Button>
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
              <label>
                Correction note
                <textarea
                  value={correction}
                  maxLength={4000}
                  onChange={(e) => setCorrection(e.target.value)}
                  rows={3}
                />
              </label>
              <Button
                disabled={
                  busy ||
                  !config?.worker_enabled ||
                  correction.trim().length < 10
                }
                onClick={() =>
                  void act(() => prepareSeal(projectId, correction))
                }
              >
                Prepare linked correction
              </Button>
            </section>
          )}
        </>
      )}
    </Modal>
  );
}
