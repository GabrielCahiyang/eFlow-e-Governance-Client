import { useRef } from "react";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../../../components/ui/dialog";
export function ActivityPrintPreview({
  html,
  onClose,
}: {
  html: string;
  onClose: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  return (
    <Dialog
      open={!!html}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="eflow-activity-preview"
        overlayClassName="z-[109]"
        showCloseButton={false}
      >
        <header>
          <DialogTitle>Activity print preview</DialogTitle>
          <DialogDescription className="sr-only">
            Complete selected history, ready to print or save as PDF.
          </DialogDescription>
          <Button onClick={() => frame.current?.contentWindow?.print()}>
            Print / Save PDF
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close print preview
          </Button>
        </header>
        <iframe
          ref={frame}
          title="Activity print document"
          srcDoc={html}
          sandbox="allow-same-origin allow-modals"
        />
      </DialogContent>
    </Dialog>
  );
}
