import { useState } from "react";
import { FileUp, AlertTriangle } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/button";
import { replacePublicationFile } from "../services/publicationService";
import type { ArchiveFile } from "../types";
export function PublicationCopyDialog({
  id,
  file,
  onClose,
  onUpdated,
  onBusy,
}: {
  id: string;
  file: ArchiveFile;
  onClose: () => void;
  onUpdated: () => Promise<void>;
  onBusy: (busy: boolean) => void;
}) {
  const [copy, setCopy] = useState<File | null>(null),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const save = async () => {
    if (!copy) return;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      await replacePublicationFile(id, file.sha256, copy, reason);
      await onUpdated();
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save the publication copy.",
      );
      await onUpdated().catch(() => {});
    } finally {
      setBusy(false);
      onBusy(false);
    }
  };
  return (
    <Modal
      isOpen
      title="Use a publication copy"
      description={file.name}
      width="max-w-2xl"
      preventClose={busy}
      onClose={onClose}
      footer={
        <div className="project-seal-footer">
          <span>Private original stays saved</span>
          <div>
            <Button variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={busy || !copy || reason.trim().length < 5}
              onClick={() => void save()}
            >
              {busy ? "Saving copy…" : "Save publication copy"}
            </Button>
          </div>
        </div>
      }
    >
      <p>
        Upload a copy with private details removed. Only this reviewed copy will
        be published. The original stays in the private archive.
      </p>
      <label className="project-seal-copy-field">
        <FileUp size={18} />
        Publication file
        <input
          type="file"
          disabled={busy}
          accept=".pdf,.png,.jpg,.jpeg,.txt,.docx,.xlsx"
          onChange={(e) => setCopy(e.target.files?.[0] || null)}
        />
      </label>
      <label className="project-seal-copy-field">
        What did you remove or change?
        <textarea
          rows={3}
          maxLength={2000}
          value={reason}
          disabled={busy}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {error && (
        <div role="alert" className="project-seal-error">
          <AlertTriangle size={19} />
          {error}
        </div>
      )}
    </Modal>
  );
}
