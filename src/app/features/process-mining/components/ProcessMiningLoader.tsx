import { CheckCircle2, LoaderCircle, Sparkles, Workflow } from "lucide-react";
import type { ProcessMiningProgress } from "../types";

export function ProcessMiningLoader({
  progress,
  compact = false,
}: {
  progress: ProcessMiningProgress | null;
  compact?: boolean;
}) {
  const steps = progress?.history?.length
    ? progress.history
    : [
        {
          stage: progress?.stage || "connecting",
          message:
            progress?.message || "Preparing server-side Process Mining analysis…",
        },
      ];
  const currentMessage =
    progress?.message || steps[steps.length - 1]?.message || "Analyzing workflow logs…";
  const countSuffix =
    progress?.current != null && progress?.total != null && progress.total > 0
      ? ` (${progress.current}/${progress.total})`
      : "";

  return (
    <div
      className="space-y-4"
      role="status"
      aria-live="polite"
      aria-label="Running Deep Process Analysis"
    >
      <section className="pm-loader-card">
        <div className="pm-loader-head">
          <Workflow size={18} className="text-[var(--eflow-primary,#0c6f6b)]" aria-hidden="true" />
          <h2>Running server-side Process Mining</h2>
        </div>
        <p className="pm-loader-sub">
          Reconstructing workflow traces, measuring stage waiting times, and checking conformance on the eFlow analysis server.
        </p>

        <ol className="pm-activity" aria-label="Analysis activity">
          {steps.slice(-7).map((step, index, list) => {
            const isCurrent = index === list.length - 1;
            return (
              <li key={`${step.stage}:${index}`} className={isCurrent ? "is-current" : ""}>
                {isCurrent ? (
                  <LoaderCircle size={17} className="pm-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={17} aria-hidden="true" />
                )}
                <span>{step.message}</span>
              </li>
            );
          })}
        </ol>

        <div className="pm-current-banner">
          <Sparkles size={17} aria-hidden="true" />
          <span>
            {currentMessage}
            {countSuffix}
          </span>
          <i aria-hidden="true" />
        </div>
      </section>

      {!compact && (
        <div className="space-y-4" aria-hidden="true">
          <div className="ea-metrics">
            {[
              "Projects analyzed",
              "Events mined",
              "Workflow variants",
              "Rework loops",
              "Longest stage wait",
              "Conformance rate",
            ].map((label) => (
              <div key={label}>
                <span>{label}</span>
                <strong>
                  <span className="inline-block h-6 w-14 animate-pulse rounded-md bg-neutral-200/80 align-middle" />
                </strong>
              </div>
            ))}
          </div>
          <div className="ea-grid">
            <section className="ea-panel space-y-3">
              <h2>Discovered workflow map</h2>
              <div className="h-[220px] w-full animate-pulse rounded-lg bg-neutral-100" />
            </section>
            <section className="ea-panel space-y-3">
              <h2>Time spent by workflow stage</h2>
              <div className="space-y-3 pt-2">
                {[0, 1, 2, 3, 4].map((row) => (
                  <div key={row} className="space-y-1.5">
                    <div className="flex justify-between">
                      <div className="h-3 w-36 animate-pulse rounded bg-neutral-200/80" />
                      <div className="h-3 w-12 animate-pulse rounded bg-neutral-200/70" />
                    </div>
                    <div className="h-2.5 w-full animate-pulse rounded-[6px] bg-neutral-100" />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
