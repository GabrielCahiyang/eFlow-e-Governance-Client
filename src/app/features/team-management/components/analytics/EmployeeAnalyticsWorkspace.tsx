import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  BriefcaseBusiness,
  FolderKanban,
  ShieldCheck,
  Trophy,
  UsersRound,
} from "lucide-react";
import { useAuth } from "../../../../contexts/AuthContext";
import { useEmployeeNotes } from "../../../../hooks/useFirebaseData";
import { requestNavigation } from "../../../../shared/navigationGuard";
import { writeNavigationLocation } from "../../../navigation";
import { DeliveryAnalytics, type AnalyticsInput } from "../../../analytics";
import { TaskDetailDrawer } from "../../../task-inspector";
import type { Task } from "../../../tasks";
import { MonthlyLeaderboard } from "../../../productivity";
import { OfficeTeamWorkspace } from "../../../office-team";
import { WorkspaceLoadingSkeleton } from "../../../../components/workflow/WorkspaceLoadingSkeleton";
import { useDepartmentTeamAnalytics } from "../../hooks/useDepartmentTeamAnalytics";
import { buildSkillCoverage } from "../../selectors/teamAnalyticsSelectors";
import { PeopleWorkspaceShell } from "../PeopleWorkspaceShell";
import { TeamMemberBoard } from "../supervision/TeamMemberBoard";
import { TeamMemberWorkPanel } from "../supervision/TeamMemberWorkPanel";
import { TeamMemberOperationsPanel } from "../supervision/TeamMemberOperationsPanel";
import { TeamAttentionQueue } from "../supervision/TeamAttentionQueue";
import { OfficeIdentityAccessPanel } from "../supervision/OfficeIdentityAccessPanel";
import { TeamHealthOverview } from "../intelligence/TeamHealthOverview";
import { EmployeeIntelligencePanel } from "../intelligence/EmployeeIntelligencePanel";
import { SkillCoveragePanel } from "../intelligence/SkillCoveragePanel";
import type { Employee, EmployeeNote } from "../../../members";
type View =
  | "overview"
  | "projects"
  | "employees"
  | "health"
  | "skills"
  | "contribution"
  | "access";
