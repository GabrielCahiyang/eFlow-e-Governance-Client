import { useEffect, useState } from "react";
import type { AiQueueUpdate } from "../../ai";
import type { PdfPhase } from "./draftModel";

export function ProposalProcessingStatus({ phase, fileName, queue, part }: { phase: PdfPhase; fileName: string; queue: AiQueueUpdate | null; part: { current: number; total: number; partTitle: string } | null }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => { const start = Date.now(); const timer = window.setInterval(() => setSeconds(Math.round((Date.now() - start) / 1000)), 1000); return () => window.clearInterval(timer); }, []);
  const message = phase === "extracting" ? "Reading your PDF."
    : phase === "validating" ? "Checking the proposal content."
    : phase === "saving" ? "Saving your work plan and source document."
    : queue?.status === "queued" ? "Waiting for the AI."
    : queue?.progress?.message || "Breaking the proposal into tasks and suggesting a team.";
  const history = queue?.progress?.history || [];
  return <section className="rounded-xl border bg-white p-5 sm:p-8" aria-label="Preparing your work plan">
    <p className="text-xs text-neutral-500">{fileName}</p>
    <h2 role="status" aria-live="polite" className="mt-3 flex items-center gap-3 text-base font-semibold"><span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />{message}</h2>
    {part && phase === "decomposing" && <p className="mt-2 text-sm text-neutral-600">Section {part.current} of {part.total}: {part.partTitle}</p>}
    {queue?.status === "queued" && <p className="mt-2 text-sm text-neutral-600">Queue position {queue.position || "—"}. {queue.jobsAhead} request(s) ahead. Processing starts automatically.</p>}
    {history.length > 1 && <ol className="mt-4 space-y-2 text-xs text-neutral-500" aria-label="Completed processing steps">{history.slice(0, -1).map((step, index) => <li key={index}>✓ {step.message}</li>)}</ol>}
    <p className="mt-4 text-xs text-neutral-500" aria-live="off">Elapsed: {Math.floor(seconds / 60)}m {seconds % 60}s</p>
    <p className="mt-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">Please keep this window open while we prepare your work plan. You can review and edit it when processing finishes.</p>
  </section>;
}
