import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardCheck, RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { formatManilaDate, formatManilaDateTime } from "../../../shared/calendarDisplay";
import { readableUiError } from "../../../shared/userFacingError";
import { writeNavigationLocation } from "../../navigation";
import {
  listPendingProjectCompletionReviews,
  type PendingProjectCompletionReview,
  type Project,
} from "../../projects";
import { ProjectCompleteDialog } from "../../projects/components/ProjectCompleteDialog";

export function ProjectCompletionReviewQueue({
  orgId,
  projects,
  focusProjectId,
}: {
  orgId?: string;
  projects: Project[];
  focusProjectId?: string;
}) {
  const [items, setItems] = useState<PendingProjectCompletionReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewing, setReviewing] = useState<PendingProjectCompletionReview | null>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  const load = useCallback(async () => {
    if (!orgId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const next = await listPendingProjectCompletionReviews(orgId);
      setItems(next);
    } catch (caught) {
      setError(readableUiError(caught, "Could not load project completion review requests.", "read"));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load, projects]);

  useEffect(() => {
    if (!focusProjectId || loading) return;
    const node = cardRefs.current[focusProjectId];
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusProjectId, items, loading]);

  if (!loading && !error && items.length === 0) {
    return null;
  }

  const activeProject = reviewing
    ? projects.find((project) => project.id === reviewing.projectId)
    : undefined;

  return (
    <section
      className="mb-4 rounded-[10px] border border-border bg-card p-4 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.08)] space-y-3"
      aria-label="Project completion reviews"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ClipboardCheck size={16} className="text-primary" aria-hidden="true" />
            Project completion reviews ({items.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            Submitted by assigned Project Leads for your final review before marking complete, archiving, and sealing on the blockchain.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw size={14} aria-hidden="true" className={loading ? "animate-spin" : undefined} />
          <span className="ml-1.5">Refresh</span>
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="space-y-2.5">
        {items.map((item) => {
          const isFocused = Boolean(focusProjectId && focusProjectId === item.projectId);
          return (
          <article
            key={item.projectId}
            ref={(node) => {
              cardRefs.current[item.projectId] = node;
            }}
            data-focused={isFocused ? "true" : undefined}
            className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3.5 py-3 ${
              isFocused
                ? "border-[var(--eflow-primary)] bg-primary/5 ring-2 ring-[var(--eflow-primary)]/25"
                : "border-border bg-muted/25"
            }`}
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">{item.projectTitle}</h3>
                <span className="inline-flex items-center rounded-[5px] border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  Awaiting Head completion review
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Project Lead: <strong className="text-foreground">{item.projectLeadName}</strong>
                {item.requestedAt ? ` · Submitted ${formatManilaDateTime(item.requestedAt)}` : ""}
                {item.startDate && item.targetDate
                  ? ` · ${formatManilaDate(item.startDate)} → ${formatManilaDate(item.targetDate)}`
                  : ""}
              </p>
              {item.note && (
                <p className="text-xs text-foreground/90">
                  <span className="font-medium">Handover note:</span> {item.note}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  writeNavigationLocation("projects", item.projectTitle, "push", {
                    parameters: { project: item.projectId },
                  })
                }
              >
                Open project
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setReviewing(item)}
              >
                Review &amp; complete
              </Button>
            </div>
          </article>
          );
        })}
      </div>

      {reviewing && (
        <ProjectCompleteDialog
          projectId={reviewing.projectId}
          projectTitle={reviewing.projectTitle}
          project={activeProject}
          onClose={() => {
            setReviewing(null);
            void load();
          }}
          onSuccess={() => {
            setReviewing(null);
            void load();
          }}
          onOpenTask={(taskId) => {
            setReviewing(null);
            writeNavigationLocation("projects", reviewing.projectTitle, "push", {
              parameters: { project: reviewing.projectId, task: taskId },
            });
          }}
          onOpenGovernance={() => {
            setReviewing(null);
          }}
        />
      )}
    </section>
  );
}
