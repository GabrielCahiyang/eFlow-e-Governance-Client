import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  CalendarRange,
  Check,
  ExternalLink,
  ListChecks,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Modal } from "../../../components/ui/Modal";
import { BoundedTextarea } from "../../../components/ui/BoundedInput";
import { formatManilaDate, formatManilaDateTime } from "../../../shared/calendarDisplay";
import { readableUiError } from "../../../shared/userFacingError";
import { writeNavigationLocation } from "../../navigation";
import {
  decideNonHeadProjectApproval,
  listPendingProjectApprovals,
  type PendingNonHeadProjectApproval,
  type Project,
} from "../../projects";

const MAX_APPROVAL_FEEDBACK = 2000;

function computeInclusiveDays(startDate: string | null, targetDate: string | null): number | null {
  if (!startDate || !targetDate) return null;
  const startMs = Date.parse(`${startDate.slice(0, 10)}T00:00:00+08:00`);
  const endMs = Date.parse(`${targetDate.slice(0, 10)}T00:00:00+08:00`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return Math.round((endMs - startMs) / 86_400_000) + 1;
}

export function PendingProjectApprovalsQueue({
  orgId,
  projects,
  focusProjectId,
}: {
  orgId?: string;
  projects: Project[];
  focusProjectId?: string;
}) {
  const [items, setItems] = useState<PendingNonHeadProjectApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [decisionTarget, setDecisionTarget] = useState<{
    item: PendingNonHeadProjectApproval;
    mode: "approve" | "return";
  } | null>(null);
  const [feedback, setFeedback] = useState("");
  const [modalError, setModalError] = useState("");
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
      const next = await listPendingProjectApprovals(orgId);
      setItems(next);
    } catch (caught) {
      setError(
        readableUiError(caught, "Could not load pending project approvals.", "read"),
      );
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
    const onSetupUpdate = () => void load();
    window.addEventListener("eflow:project-setup", onSetupUpdate);
    return () => window.removeEventListener("eflow:project-setup", onSetupUpdate);
  }, [load, projects]);

  useEffect(() => {
    if (!focusProjectId || loading) return;
    const node = cardRefs.current[focusProjectId];
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusProjectId, items, loading]);

  const closeModal = () => {
    if (busyId) return;
    setDecisionTarget(null);
    setFeedback("");
    setModalError("");
  };

  const submitDecision = async () => {
    if (!decisionTarget || busyId) return;
    const { item, mode } = decisionTarget;
    const trimmed = feedback.trim();
    if (mode === "return" && !trimmed) {
      setModalError("Explain what needs to be revised before returning this project.");
      return;
    }
    setBusyId(item.projectId);
    setModalError("");
    setError("");
    setNotice("");
    try {
      await decideNonHeadProjectApproval(item.projectId, mode === "approve", trimmed);
      setNotice(
        mode === "approve"
          ? `Approved "${item.title}". The project is now Waiting for activation.`
          : `Returned "${item.title}" for revisions and notified the project team.`,
      );
      setDecisionTarget(null);
      setFeedback("");
      await load();
    } catch (caught) {
      setModalError(
        readableUiError(
          caught,
          mode === "approve"
            ? "Could not approve this project."
            : "Could not return this project for revisions.",
          "write",
        ),
      );
    } finally {
      setBusyId("");
    }
  };

  if (!loading && !error && !notice && items.length === 0) {
    return null;
  }

  return (
    <section
      className="mb-4 rounded-[10px] border border-border bg-card p-4 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.08)] space-y-3"
      aria-label="Pending project approvals"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck size={16} className="text-primary" aria-hidden="true" />
            Pending project approvals ({items.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            Review project details, assigned lead, schedule, and planned tasks before approving non-Head projects for activation.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || Boolean(busyId)}
          onClick={() => void load()}
        >
          <RefreshCw
            size={14}
            aria-hidden="true"
            className={loading ? "animate-spin" : undefined}
          />
          <span className="ml-1.5">Refresh</span>
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
        >
          {notice}
        </p>
      )}

      {loading && items.length === 0 ? (
        <p role="status" className="text-xs text-muted-foreground">
          Checking pending project approvals…
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isFocused = Boolean(focusProjectId && focusProjectId === item.projectId);
            const submittedAt = item.requestedAt || item.createdAt;
            const days = computeInclusiveDays(item.startDate, item.targetDate);
            const taskCount = typeof item.taskCount === "number" ? item.taskCount : item.tasksPreview?.length ?? 0;
            const memberCount = typeof item.memberCount === "number" ? item.memberCount : 0;
            const previewTasks = Array.isArray(item.tasksPreview) ? item.tasksPreview : [];
            const remainingTasks = Math.max(0, taskCount - previewTasks.length);

            return (
              <article
                key={item.projectId}
                ref={(node) => {
                  cardRefs.current[item.projectId] = node;
                }}
                data-focused={isFocused ? "true" : undefined}
                className={`rounded-lg border bg-background p-4 space-y-3 transition-shadow ${
                  isFocused
                    ? "border-[var(--eflow-primary)] ring-2 ring-[var(--eflow-primary)]/25"
                    : "border-border"
                }`}
              >
                {/* Header row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                      <span className="inline-flex items-center rounded-[5px] border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        Awaiting Head approval
                      </span>
                      <span className="inline-flex items-center rounded-[5px] border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {item.fundingNotRequired ? "No funding required" : "Funded project"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Requested by{" "}
                      <strong className="font-medium text-foreground">
                        {item.requestedByName || "Project creator"}
                      </strong>
                      {submittedAt ? ` · Submitted ${formatManilaDateTime(submittedAt, "")}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={Boolean(busyId)}
                      onClick={() =>
                        writeNavigationLocation("projects", item.title, "push", {
                          parameters: { project: item.projectId, view: "settings" },
                        })
                      }
                    >
                      <ExternalLink size={13} aria-hidden="true" />
                      <span className="ml-1.5">Open project</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={Boolean(busyId)}
                      onClick={() => {
                        setDecisionTarget({ item, mode: "return" });
                        setFeedback("");
                        setModalError("");
                      }}
                    >
                      <RotateCcw size={13} aria-hidden="true" />
                      <span className="ml-1.5">Return for revisions</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={Boolean(busyId)}
                      onClick={() => {
                        setDecisionTarget({ item, mode: "approve" });
                        setFeedback("");
                        setModalError("");
                      }}
                    >
                      <Check size={14} aria-hidden="true" />
                      <span className="ml-1">Approve project</span>
                    </Button>
                  </div>
                </div>

                {/* Key Project Metadata Grid */}
                <dl className="grid grid-cols-1 gap-2 rounded-md border border-border/80 bg-muted/25 p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-0.5">
                    <dt className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <Building2 size={12} aria-hidden="true" />
                      Office
                    </dt>
                    <dd className="font-medium text-foreground">
                      {item.officeName || "Office workspace"}
                    </dd>
                  </div>
                  <div className="space-y-0.5">
                    <dt className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <UserCheck size={12} aria-hidden="true" />
                      Project Lead
                    </dt>
                    <dd className="font-medium text-foreground">
                      {item.projectLeadName || "Unassigned"}
                    </dd>
                  </div>
                  <div className="space-y-0.5">
                    <dt className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <CalendarRange size={12} aria-hidden="true" />
                      Schedule
                    </dt>
                    <dd className="font-medium text-foreground tabular-nums">
                      {item.startDate && item.targetDate ? (
                        <>
                          {formatManilaDate(item.startDate, item.startDate)} →{" "}
                          {formatManilaDate(item.targetDate, item.targetDate)}
                          {days ? (
                            <span className="ml-1 font-normal text-muted-foreground">
                              ({days} {days === 1 ? "day" : "days"})
                            </span>
                          ) : null}
                        </>
                      ) : item.startDate ? (
                        `Starts ${formatManilaDate(item.startDate, item.startDate)}`
                      ) : item.targetDate ? (
                        `Target ${formatManilaDate(item.targetDate, item.targetDate)}`
                      ) : (
                        "Schedule not set"
                      )}
                    </dd>
                  </div>
                  <div className="space-y-0.5">
                    <dt className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <Users size={12} aria-hidden="true" />
                      Planned work &amp; team
                    </dt>
                    <dd className="font-medium text-foreground tabular-nums">
                      {taskCount} {taskCount === 1 ? "task" : "tasks"} · {memberCount}{" "}
                      {memberCount === 1 ? "member" : "members"}
                    </dd>
                  </div>
                </dl>

                {/* Description & Scope */}
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="rounded-md border border-border/70 bg-card p-3 space-y-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Description
                    </div>
                    <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                      {item.description?.trim() || "No project description provided."}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-card p-3 space-y-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Scope &amp; deliverables
                    </div>
                    <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                      {item.scope?.trim() || "No scope statement provided."}
                    </p>
                  </div>
                </div>

                {/* Planned Tasks Preview */}
                {previewTasks.length > 0 && (
                  <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <ListChecks size={12} aria-hidden="true" />
                        Planned tasks ({taskCount})
                      </span>
                      {remainingTasks > 0 && (
                        <span className="font-normal normal-case">
                          +{remainingTasks} more in project
                        </span>
                      )}
                    </div>
                    <ul className="divide-y divide-border/60 text-xs">
                      {previewTasks.map((task) => (
                        <li
                          key={task.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-1.5 first:pt-0.5 last:pb-0"
                        >
                          <span className="font-medium text-foreground">{task.title}</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {task.assigneeName || "Unassigned"}
                            {task.dueDate
                              ? ` · Due ${formatManilaDate(task.dueDate, task.dueDate)}`
                              : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {decisionTarget && (
        <Modal
          isOpen
          title={
            decisionTarget.mode === "approve"
              ? "Approve project for activation"
              : "Return project for revisions"
          }
          description={
            decisionTarget.mode === "approve"
              ? `Approving "${decisionTarget.item.title}" moves it to Waiting for activation. It will not start automatically until activated on or before its start date.`
              : `Return "${decisionTarget.item.title}" to ${decisionTarget.item.requestedByName || "the project creator"} with clear revision notes.`
          }
          width="max-w-lg"
          preventClose={Boolean(busyId)}
          onClose={closeModal}
          footer={
            <div className="flex w-full items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={Boolean(busyId)}
                onClick={closeModal}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={decisionTarget.mode === "approve" ? "default" : "destructive"}
                size="sm"
                disabled={
                  Boolean(busyId) ||
                  (decisionTarget.mode === "return" && !feedback.trim())
                }
                onClick={() => void submitDecision()}
              >
                {busyId
                  ? "Saving…"
                  : decisionTarget.mode === "approve"
                    ? "Confirm approval"
                    : "Return project"}
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
              <div>
                <strong className="text-foreground">Project:</strong> {decisionTarget.item.title}
              </div>
              <div>
                <strong className="text-foreground">Project Lead:</strong>{" "}
                {decisionTarget.item.projectLeadName || "Unassigned"}
                {decisionTarget.item.startDate && decisionTarget.item.targetDate
                  ? ` · ${formatManilaDate(decisionTarget.item.startDate)} → ${formatManilaDate(decisionTarget.item.targetDate)}`
                  : ""}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="pending-project-approval-feedback"
                className="block text-xs font-medium text-foreground"
              >
                {decisionTarget.mode === "approve"
                  ? "Approval note (optional)"
                  : "Revision feedback (required)"}
              </label>
              <BoundedTextarea
                id="pending-project-approval-feedback"
                autoFocus
                rows={4}
                maxLength={MAX_APPROVAL_FEEDBACK}
                value={feedback}
                disabled={Boolean(busyId)}
                error={modalError || undefined}
                placeholder={
                  decisionTarget.mode === "approve"
                    ? "Add optional guidance for activation or kickoff…"
                    : "Explain what details, schedule, or scope must be updated before resubmitting…"
                }
                onChange={(event) => {
                  setFeedback(event.target.value);
                  if (modalError) setModalError("");
                }}
                className="w-full rounded-lg border border-border bg-background p-2.5 text-sm text-foreground"
              />
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
