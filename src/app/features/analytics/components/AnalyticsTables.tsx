import { ArrowUpRight } from "lucide-react";
import { DeadlineBadge } from "../../../components/ui/DeadlineBadge";
import type { ProjectFlow } from "../../project-setup";
import type { Task } from "../../tasks";
import { peopleDelivery } from "../selectors/deliveryAnalytics";
import type { AnalyticsInput, AnalyticsProject, TaskAnalytic } from "../types";
const labels: Record<string, string> = {
  todo: "Not started",
  pending_assignment: "Unassigned",
  in_progress: "In progress",
  stuck: "Stuck",
  for_review: "Awaiting approval",
  changes_requested: "Changes requested",
  completed: "Completed",
};
const date = (at?: number) =>
  at
    ? new Date(at).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "Asia/Manila",
      })
    : "—";
const duration = (hours: number | null) =>
  hours === null
    ? "Not enough data"
    : hours < 24
      ? `${hours.toFixed(1)}h`
      : `${(hours / 24).toFixed(1)} days`;
const money = (amount: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    amount,
  );
interface Props {
  table: "projects" | "people" | "tasks";
  projects: { project: AnalyticsProject; own: TaskAnalytic[]; done: number }[];
  people: ReturnType<typeof peopleDelivery>;
  shown: TaskAnalytic[];
  limit: number;
  input: AnalyticsInput;
  funding: { data: Map<string, ProjectFlow>; errors: Set<string> };
  trendIds: string[] | null;
  onOpenProject: (id: string) => void;
  onSelectPerson?: (id: string) => void;
  onOpenTask: (task: Task) => void;
  showTasks: (patch: { person: string }) => void;
  clearWeek: () => void;
}
export function AnalyticsTables({
  table,
  projects,
  people,
  shown,
  limit,
  input,
  funding,
  trendIds,
  onOpenProject,
  onSelectPerson,
  onOpenTask,
  showTasks,
  clearWeek,
}: Props) {
  return (
    <>
      {table === "projects" && (
        <div className="ea-table-wrap">
          <table className="ea-table">
            <caption className="sr-only">Project analytics</caption>
            <thead>
              <tr>
                {[
                  "Project / lead",
                  "Timeline",
                  "Tasks",
                  "Completed",
                  "In progress",
                  "Awaiting approval",
                  "Overdue / blocked",
                  "Completion",
                  "Project funding",
                ].map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.slice(0, limit).map(({ project, own, done }) => (
                <tr key={project.id}>
                  <td>
                    <button
                      onClick={() => onOpenProject(project.id)}
                      type="button"
                    >
                      {project.title}
                      <ArrowUpRight size={12} />
                    </button>
                    <small>
                      {input.people.find((p) => p.id === project.projectLeadId)
                        ?.name || "Lead not available"}
                    </small>
                  </td>
                  <td>
                    {project.startDate || "Not set"}
                    <small>to {project.targetDate || "Not set"}</small>
                  </td>
                  <td>{own.length}</td>
                  <td>{done}</td>
                  <td>{own.filter((r) => r.state === "in_progress").length}</td>
                  <td>{own.filter((r) => r.state === "for_review").length}</td>
                  <td>
                    {own.filter((r) => r.overdue).length} overdue
                    <small>
                      {
                        own.filter(
                          (r) =>
                            r.state === "stuck" ||
                            r.prerequisites.length ||
                            r.missingPrerequisites,
                        ).length
                      }{" "}
                      blocked
                    </small>
                  </td>
                  <td>
                    {own.length
                      ? `${Math.round((done / own.length) * 100)}%`
                      : "No tasks"}
                  </td>
                  <td>
                    <ProjectFinance
                      data={funding.data.get(project.id)}
                      error={funding.errors.has(project.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!projects.length && (
            <p className="ea-empty">No projects match these filters.</p>
          )}
        </div>
      )}
      {table === "people" && (
        <>
          <p className="ea-help">
            Speed uses completed tasks led by this person: recorded start →
            first submission. Approval waiting is separate. Samples, workload
            and revisions provide context; contributors are shown separately.
            “Late submissions” measures the submission date, not the reviewer’s
            approval date.
          </p>
          <div className="ea-table-wrap">
            <table className="ea-table">
              <caption className="sr-only">People delivery analytics</caption>
              <thead>
                <tr>
                  {[
                    "Person",
                    "Leading / contributing",
                    "Active / completed",
                    "On-time submissions",
                    "Late submissions",
                    "Currently overdue",
                    "Median completion time",
                    "Timed samples",
                    "Approval waiting",
                    "Returned for changes",
                  ].map((h) => (
                    <th scope="col" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {people.slice(0, limit).map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          onSelectPerson
                            ? onSelectPerson(p.id)
                            : showTasks({ person: p.id })
                        }
                      >
                        {p.name}
                      </button>
                    </td>
                    <td>
                      {p.leading} / {p.contributing}
                    </td>
                    <td>
                      {p.active} / {p.completed}
                    </td>
                    <td>
                      {p.dated
                        ? `${p.onTime}/${p.dated}`
                        : "No dated submissions"}
                    </td>
                    <td>
                      {p.late}{" "}
                      <small>
                        {p.lateRate === null
                          ? "No rate yet"
                          : `${p.lateRate}% of dated submissions`}
                      </small>
                    </td>
                    <td>{p.overdue}</td>
                    <td>{duration(p.medianHours)}</td>
                    <td>
                      {p.samples} of {p.completed}
                    </td>
                    <td>{duration(p.reviewHours)}</td>
                    <td>{p.revisions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!people.length && (
              <p className="ea-empty">No eligible people are available.</p>
            )}
          </div>
        </>
      )}
      {table === "tasks" && (
        <>
          <p className="ea-help">
            {shown.length} tasks
            {trendIds ? " in the selected completion week" : ""}.{" "}
            <button className="ea-link" type="button" onClick={clearWeek}>
              {trendIds ? "Clear week selection" : ""}
            </button>
          </p>
          <div className="ea-table-wrap">
            <table className="ea-table">
              <caption className="sr-only">Task analytics</caption>
              <thead>
                <tr>
                  {[
                    "Task / project",
                    "Lead / contributors",
                    "Status",
                    "Deadline",
                    "Started / first submission",
                    "Final approval",
                    "Overdue",
                    "Prerequisites",
                    "Allocated budget",
                  ].map((h) => (
                    <th scope="col" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, limit).map((r) => (
                  <tr key={r.task.id}>
                    <td>
                      <button type="button" onClick={() => onOpenTask(r.task)}>
                        {r.task.title}
                      </button>
                      <small>{r.project?.title || "No linked project"}</small>
                    </td>
                    <td>
                      {r.lead}
                      <small>
                        {r.participants
                          .filter(
                            (id) =>
                              id !==
                              (r.task.assigneeId ||
                                r.task.recommendationLeadId),
                          )
                          .map(
                            (id) =>
                              input.people.find((p) => p.id === id)?.name ||
                              "Person unavailable",
                          )
                          .join(", ") || "No contributors"}
                      </small>
                    </td>
                    <td>{labels[r.state] || r.state}</td>
                    <td>
                      <DeadlineBadge
                        value={r.task.deadline || r.task.dueDate}
                        status={r.task.status}
                      />
                    </td>
                    <td>
                      {date(r.startedAt)}
                      <small>Submitted {date(r.firstSubmitted)}</small>
                    </td>
                    <td>{date(r.completedAt)}</td>
                    <td>{r.overdue ? `${r.overdueDays} days` : "—"}</td>
                    <td>
                      {r.prerequisites.map((t) => t.title).join(", ") ||
                        "No pending prerequisites"}
                      {r.missingPrerequisites > 0 && (
                        <small>
                          {r.missingPrerequisites} unavailable — completion
                          unverified
                        </small>
                      )}
                    </td>
                    <td>
                      {r.project && funding.errors.has(r.project.id)
                        ? "Unavailable"
                        : r.project && !funding.data.has(r.project.id)
                          ? "Loading..."
                          : r.project
                            ? money(
                                funding.data
                                  .get(r.project.id)!
                                  .taskFunding.filter(
                                    (f) => f.taskId === r.task.id,
                                  )
                                  .reduce((n, f) => n + f.amount, 0),
                              )
                            : "No project funding"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!shown.length && (
              <p className="ea-empty">No tasks match these filters.</p>
            )}
          </div>
        </>
      )}
    </>
  );
}
function ProjectFinance({
  data,
  error,
}: {
  data?: ProjectFlow;
  error: boolean;
}) {
  if (error) return <small>Funding unavailable</small>;
  if (!data) return <small>Loading funding...</small>;
  return (
    <span className="ea-number">
      {money(data.total)} authorized
      <small>
        {money(data.allocated)} allocated / {money(data.released)} released
      </small>
      <small>{money(data.spent)} actual spent</small>
    </span>
  );
}
