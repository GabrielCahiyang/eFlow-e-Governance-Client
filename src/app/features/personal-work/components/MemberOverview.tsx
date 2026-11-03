import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  ListChecks,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useProjectsData } from "../../../hooks/useSupabaseData";
import { requestNavigation } from "../../../shared/navigationGuard";
import { workDay } from "../../../shared/workCalendar";
import { writeNavigationLocation } from "../../navigation";
import {
  AnalyticsBars,
  AnalyticsDonut,
  deliveryRows,
  completionTrend,
} from "../../analytics";
import {
  subscribeToTeamWorkflowFacts,
  type TeamWorkflowFacts,
} from "../../team-management";
import { useDepartmentBudget, getCurrentFiscalYear } from "../../budget";
import { useWorkFeed } from "../hooks/useWorkFeed";
import { WorkList } from "./WorkList";
import { WorkInspector, useWorkInspector } from "./WorkInspector";
const EMPTY: TeamWorkflowFacts = {
  subtasks: [],
  progress: [],
  submissions: [],
  statusHistory: [],
  evidence: [],
};
export function MemberOverview({
  onNavigate,
}: {
  onNavigate?: (section: string, page: string, project?: string) => void;
}) {
  const { user, userProfile } = useAuth();
  return (
    <MemberHome
      key={user?.id}
      userId={user?.id || ""}
      office={userProfile?.org_id || ""}
      onNavigate={onNavigate}
    />
  );
}
function MemberHome({
  userId,
  office,
  onNavigate,
}: {
  userId: string;
  office: string;
  onNavigate?: (section: string, page: string, project?: string) => void;
}) {
  const feed = useWorkFeed(userId),
    inspector = useWorkInspector("overview"),
    { projects } = useProjectsData(),
    budget = useDepartmentBudget(office, getCurrentFiscalYear());
  const [focus, setFocus] = useState<
      "today" | "upcoming" | "overdue" | "returned" | "review"
    >("today"),
    [statusFilter, setStatusFilter] = useState(""),
    [completionIds, setCompletionIds] = useState<string[] | null>(null),
    [facts, setFacts] = useState(EMPTY),
    [factsError, setFactsError] = useState("");
  const taskIds = (feed.data?.rows || [])
    .filter((r) => r.kind === "office-task")
    .map((r) => r.id)
    .sort()
    .join(",");
  useEffect(() => {
    setFacts(EMPTY);
    setFactsError("");
    return subscribeToTeamWorkflowFacts(
      taskIds ? taskIds.split(",") : [],
      (next) => {
        setFacts(next);
        setFactsError("");
      },
      setFactsError,
    );
  }, [taskIds]);
  const rows = feed.data?.rows || [],
    mine = rows.filter((r) => r.mine),
    active = mine.filter((r) => !r.history && r.actionable),
    today = workDay(Date.now(), "Asia/Manila")!;
  const filtered = active.filter((r) => {
    const due = workDay(r.due, r.timezone);
    if (focus === "returned") return r.status === "changes_requested";
    if (focus === "review")
      return ["for_review", "submitted"].includes(r.status);
    return (
      due !== null &&
      (focus === "today"
        ? due === today
        : focus === "overdue"
          ? due < today
          : due > today)
    );
  });
  const waiting = mine.filter(
    (r) => !r.history && ["for_review", "submitted"].includes(r.status),
  );
  const source = mine
    .filter((r) => r.kind === "office-task" && r.task)
    .map((r) => r.task!);
  const trend = useMemo(
    () =>
      completionTrend(
        deliveryRows({ tasks: source, projects, people: [], facts }),
      ),
    [feed.data, projects, facts],
  );
  const roots = mine.filter(
    (r) => r.kind.endsWith("task") && r.status !== "cancelled",
  );
  const leads = projects.filter(
    (p) =>
      p.projectLeadId === userId &&
      !["archived", "completed"].includes(p.status),
  );
  const navigate = (section: string, page: string, project?: string) =>
    void requestNavigation(() =>
      onNavigate
        ? onNavigate(section, page, project)
        : writeNavigationLocation(
            section,
            page,
            "push",
            project ? { project, view: "analytics" } : undefined,
          ),
    );
  const list = statusFilter
    ? roots.filter((r) =>
        completionIds
          ? completionIds.includes(r.id)
          : statusFilter === "review"
            ? ["for_review", "submitted"].includes(r.status)
            : statusFilter === "stuck"
              ? !!r.blocker && r.status === "in_progress"
              : r.status === statusFilter &&
                (statusFilter !== "in_progress" || !r.blocker),
      )
    : focus === "review"
      ? waiting
      : filtered;
  const ownRequests = budget.requests.filter(
      (r) => r.requesterId === userId || r.cashRecipientId === userId,
    ),
    receiptActions = budget.releases.filter(
      (r) =>
        r.status === "released" &&
        !r.acknowledgedAt &&
        r.recipientId === userId,
    ).length,
    liquidationActions = ownRequests.filter((r) =>
      [
        "partially_released",
        "released",
        "liquidation_draft",
        "changes_requested",
        "overdue_liquidation",
      ].includes(r.status),
    ).length;
  return (
    <section className="ea-workspace" aria-label="My work overview">
      <div hidden={!!inspector.selection} className="ea-workspace">
        <header className="ea-heading">
          <div>
            <h1>My work overview</h1>
            <p>Your next tasks, deadlines and updates in one place.</p>
          </div>
          <button
            type="button"
            className="ea-button ea-button--primary"
            onClick={() => navigate("personal_work", "Assigned work")}
          >
            Open My Work
            <ArrowRight size={15} />
          </button>
        </header>
        {feed.error && (
          <div role="alert" className="ea-warning ea-error">
            {feed.error}
          </div>
        )}
        {feed.data?.issues.length ? (
          <p className="ea-warning">
            Some work sources are unavailable. Counts cover loaded work only.
          </p>
        ) : null}
        <div className="ea-metrics">
          {[
            { label: "Active work", value: active.length },
            {
              label: "Due today",
              value: active.filter((r) => workDay(r.due, r.timezone) === today)
                .length,
            },
            {
              label: "Overdue",
              value: active.filter((r) => {
                const day = workDay(r.due, r.timezone);
                return day !== null && day < today;
              }).length,
            },
            { label: "Awaiting approval", value: waiting.length },
          ].map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{feed.loading && !feed.data ? "—" : item.value}</strong>
            </div>
          ))}
        </div>
        <div className="ea-grid">
          <AnalyticsDonut
            title="My task status"
            items={[
              {
                id: "todo",
                label: "Not started",
                color: "#8ba5a0",
                value: roots.filter((r) => r.status === "todo").length,
              },
              {
                id: "in_progress",
                label: "In progress",
                color: "#3b82f6",
                value: roots.filter(
                  (r) => r.status === "in_progress" && !r.blocker,
                ).length,
              },
              {
                id: "stuck",
                label: "Stuck",
                color: "#d65a67",
                value: roots.filter(
                  (r) => r.blocker && r.status === "in_progress",
                ).length,
              },
              {
                id: "review",
                label: "Awaiting approval",
                color: "#e3a11a",
                value: roots.filter((r) =>
                  ["for_review", "submitted"].includes(r.status),
                ).length,
              },
              {
                id: "changes_requested",
                label: "Changes requested",
                color: "#a855b7",
                value: roots.filter((r) => r.status === "changes_requested")
                  .length,
              },
              {
                id: "pending_assignment",
                label: "Needs assignment",
                color: "#64748b",
                value: roots.filter((r) => r.status === "pending_assignment")
                  .length,
              },
              {
                id: "completed",
                label: "Completed",
                color: "#00857a",
                value: roots.filter((r) => r.status === "completed").length,
              },
            ]}
            onSelect={(id) => {
              setStatusFilter(id);
              setCompletionIds(null);
            }}
          />
          {factsError ? (
            <div className="ea-panel">
              <h2>Weekly completions</h2>
              <p className="ea-help">
                Completion history is unavailable. {factsError}
              </p>
            </div>
          ) : (
            <AnalyticsBars
              title="Weekly completions"
              unit="office tasks"
              items={trend.map((w) => ({
                id: w.from,
                label: w.label,
                value: w.count,
              }))}
              onSelect={(id) => {
                setCompletionIds(trend.find((w) => w.from === id)?.ids || []);
                setStatusFilter("completed");
              }}
            />
          )}
        </div>
        <section className="ea-panel">
          <h2>What to work on next</h2>
          <div
            className="ea-tabs"
            role="group"
            aria-label="My work overview filters"
          >
            {[
              { id: "today", label: "Today", icon: CalendarDays },
              { id: "upcoming", label: "Upcoming", icon: Clock3 },
              { id: "overdue", label: "Overdue", icon: Clock3 },
              {
                id: "returned",
                label: "Changes requested",
                icon: MessageSquare,
              },
              { id: "review", label: "Awaiting approval", icon: ListChecks },
            ].map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                aria-pressed={focus === id}
                onClick={() => {
                  setFocus(id as typeof focus);
                  setStatusFilter("");
                  setCompletionIds(null);
                }}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
          {statusFilter && (
            <p className="ea-help">
              Showing{" "}
              {statusFilter === "todo"
                ? "not started"
                : statusFilter === "review"
                  ? "awaiting approval"
                  : statusFilter.replace("_", " ")}{" "}
              tasks{completionIds ? " from the selected completion week" : ""}.{" "}
              <button
                type="button"
                className="ea-link"
                onClick={() => {
                  setStatusFilter("");
                  setCompletionIds(null);
                }}
              >
                Clear chart selection
              </button>
            </p>
          )}
          {list.length ? (
            <WorkList rows={list.slice(0, 12)} onOpen={inspector.open} />
          ) : (
            <p className="ea-empty">
              {feed.loading ? "Loading your work…" : "No work in this view."}
            </p>
          )}
          <p className="ea-help">
            Open a task to see prerequisites and the next available subtask.
            Parent tasks and assigned subtasks are listed separately.
          </p>
        </section>
        {!!leads.length && (
          <section className="ea-panel" aria-label="My project leadership">
            <h2>Projects you lead</h2>
            {leads.map((project) => (
              <p key={project.id}>
                <button
                  type="button"
                  className="ea-link"
                  onClick={() => navigate("projects", "Projects", project.id)}
                >
                  {project.title}
                </button>{" "}
                <span className="ea-help">
                  {
                    rows.filter(
                      (r) =>
                        r.projectId === project.id &&
                        r.kind === "office-task" &&
                        r.status === "for_review" &&
                        r.task?.reviewerId === userId,
                    ).length
                  }{" "}
                  submissions awaiting your review ·{" "}
                  {
                    rows.filter(
                      (r) =>
                        r.projectId === project.id &&
                        r.kind === "office-task" &&
                        r.relation === "Needs reassignment",
                    ).length
                  }{" "}
                  unassigned tasks
                </span>
              </p>
            ))}
          </section>
        )}
        <section className="ea-panel">
          <h2>Cash and receipt actions</h2>
          <p className="ea-help">
            {budget.error
              ? "Financial actions could not be loaded. Open Inbox to check current requests."
              : budget.loading
                ? "Loading your financial actions…"
                : `${receiptActions} cash receipt acknowledgements · ${liquidationActions} requests to liquidate or correct`}
          </p>
          <button
            type="button"
            className="ea-button"
            onClick={() => navigate("inbox", "Needs action")}
          >
            Open my action inbox
            <ArrowRight size={15} />
          </button>
        </section>
      </div>
      <WorkInspector
        presentation="page"
        selected={inspector.selection}
        current={rows}
        onClose={inspector.close}
      />
    </section>
  );
}
