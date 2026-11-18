import { useEffect, useMemo, useState } from "react";
import { Search as VibeSearch } from "@vibe/core";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Layers,
  Search,
} from "lucide-react";
import { SectionEmpty, formatDate } from "../../../components/workflow/primitives";
import { InitialsAvatar, PriorityPill } from "../../../components/workflow/StatusBadges";
import { WorkFinancialClearancePanel } from "../../budget";
import type { ReadyToCompleteItem } from "../hooks/useReadyToCompleteTasks";
import { TaskReviewPanel } from "./TaskReviewPanel";

interface ReadyToCompleteInboxProps {
  items: ReadyToCompleteItem[];
  loading: boolean;
  projectTitleFor: (projectId?: string, fallback?: string) => string | undefined;
  onChanged: () => void | Promise<void>;
}

function statusPill(item: ReadyToCompleteItem) {
  if (item.clearance.cashOutstanding) {
    return {
      label: "Awaiting settlement",
      className:
        "border-amber-200 bg-amber-50 text-amber-800",
    };
  }
  if (item.clearance.canFinalize) {
    return {
      label: "Ready to complete",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }
  return {
    label: "Cleared · lead to finalize",
    className:
      "border-sky-200 bg-sky-50 text-sky-800",
  };
}

export function ReadyToCompleteInbox({
  items,
  loading,
  projectTitleFor,
  onChanged,
}: ReadyToCompleteInboxProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(({ task }) => {
      const projectName = projectTitleFor(task.linkedProjectId, task.projectTitle) || "";
      return (
        task.title.toLowerCase().includes(q) ||
        (task.assigneeName || "").toLowerCase().includes(q) ||
        projectName.toLowerCase().includes(q)
      );
    });
  }, [items, projectTitleFor, query]);

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
    } else if (!selectedId || !filtered.some((item) => item.task.id === selectedId)) {
      setSelectedId(filtered[0].task.id);
    }
  }, [filtered, selectedId]);

  const selected = filtered.find((item) => item.task.id === selectedId) || null;

  if (loading && items.length === 0) {
    return (
      <div
        role="status"
        className="rounded-[10px] border border-border bg-card p-6 text-xs text-muted-foreground shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]"
      >
        Checking approved tasks for financial clearance…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-[10px] border border-border bg-card shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
        <SectionEmpty
          illustration="complete"
          icon={<CheckCircle2 size={28} />}
          title="No tasks waiting to be completed"
          description="Tasks whose work has been approved and are waiting for financial clearance or final completion will appear here."
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,380px)_1fr] gap-4">
      <div className="rounded-[10px] border border-border bg-card shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)] overflow-hidden flex flex-col">
        <div className="px-3.5 py-3 border-b border-border bg-muted/40">
          <VibeSearch
            size="small"
            value={query}
            onChange={(value) => setQuery(value)}
            placeholder="Search approved tasks…"
            inputAriaLabel="Search tasks ready to complete"
          />
        </div>
        <div className="divide-y divide-border max-h-[68vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No matching tasks.
            </div>
          ) : (
            filtered.map((item) => {
              const { task } = item;
              const active = task.id === selectedId;
              const badge = statusPill(item);
              const projectName = projectTitleFor(task.linkedProjectId, task.projectTitle);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setSelectedId(task.id)}
                  className={`w-full text-left px-3.5 py-3 flex items-start gap-2.5 transition-colors hover:bg-muted/40 ${
                    active ? "bg-primary/5" : ""
                  }`}
                >
                  <InitialsAvatar name={task.assigneeName} size={28} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground line-clamp-2">
                        {task.title}
                      </span>
                      <ChevronRight
                        size={14}
                        className="mt-0.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {task.assigneeName || "Unassigned"}
                      {projectName ? ` · ${projectName}` : ""}
                    </div>
                    <span
                      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10.5px] font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="min-w-0">
        {selected ? (
          <div className="space-y-4">
            <div className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-foreground">
                    {selected.task.title}
                  </h2>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <InitialsAvatar name={selected.task.assigneeName} size={18} />{" "}
                      {selected.task.assigneeName || "Unassigned"}
                    </span>
                    {selected.task.teamName && (
                      <span className="flex items-center gap-1">
                        <Building2 size={12} /> {selected.task.teamName}
                      </span>
                    )}
                    {projectTitleFor(
                      selected.task.linkedProjectId,
                      selected.task.projectTitle,
                    ) && (
                      <span className="flex items-center gap-1">
                        <Layers size={12} />{" "}
                        {projectTitleFor(
                          selected.task.linkedProjectId,
                          selected.task.projectTitle,
                        )}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock size={12} />{" "}
                      {formatDate(
                        selected.task.latestSubmission?.submittedAt ||
                          selected.task.updatedAt,
                      )}
                    </span>
                  </div>
                </div>
                <PriorityPill priority={selected.task.priority} />
              </div>
            </div>

            {typeof WorkFinancialClearancePanel === "function" && (
              <WorkFinancialClearancePanel
                key={selected.task.id}
                root={selected.task.id}
                readOnly={false}
                leadName={selected.task.assigneeName}
                onSaved={onChanged}
              />
            )}

            <div className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
              <div className="text-xs font-bold uppercase tracking-wide text-foreground mb-2">
                Accepted submission
              </div>
              <TaskReviewPanel
                task={selected.task}
                compact
                canReview={false}
                showDecision={false}
              />
            </div>
          </div>
        ) : (
          <div className="flex min-h-[320px] h-full items-center justify-center rounded-[10px] border border-border bg-card shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
            <SectionEmpty
              illustration="files"
              icon={<Search size={26} />}
              title="Select a task"
              description="Pick an approved task from the list to check clearance or mark it complete."
            />
          </div>
        )}
      </div>
    </div>
  );
}
