import { readableUiError } from '../../../shared/userFacingError';
import { useState } from "react";
import { AttentionBox, Heading, IconButton, Loader, Text } from "@vibe/core";
import { Close, Retry, Robot } from "@vibe/icons";
import type { AiQueueUpdate } from "../../ai";
import { WButton } from "../../../components/workflow/primitives";
import { InspectorPanel } from "../../../shared/motion";
import { generateManagementBrief } from "../services/managementBriefService";
import type { DepartmentReportRow } from "../types";

export function ManagementBriefPanel({ title, rows }: { title: string; rows: DepartmentReportRow[] }) {
  const [brief, setBrief] = useState("");
  const [error, setError] = useState("");
  const [queue, setQueue] = useState<AiQueueUpdate | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const generate = async () => {
    setOpen(true);
    setLoading(true);
    setError("");
    setQueue(null);
    try {
      setBrief(await generateManagementBrief(title, rows, setQueue));
    } catch (caught) {
      setError(readableUiError(caught, "Unable to generate the management brief.", 'write'));
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return <WButton icon={<Robot size={14} />} onClick={generate} disabled={rows.length === 0}>AI management brief</WButton>;
  }

  return (
    <InspectorPanel open={open} onClose={() => setOpen(false)} ariaLabel="AI management brief" className="h-full w-full max-w-[480px]">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div>
            <Heading className="flex items-center gap-2 text-foreground" type="h2" weight="medium"><Robot size={16} /> AI management brief</Heading>
            <Text className="mt-1 text-muted-foreground" type="text3">Uses only the currently filtered, permission-scoped report rows. It never changes work records.</Text>
          </div>
          <IconButton aria-label="Close management brief" icon={Close} kind="tertiary" size="small" onClick={() => setOpen(false)} />
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-muted/50 p-4" role="status">
              <div className="flex items-center gap-2 text-[12px] font-medium text-foreground"><Loader size="small" /> Preparing the brief…</div>
              {queue && <Text type="text3" className="text-muted-foreground">{queue.status === "queued" ? `${queue.jobsAhead} AI job(s) ahead of this report.` : "DeepSeek is analyzing the visible report now."}</Text>}
            </div>
          ) : error ? (
            <AttentionBox title="Brief unavailable" text={error} type="negative" />
          ) : (
            <div className="whitespace-pre-wrap text-[12px] leading-6 text-foreground">{brief}</div>
          )}
        </div>
        <div className="flex justify-end border-t border-border px-5 py-3">
          <WButton icon={<Retry size={14} />} onClick={generate} disabled={loading}>Regenerate from visible rows</WButton>
        </div>
    </InspectorPanel>
  );
}
