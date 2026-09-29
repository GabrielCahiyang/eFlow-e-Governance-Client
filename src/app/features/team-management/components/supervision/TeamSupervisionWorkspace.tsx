import { useEffect, useMemo, useState } from "react";
import { AttentionBox, Button, Tab, TabList, TabsContext } from "@vibe/core";
import { AlertTriangle, CircleAlert, Clock3, ListFilter, UserPlus } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { StatCard, WSelect } from "../../../../components/workflow/primitives";
import { WorkspaceLoadingSkeleton } from "../../../../components/workflow/WorkspaceLoadingSkeleton";
import { TaskDetailDrawer } from "../../../tasks";
import type { Task } from "../../../tasks";
import { useDepartmentTeamAnalytics } from "../../hooks/useDepartmentTeamAnalytics";
import type { TeamAttentionKind } from "../../types";
import { TeamAttentionQueue } from "./TeamAttentionQueue";
import { TeamMemberBoard } from "./TeamMemberBoard";
import { TeamMemberOperationsPanel } from "./TeamMemberOperationsPanel";
import { DepartmentIdentityAccessPanel } from "./DepartmentIdentityAccessPanel";
import { TeamMemberWorkPanel } from "./TeamMemberWorkPanel";
import { PeopleWorkspaceShell } from "../PeopleWorkspaceShell";

type View = "attention" | "people" | "identity";

