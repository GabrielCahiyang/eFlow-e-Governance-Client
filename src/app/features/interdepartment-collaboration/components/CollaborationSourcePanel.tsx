import { EmptyStateIllustration } from '../../../components/ui/EmptyStateIllustration';
import * as React from "react";
import { Button, EmptyState } from "@vibe/core";
import { FileText } from "lucide-react";
import { useToast } from "../../../components/ui/Toast";
import {
  getCollaborationSourceUrl,
  uploadCollaborationSource,
} from "../services/collaborationDraftService";
import type { CollaborationDraft } from "../types";
import { SourcePdfPreviewDialog } from "./SourcePdfPreviewDialog";

const MAX_SOURCE_PDF_BYTES = 25 * 1024 * 1024;

export function CollaborationSourcePanel({
  draft,
  canUpload,
  onUploaded,
}: {
  draft: CollaborationDraft;
  canUpload: boolean;
  onUploaded: () => Promise<void>;
}) {
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const preview = async () => {
    if (!draft.sourceFilePath) return;
    setLoading(true);
    try {
      setPreviewUrl(await getCollaborationSourceUrl(draft.sourceFilePath));
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not open source PDF.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const upload = async (file?: File) => {
    if (!file) return;
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      toast("Select a PDF document.", "error");
      return;
    }
    if (file.size > MAX_SOURCE_PDF_BYTES) {
      toast("The source PDF must be 25 MB or smaller.", "error");
      return;
    }
    setUploading(true);
    try {
      await uploadCollaborationSource(draft.id, file, {
        cleanupOnMetadataFailure: false,
      });
      await onUploaded();
      toast("Source PDF attached.", "success");
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Could not attach the source PDF.",
        "error",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const attachControl = canUpload && !draft.sourceFilePath ? (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      <Button
        kind="secondary"
        size="small"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? "Uploading…" : "Attach PDF"}
      </Button>
    </>
  ) : null;

  if (!draft.sourceFilePath) {
    return (
      <section className="eflow-section-card p-8 text-center">
        <EmptyState visual={<EmptyStateIllustration kind="files"/>}
          title="No source PDF attached"
          description="The owning office may attach the signed proposal, supporting plan, or reference document for all participating reviewers."
        />
        {attachControl && (
          <div className="mt-4 flex justify-center">{attachControl}</div>
        )}
      </section>
    );
  }

  return (
    <section className="eflow-section-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 border border-red-100">
            <FileText size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-neutral-900">
              {draft.sourceFileName}
            </div>
            <div className="mt-0.5 text-xs text-secondary">
              Private source document · Signed temporary access
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="small"
            disabled={loading}
            onClick={() => void preview()}
            aria-label={`View source PDF: ${draft.sourceFileName || "source document"}`}
          >
            {loading ? "Opening…" : "View source PDF"}
          </Button>
        </div>
      </div>

      {previewUrl && (
        <SourcePdfPreviewDialog
          title={draft.sourceFileName || "Proposal source PDF"}
          url={previewUrl}
          onClose={() => setPreviewUrl(null)}
        />
      )}
    </section>
  );
}
