import { readableUiError } from '../../../shared/userFacingError';
import { useId, useRef, useState } from "react";
import { FileUp, AlertTriangle } from "lucide-react";
import { BoundedTextarea } from "../../../components/ui/BoundedInput";
import { FieldValidationTooltip } from "../../../components/ui/FieldValidationTooltip";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/button";
import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { INPUT_LIMITS, textLengthError } from "../../../shared/inputLimits";
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
    [fileTouched, setFileTouched] = useState(false),
    [fileFocused, setFileFocused] = useState(false),
    [fileHovered, setFileHovered] = useState(false),
    [reason, setReason] = useState(""),
    [reasonTouched, setReasonTouched] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileId = useId();
  const fileTipId = useId();
  const fileErrId = useId();
  const reasonId = useId();
  const fileError = !copy ? "Select a publication copy file to upload." : "";
  const visibleFileError = fileTouched ? fileError : "";
  const showFileTip = Boolean(visibleFileError) && (fileFocused || fileHovered);
  const reasonError = textLengthError(reason, "Summary of changes", {
    required: true,
    min: 5,
    max: INPUT_LIMITS.REASON,
  });
  const visibleReasonError =
    reasonTouched || reason.length > 0 ? reasonError : "";
  const saveDisabled = busy || !copy || Boolean(reasonError);
  const saveTip = busy ? "" : !copy ? fileError : reasonError;
  const save = async () => {
    setFileTouched(true);
    setReasonTouched(true);
    if (!copy || reasonError) return;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      await replacePublicationFile(id, file.sha256, copy, reason.trim());
      await onUpdated();
      onClose();
    } catch (e) {
      setError(
        readableUiError(e, "Could not save the publication copy.", 'write'),
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
            <WorkspaceTooltip content={saveTip} disabled={!saveTip}>
              <span className="inline-flex">
                <Button
                  disabled={saveDisabled}
                  onClick={() => void save()}
                >
                  {busy ? "Saving copy…" : "Save publication copy"}
                </Button>
              </span>
            </WorkspaceTooltip>
          </div>
        </div>
      }
    >
      <p>
        Upload a copy with private details removed. Only this reviewed copy will
        be published. The original stays in the private archive.
      </p>
      <div className="project-seal-copy-field">
        <label htmlFor={fileId} className="flex items-center gap-2 font-medium">
          <FileUp size={18} aria-hidden="true" />
          <span>
            Publication file{" "}
            <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
              *
            </span>
          </span>
        </label>
        <input
          ref={fileInputRef}
          id={fileId}
          type="file"
          disabled={busy}
          aria-required="true"
          aria-invalid={Boolean(visibleFileError) || undefined}
          aria-describedby={
            [visibleFileError ? fileErrId : undefined, showFileTip ? fileTipId : undefined]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className={visibleFileError ? "eflow-field-invalid" : undefined}
          accept=".pdf,.png,.jpg,.jpeg,.txt,.docx,.xlsx"
          onFocus={() => setFileFocused(true)}
          onBlur={() => {
            setFileFocused(false);
            setFileTouched(true);
          }}
          onMouseEnter={() => setFileHovered(true)}
          onMouseLeave={() => setFileHovered(false)}
          onChange={(e) => {
            setCopy(e.target.files?.[0] || null);
            setFileTouched(true);
          }}
        />
        <FieldValidationTooltip
          id={fileTipId}
          anchorRef={fileInputRef}
          message={visibleFileError}
          open={showFileTip}
          tone="error"
        />
        {visibleFileError && (
          <div id={fileErrId} className="eflow-bounded-meta">
            <span className="eflow-bounded-meta__hint" data-tone="error" role="alert">
              {visibleFileError}
            </span>
          </div>
        )}
      </div>
      <div className="project-seal-copy-field">
        <label htmlFor={reasonId} className="font-medium">
          What did you remove or change?{" "}
          <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
            *
          </span>
        </label>
        <BoundedTextarea
          id={reasonId}
          rows={3}
          maxLength={INPUT_LIMITS.REASON}
          value={reason}
          disabled={busy}
          aria-required="true"
          error={visibleReasonError || undefined}
          placeholder="Describe what was redacted or changed (at least 5 characters)…"
          onChange={(e) => {
            setReason(e.target.value);
            if (!reasonTouched) setReasonTouched(true);
          }}
          onBlur={() => setReasonTouched(true)}
        />
      </div>
      {error && (
        <div role="alert" className="project-seal-error">
          <AlertTriangle size={19} />
          {error}
        </div>
      )}
    </Modal>
  );
}