export function TeamSupervisionWorkspace() {
  const analytics = useDepartmentTeamAnalytics();
  const [view, setView] = useState<View>("people");
  const [attentionFilter, setAttentionFilter] = useState<TeamAttentionKind | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>();
  const [openTask, setOpenTask] = useState<Task | null>(null);

  useEffect(() => {
    setSelectedEmployeeId((current) => current && analytics.deptEmployees.some((employee) => employee.id === current) ? current : analytics.deptEmployees[0]?.id);
  }, [analytics.deptEmployees]);

  const selectedEmployee = analytics.deptEmployees.find((employee) => employee.id === selectedEmployeeId);
  const selectedMetric = analytics.memberMetrics.find((metric) => metric.employeeId === selectedEmployeeId);
  const filteredAttention = useMemo(() => analytics.attention.filter((item) => attentionFilter === "all" || item.kind === attentionFilter), [analytics.attention, attentionFilter]);
  const criticalCount = analytics.attention.filter((item) => item.severity === "critical").length;
  const canManageIdentity = ["dept_head", "department_head"].includes(analytics.userProfile?.role || "");
  const roleByEmployeeId = useMemo(() => new Map(Array.from(analytics.profilesById.entries()).map(([id, profile]) => [id, String(profile.role || "employee")])), [analytics.profilesById]);
  const directDepartmentEmployees = useMemo(
    () => analytics.deptEmployees.filter((employee) => employee.department === analytics.userProfile?.departmentId),
    [analytics.deptEmployees, analytics.userProfile?.departmentId],
  );

  const openTaskById = (taskId: string) => setOpenTask(analytics.tasks.find((task) => task.id === taskId) || null);
  const selectEmployee = (employeeId: string) => {
    if (!analytics.deptEmployees.some((employee) => employee.id === employeeId)) return;
    setSelectedEmployeeId(employeeId);
    setView("people");
  };

  return (
    <PeopleWorkspaceShell title="Team Supervision" subtitle="Review your team roster, current work, delivery risk, and safe assignment changes from one live workspace." actions={<><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-medium text-emerald-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live workflow data</span><Button kind="primary" onClick={() => setView("identity")} size="small"><UserPlus size={14} /> Add member</Button></>}>

      {analytics.error && <AttentionBox className="mb-4" text={`Some workflow details could not be loaded: ${analytics.error}. Task-level data remains available.`} type="warning" />}

      {analytics.loading ? <WorkspaceLoadingSkeleton label="Loading live supervision data…" rows={5} /> : <>
      <div className="mb-5 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Needs attention" value={analytics.attention.length} hint={`${criticalCount} critical`} tone={criticalCount ? "bad" : analytics.attention.length ? "warn" : "good"} icon={<ListFilter size={15} />} onClick={() => setView("attention")} active={view === "attention"} />
        <StatCard label="Overdue" value={analytics.health.overdue} tone={analytics.health.overdue ? "bad" : "good"} icon={<AlertTriangle size={15} />} onClick={() => { setView("attention"); setAttentionFilter("overdue"); }} />
        <StatCard label="Blocked / stalled" value={analytics.health.blocked + analytics.health.stalled} tone={analytics.health.blocked ? "bad" : analytics.health.stalled ? "warn" : "good"} icon={<CircleAlert size={15} />} onClick={() => { setView("attention"); setAttentionFilter(analytics.health.blocked ? "blocked" : "stalled"); }} />
        <StatCard label="Review waiting" value={analytics.health.awaitingReview} tone={analytics.health.awaitingReview ? "warn" : "good"} icon={<Clock3 size={15} />} onClick={() => { setView("attention"); setAttentionFilter("awaiting_review"); }} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="w-full min-w-0 overflow-x-auto"><TabsContext activeTabId={view === "attention" ? 0 : view === "people" ? 1 : 2} id="team-supervision-tabs">
          <TabList id="team-supervision-tab-list">
            <Tab active={view === "attention"} id="attention" onClick={() => setView("attention")}>Attention queue</Tab>
            <Tab active={view === "people"} id="people" onClick={() => setView("people")}>People & workload</Tab>
            {canManageIdentity ? <Tab active={view === "identity"} id="identity" onClick={() => setView("identity")}>Identity &amp; Access</Tab> : <></>}
          </TabList>
        </TabsContext></div>
        {view === "attention" && <WSelect ariaLabel="Filter attention queue" value={attentionFilter} onChange={(value) => setAttentionFilter(value as TeamAttentionKind | "all")} options={[ { value: "all", label: "All attention items" }, { value: "overdue", label: "Overdue" }, { value: "due_soon", label: "Due soon" }, { value: "blocked", label: "Blocked" }, { value: "stalled", label: "Stalled" }, { value: "awaiting_review", label: "Review waiting" }, { value: "changes_requested", label: "Updates needed" }, { value: "unassigned", label: "Unassigned" }, { value: "vague_schedule", label: "Vague schedules" } ]} />}
      </div>

      <div className={`grid grid-cols-1 items-start gap-5 ${view === "people" ? "xl:grid-cols-[250px_minmax(0,1fr)_390px]" : view === "identity" ? "" : "xl:grid-cols-[minmax(0,1fr)_390px]"}`}>
        {view === "people" && <TeamMemberBoard employees={analytics.deptEmployees} layout="rail" metrics={analytics.memberMetrics} selectedEmployeeId={selectedEmployeeId} search={search} onSearch={setSearch} onSelect={setSelectedEmployeeId} />}
        <main className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <m.div key={view} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: .18 }}>
              {view === "attention" ? <TeamAttentionQueue items={filteredAttention} onOpenTask={openTaskById} onSelectEmployee={selectEmployee} /> : view === "people" ? <TeamMemberWorkPanel employee={selectedEmployee} metric={selectedMetric} tasks={analytics.tasks} subtasks={analytics.facts.subtasks} onOpenTask={setOpenTask} /> : <DepartmentIdentityAccessPanel employees={directDepartmentEmployees} roles={roleByEmployeeId} />}
            </m.div>
          </AnimatePresence>
        </main>
        {view !== "identity" && <TeamMemberOperationsPanel employee={selectedEmployee} employees={analytics.deptEmployees} metric={selectedMetric} tasks={analytics.tasks} subtasks={analytics.facts.subtasks} onOpenTask={setOpenTask} />}
      </div>
      </>}

      <TaskDetailDrawer task={openTask} onClose={() => setOpenTask(null)} canDiscuss />
    </PeopleWorkspaceShell>
  );
}
