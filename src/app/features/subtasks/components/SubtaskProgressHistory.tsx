import { EmptyState } from '../../../components/ui/EmptyState';
import { AlertTriangle, ArrowRight, MessageSquareText, UserRound } from "lucide-react";
import { formatDate } from "../../../components/workflow/primitives";
import type { SubtaskProgressUpdate } from "../types";
import { SubtaskEvidenceLink } from "./SubtaskEvidenceLink";

export function SubtaskProgressHistory({
  updates,
}: {
  updates: SubtaskProgressUpdate[];
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-neutral-500">
        Progress updates
      </div>
      {updates.length === 0 ? (
        <EmptyState illustration="tasks" size="compact" title="No progress updates have been submitted yet."/>
      ) : (
        <div className="space-y-2.5">
          {updates.map((update) => (
            <article key={update.id} className="rounded-lg border border-neutral-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 text-[11px] text-neutral-600">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                    <UserRound size={12} />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-neutral-800">{update.authorName}</div>
                    <div className="text-[9.5px] text-neutral-400">{formatDate(update.createdAt)}</div>
                  </div>
                </div>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10.5px] font-semibold text-blue-700">
                  {update.blocker?'Stuck':update.blockerCategory==='None'?'In progress':`${update.percentComplete}% · earlier update`}
                </span>
              </div>

              <details className="mt-2 text-[10.5px] text-neutral-500">
                <summary className="cursor-pointer">Recorded progress value</summary>
                <p>{update.percentComplete}%</p>
              </details>

              {update.note && (
                <div className="mt-2.5 flex gap-2 rounded-lg bg-neutral-50 p-2.5 text-[11.5px] text-neutral-700">
                  <MessageSquareText size={13} className="mt-0.5 shrink-0 text-neutral-400" />
                  <span className="whitespace-pre-wrap">{update.note}</span>
                </div>
              )}
              {(update.blockerCategory && update.blockerCategory !== "None") && (
                <div className="mt-2 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span><strong>{update.blockerCategory}</strong>{update.blocker ? ` · ${update.blocker}` : ""}</span>
                </div>
              )}
              {update.nextStep && (
                <div className="mt-2 flex items-start gap-2 text-[11px] text-neutral-600">
                  <ArrowRight size={13} className="mt-0.5 shrink-0 text-neutral-400" />
                  <span><strong className="font-medium">Next:</strong> {update.nextStep}</span>
                </div>
              )}
              {update.attachmentPath && (
                <div className="mt-2">
                  <SubtaskEvidenceLink
                    fileName={update.attachmentName || "Progress attachment"}
                    filePath={update.attachmentPath}
                  />
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