const tabs = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "projects", label: "Project analytics", icon: FolderKanban },
  { id: "employees", label: "Employee analytics", icon: UsersRound },
  { id: "health", label: "Workload & health", icon: Activity },
  { id: "skills", label: "Skills coverage", icon: BrainCircuit },
  { id: "contribution", label: "Monthly contribution", icon: Trophy },
  { id: "access", label: "Team access", icon: ShieldCheck },
] as const;
export function EmployeeAnalyticsWorkspace({
  initialView = "projects",
  home = false,
  onNavigate,
}: {
  initialView?: View;
  home?: boolean;
  onNavigate?: (section: string, page: string, project?: string) => void;
}) {
  const { user, userProfile, can } = useAuth();
  if (
    userProfile?.role !== "head" ||
    (!can("navigation.team_supervision") &&
      !can("navigation.team_intelligence"))
  )
    return (
      <div role="alert" className="ea-warning ea-error">
        Employee analytics is not available for this account.
      </div>
    );
  return (
    <AnalyticsContent
      key={`${user?.id}:${userProfile.org_id}`}
      initialView={home ? "overview" : initialView}
      home={home}
      onNavigate={onNavigate}
    />
  );
}
function AnalyticsContent({
  initialView,
  home,
  onNavigate,
}: {
  initialView: View;
  home: boolean;
  onNavigate?: (section: string, page: string, project?: string) => void;
}) {
  const { user, userProfile, can } = useAuth(),
    analytics = useDepartmentTeamAnalytics({ includeCurrentUser: true });
  const [view, setView] = useState<View>(initialView),
    [employeeId, setEmployeeId] = useState(""),
    [search, setSearch] = useState(""),
    [employeeView, setEmployeeView] = useState<"work" | "360">("work"),
    [task, setTask] = useState<Task | null>(null),
    [access, setAccess] = useState<"accounts" | "identity">("accounts");
  const intelligence = can("navigation.team_intelligence"),
    supervision = can("navigation.team_supervision");
  const available = tabs.filter((t) =>
    t.id === "access"
      ? supervision
      : ["health", "skills", "contribution"].includes(t.id)
        ? intelligence
        : true,
  );
  const selectedView = available.some((t) => t.id === view)
    ? view
    : available[0].id;
  useEffect(() => {
    if (!analytics.deptEmployees.some((e) => e.id === employeeId))
      setEmployeeId(analytics.deptEmployees[0]?.id || "");
  }, [analytics.deptEmployees, employeeId]);
  const employee = analytics.deptEmployees.find((e) => e.id === employeeId),
    metric = analytics.memberMetrics.find((m) => m.employeeId === employeeId);
  const input = useMemo<AnalyticsInput>(
    () => ({
      tasks: analytics.tasks,
      projects: analytics.projects,
      people: analytics.deptEmployees.map((e) => ({ id: e.id, name: e.name })),
      facts: analytics.facts,
    }),
    [
      analytics.tasks,
      analytics.projects,
      analytics.deptEmployees,
      analytics.facts,
    ],
  );
  const switchView = (next: View) =>
    void requestNavigation(() => setView(next));
  const selectEmployee = (id: string) =>
    void requestNavigation(() => {
      setEmployeeId(id);
      setView("employees");
    });
  const navigateProject = (id: string) =>
    void requestNavigation(() =>
      onNavigate
        ? onNavigate("projects", "Projects", id)
        : writeNavigationLocation("projects", "Projects", "push", {
            project: id,
            view: "analytics",
          }),
    );
  const roles = useMemo(
    () =>
      new Map(
        Array.from(analytics.profilesById.entries()).map(([id, p]) => [
          id,
          String(p.role || "member"),
        ]),
      ),
    [analytics.profilesById],
  );
  const main = (
    <div className="ea-workspace">
      <div className="ea-tabs" role="group" aria-label="Analytics sections">
        {available.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            aria-pressed={selectedView === id}
            onClick={() => switchView(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      {analytics.loading ? (
        <WorkspaceLoadingSkeleton label="Loading analytics…" rows={5} />
      ) : (
        <>
          {analytics.error &&
            selectedView !== "overview" &&
            selectedView !== "projects" && (
              <div role="alert" className="ea-warning ea-error">
                Some workflow records are unavailable. {analytics.error}{" "}
                Employee comparisons and health totals are unavailable until
                they reload.{" "}
                <button
                  type="button"
                  className="ea-link"
                  onClick={analytics.refresh}
                >
                  Try again
                </button>
              </div>
            )}
          {(selectedView === "overview" || selectedView === "projects") && (
            <DeliveryAnalytics
              key={selectedView}
              input={input}
              overview={selectedView === "overview"}
              onOpenTask={setTask}
              onOpenProject={navigateProject}
              onSelectPerson={selectEmployee}
              error={analytics.error}
              loading={analytics.loading}
            />
          )}
          {selectedView === "employees" && (
            <>
              {!analytics.error && (
                <DeliveryAnalytics
                  input={input}
                  initialTable="people"
                  onOpenTask={setTask}
                  onOpenProject={navigateProject}
                  onSelectPerson={selectEmployee}
                />
              )}
              <section className="ea-panel" aria-label="Employee details">
                <div className="ea-heading">
                  <div>
                    <h2>Employee workspace</h2>
                    <p>
                      Select a person to see their work, workload, delivery
                      history and coaching.
                    </p>
                  </div>
                  <div
                    className="ea-tabs"
                    role="group"
                    aria-label="Employee detail views"
                  >
                    <button
                      type="button"
                      aria-pressed={employeeView === "work"}
                      onClick={() =>
                        void requestNavigation(() => setEmployeeView("work"))
                      }
                    >
                      <BriefcaseBusiness size={15} />
                      Work & assignments
                    </button>
                    {intelligence && (
                      <button
                        type="button"
                        aria-pressed={employeeView === "360"}
                        onClick={() =>
                          void requestNavigation(() => setEmployeeView("360"))
                        }
                      >
                        <UsersRound size={15} />
                        Employee 360
                      </button>
                    )}
                  </div>
                </div>
                <div className="ea-employee-layout">
                  <TeamMemberBoard
                    employees={analytics.deptEmployees}
                    layout="rail"
                    metrics={analytics.error ? [] : analytics.memberMetrics}
                    selectedEmployeeId={employeeId}
                    search={search}
                    onSearch={setSearch}
                    onSelect={selectEmployee}
                  />
                  <div>
                    {employee && metric && !analytics.error ? (
                      employeeView === "360" && intelligence ? (
                        <EmployeeDetails
                          employee={employee}
                          metric={metric}
                          analytics={analytics}
                        />
                      ) : (
                        <div className="ea-employee-actions">
                          <TeamMemberWorkPanel
                            employee={employee}
                            metric={metric}
                            tasks={analytics.tasks}
                            subtasks={analytics.facts.subtasks}
                            onOpenTask={setTask}
                          />
                          {supervision && (
                            <TeamMemberOperationsPanel
                              employee={employee}
                              employees={analytics.deptEmployees}
                              metric={metric}
                              tasks={analytics.tasks}
                              subtasks={analytics.facts.subtasks}
                              onOpenTask={setTask}
                            />
                          )}
                        </div>
                      )
                    ) : (
                      <p className="ea-empty">
                        {analytics.error
                          ? "Employee metrics are unavailable."
                          : "Select an employee to inspect their work."}
                      </p>
                    )}
                  </div>
                </div>
              </section>
            </>
          )}
          {selectedView === "health" && !analytics.error && (
            <>
              <div className="ea-health-note">
                Work health shows workload pressure, overdue work, blockers and
                review waiting. It does not infer medical or personal health.
              </div>
              <TeamHealthOverview
                health={analytics.health}
                members={analytics.memberMetrics}
                atRiskCount={
                  new Set(
                    analytics.attention
                      .filter((item) =>
                        ["overdue", "blocked", "stalled"].includes(item.kind),
                      )
                      .map(
                        (item) =>
                          item.taskId + ":" + (item.subtaskId || "root"),
                      ),
                  ).size
                }
              />
              <section className="ea-panel">
                <h2>Attention queue</h2>
                <TeamAttentionQueue
                  items={analytics.attention}
                  onOpenTask={(id) =>
                    setTask(analytics.tasks.find((t) => t.id === id) || null)
                  }
                  onSelectEmployee={selectEmployee}
                />
              </section>
            </>
          )}
          {selectedView === "skills" && (
            <EmployeeSkills analytics={analytics} />
          )}
          {selectedView === "contribution" && !analytics.error && (
            <>
              <p className="ea-health-note">
                Contribution recognition uses recorded work. It does not replace
                workload, skills or delivery context and does not change AI
                assignment inputs.
              </p>
              <MonthlyLeaderboard
                employees={analytics.deptEmployees}
                tasks={analytics.tasks}
                facts={analytics.facts}
                currentUserId={user?.id}
              />
            </>
          )}
          {selectedView === "access" && supervision && (
            <>
              <div
                className="ea-tabs"
                role="group"
                aria-label="Team access views"
              >
                <button
                  type="button"
                  aria-pressed={access === "accounts"}
                  onClick={() =>
                    void requestNavigation(() => setAccess("accounts"))
                  }
                >
                  Accounts & invitations
                </button>
                <button
                  type="button"
                  aria-pressed={access === "identity"}
                  onClick={() =>
                    void requestNavigation(() => setAccess("identity"))
                  }
                >
                  Identity & access
                </button>
              </div>
              {access === "accounts" ? (
                <OfficeTeamWorkspace />
              ) : (
                <OfficeIdentityAccessPanel
                  employees={analytics.deptEmployees.filter(
                    (e) =>
                      e.department ===
                      (userProfile?.org_id || userProfile?.departmentId),
                  )}
                  roles={roles}
                />
              )}
            </>
          )}
        </>
      )}
      <TaskDetailDrawer
        task={task}
        taskId={task?.id}
        presentation="page"
        onClose={() => setTask(null)}
        canDiscuss
      />
    </div>
  );
  return (
    <PeopleWorkspaceShell
      title={home ? "Office overview" : "Project & Employee Analytics"}
      subtitle={
        home
          ? "Project delivery, team workload and decisions that need your attention."
          : "Projects, people, work health and employee development in one place."
      }
      actions={
        home ? (
          <button
            type="button"
            className="ea-button ea-button--primary"
            onClick={() =>
              void requestNavigation(() =>
                onNavigate
                  ? onNavigate("team", "Analytics")
                  : writeNavigationLocation("team", "Analytics", "push"),
              )
            }
          >
            Open full analytics
            <ArrowRight size={15} />
          </button>
        ) : undefined
      }
    >
      {main}
    </PeopleWorkspaceShell>
  );
}
type Analytics = ReturnType<typeof useDepartmentTeamAnalytics>;
function skillsFor(analytics: Analytics, employee: Employee) {
  const raw = analytics.profilesById.get(employee.id)?.skills;
  try {
    const skills = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Object.entries(skills || {})
      .filter(([, v]) => v === true || v === "true")
      .map(([key]) => key);
  } catch {
    return [];
  }
}
function EmployeeDetails({
  employee,
  metric,
  analytics,
}: {
  employee: Employee;
  metric: Analytics["memberMetrics"][number];
  analytics: Analytics;
}) {
  const { notes, loading } = useEmployeeNotes();
  if (loading)
    return (
      <WorkspaceLoadingSkeleton label="Loading employee notes…" rows={3} />
    );
  return (
    <EmployeeIntelligencePanel
      employee={employee}
      metric={metric}
      note={notes[employee.id]}
      storedSkills={skillsFor(analytics, employee)}
      facts={analytics.facts}
      tasks={analytics.tasks}
      updatedBy={analytics.userProfile?.uid}
    />
  );
}
function EmployeeSkills({ analytics }: { analytics: Analytics }) {
  const { notes, loading } = useEmployeeNotes();
  const merged: Record<string, EmployeeNote> = { ...notes };
  for (const employee of analytics.deptEmployees)
    merged[employee.id] = {
      ...notes[employee.id],
      tags: [
        ...new Set([
          ...(notes[employee.id]?.tags || []),
          ...skillsFor(analytics, employee),
        ]),
      ],
    } as EmployeeNote;
  return loading ? (
    <WorkspaceLoadingSkeleton label="Loading skills coverage…" rows={3} />
  ) : (
    <SkillCoveragePanel
      rows={buildSkillCoverage(analytics.deptEmployees, merged)}
    />
  );
}
