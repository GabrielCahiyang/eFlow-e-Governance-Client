import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { ExternalLink, X } from "lucide-react";
import { createPortal } from "react-dom";

export function SourcePdfPreviewDialog({ title, url, onClose }: {
  title: string;
  url: string;
  onClose: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-neutral-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`View ${title}`}>
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3">
          <div className="min-w-0 flex-1 truncate text-[12px] font-medium text-neutral-900">{title}</div>
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-[10px] text-neutral-600 hover:bg-neutral-50"><ExternalLink size={12} /> Open in new tab</a>
          <WorkspaceTooltip content="Close PDF preview"><button type="button" onClick={onClose} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Close PDF preview"><X size={16} /></button></WorkspaceTooltip>
        </div>
        <iframe title={title} src={url} className="min-h-0 w-full flex-1 bg-neutral-100" />
      </div>
    </div>,
    document.body,
  );
}
