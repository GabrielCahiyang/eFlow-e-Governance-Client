import { useEffect, useMemo, useState } from "react";
import { AttentionBox, Avatar, Search as VibeSearch, Tab, TabList, TabsContext } from "@vibe/core";
import { BrainCircuit, Sparkles, Trophy, UsersRound } from "lucide-react";
import { SectionEmpty } from "../../../../components/workflow/primitives";
import { WorkspaceLoadingSkeleton } from "../../../../components/workflow/WorkspaceLoadingSkeleton";
import { useEmployeeNotes } from "../../../../hooks/useFirebaseData";
import type { Employee } from "../../../members";
import { buildSkillCoverage } from "../../selectors/teamAnalyticsSelectors";
import { useDepartmentTeamAnalytics } from "../../hooks/useDepartmentTeamAnalytics";
import { EmployeeIntelligencePanel } from "./EmployeeIntelligencePanel";
import { SkillCoveragePanel } from "./SkillCoveragePanel";
import { TeamHealthOverview } from "./TeamHealthOverview";
import { MonthlyLeaderboard } from "../../../productivity";
import { TEAM_WORKLOAD_ELEVATED_THRESHOLD, TEAM_WORKLOAD_HIGH_THRESHOLD } from "../../constants";
import { PeopleWorkspaceShell } from "../PeopleWorkspaceShell";
import {
  EmployeeIntelligencePanelSkeleton,
  SkillCoveragePanelSkeleton,
} from "../analytics/EmployeeAnalyticsWorkspace";

type View = "overview" | "people" | "skills" | "leaderboard";

export function TeamIntelligenceWorkspace() {
  const analytics = useDepartmentTeamAnalytics();
  const { notes, loading: notesLoading } = useEmployeeNotes();
  const [view, setView] = useState<View>("overview");
  const [search, setSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>();

  useEffect(() => {
    setSelectedEmployeeId((current) => current && analytics.deptEmployees.some((employee) => employee.id === current) ? current : analytics.deptEmployees[0]?.id);
  }, [analytics.deptEmployees]);

  const storedSkillsFor = (employee: Employee): string[] => {
    const profile = analytics.profilesById.get(employee.id) || (employee.email ? analytics.profilesByEmail.get(employee.email.toLowerCase()) : undefined);
    const rawSkills = profile?.skills;
    if (!rawSkills) return [];
    if (typeof rawSkills === "string") {
      try { return Object.entries(JSON.parse(rawSkills) as Record<string, unknown>).filter(([, enabled]) => enabled === true || enabled === "true").map(([skill]) => skill); } catch { return []; }
    }
    return Object.entries(rawSkills).filter(([, enabled]) => enabled === true).map(([skill]) => skill);
  };
  const skills = useMemo(() => buildSkillCoverage(analytics.deptEmployees, notes), [analytics.deptEmployees, notes]);
  const query = search.trim().toLowerCase();
  const filteredEmployees = analytics.deptEmployees.filter((employee) => !query || `${employee.name} ${employee.jobTitle} ${notes[employee.id]?.tags?.join(" ") || ""}`.toLowerCase().includes(query));
  const selectedEmployee = analytics.deptEmployees.find((employee) => employee.id === selectedEmployeeId);
  const selectedMetric = analytics.memberMetrics.find((metric) => metric.employeeId === selectedEmployeeId);

  const intelligenceTabs = [
    { id: "overview", label: "Office health", icon: <Sparkles size={13} /> },
    { id: "people", label: "Member 360", icon: <UsersRound size={13} /> },
    { id: "skills", label: "Skills coverage", icon: <BrainCircuit size={13} /> },
    { id: "leaderboard", label: "Monthly contribution", icon: <Trophy size={13} /> },
  ] as const;
  const activeIntelligenceTab = intelligenceTabs.findIndex((tab) => tab.id === view);

  return (
    <PeopleWorkspaceShell title="Team Intelligence" subtitle="Understand delivery quality, workload concentration, review patterns, and skills while preserving the manager context used by AI assignments." actions={<span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[12px] font-medium text-violet-700"><BrainCircuit size={13} /> AI assignment inputs preserved</span>}>
      {analytics.error && <AttentionBox className="mb-4" text={`Historical workflow details are partially unavailable: ${analytics.error}`} type="warning" />}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 max-w-full overflow-x-auto" role="region" aria-label="Team intelligence views" tabIndex={0}>
          <TabsContext activeTabId={activeIntelligenceTab} id="team-intelligence-tabs">
            <TabList id="team-intelligence-tab-list">
              {intelligenceTabs.map((tab) => <Tab active={view === tab.id} id={tab.id} key={tab.id} onClick={() => setView(tab.id)}><span className="inline-flex items-center gap-1.5">{tab.icon}{tab.label}</span></Tab>)}
            </TabList>
          </TabsContext>
        </div>
        {view === "people" && <VibeSearch className="eflow-people-search w-64 max-w-full" clearIconLabel="Clear people search" inputAriaLabel="Search Office people, job titles or note tags" onChange={setSearch} onClear={() => setSearch("")} placeholder="Search name, job title or note tag…" showClearIcon size="small" value={search} />}
      </div>

      {analytics.loading || notesLoading ? <TeamIntelligenceViewSkeleton view={view} /> : <>
      {view === "overview" && <div className="space-y-4"><TeamHealthOverview health={analytics.health} members={analytics.memberMetrics} /><AttentionBox title="How to read this page" text="Metrics are derived from task and subtask participation, progress, submissions, and decisions. They support supervision and assignment decisions but do not constitute an automatic performance rating. Open Member 360 to inspect source activity before making a judgment." type="primary" /></div>}

      {view === "people" && (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-neutral-200 bg-white p-2 xl:sticky xl:top-4">
            {filteredEmployees.map((employee) => { const metric = analytics.memberMetrics.find((row) => row.employeeId === employee.id); return <button aria-pressed={selectedEmployeeId === employee.id} key={employee.id} type="button" onClick={() => setSelectedEmployeeId(employee.id)} className={`mb-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${selectedEmployeeId === employee.id ? "bg-neutral-100" : "hover:bg-neutral-50"}`}><Avatar aria-label={employee.name} size="small" text={employee.initials || "??"} /><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium text-neutral-800">{employee.name}</div><div className="truncate text-[12px] text-neutral-500">{employee.jobTitle}</div></div><span className={`eflow-tabular text-[12px] font-medium ${metric && metric.workloadSignal >= TEAM_WORKLOAD_HIGH_THRESHOLD ? "text-red-600" : metric && metric.workloadSignal >= TEAM_WORKLOAD_ELEVATED_THRESHOLD ? "text-amber-600" : "text-emerald-600"}`}>{metric?.workloadSignal ?? 0}</span></button>; })}
            {filteredEmployees.length === 0 && <SectionEmpty illustration="search" title="No matching people" description="Try a different name, job title or note tag." />}
          </aside>
          {selectedEmployee && selectedMetric ? <EmployeeIntelligencePanel employee={selectedEmployee} metric={selectedMetric} note={notes[selectedEmployee.id]} storedSkills={storedSkillsFor(selectedEmployee)} facts={analytics.facts} tasks={analytics.tasks} updatedBy={analytics.userProfile?.uid} /> : <div className="rounded-xl border border-dashed border-neutral-200"><SectionEmpty illustration="people" title="Select an member" description="Choose a person to inspect their source activity and delivery context." /></div>}
        </div>
      )}

      {view === "skills" && <SkillCoveragePanel rows={skills} />}
      {view === "leaderboard" && <div className="space-y-3"><AttentionBox title="Governance note" text="This ranking is a recognition and supervision aid. It is not added to the AI member-recommendation inputs and must not be used as the sole assignment or personnel decision signal." type="neutral" /><MonthlyLeaderboard employees={analytics.deptEmployees} tasks={analytics.tasks} facts={analytics.facts} currentUserId={analytics.userProfile?.id || analytics.userProfile?.uid} /></div>}
      </>}
    </PeopleWorkspaceShell>
  );
}

function TeamIntelligenceViewSkeleton({ view }: { view: View }) {
  if (view === "skills") {
    return <SkillCoveragePanelSkeleton label="Loading team intelligence…" />;
  }
  if (view === "people") {
    return (
      <WorkspaceLoadingSkeleton
        label="Loading team intelligence…"
        className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[250px_minmax(0,1fr)]"
      >
        <aside className="rounded-xl border border-neutral-200 bg-white p-2 space-y-1.5" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-neutral-200/80" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="h-3.5 w-28 animate-pulse rounded bg-neutral-200/80" />
                <div className="h-2.5 w-20 animate-pulse rounded bg-neutral-100" />
              </div>
              <div className="h-3.5 w-6 animate-pulse rounded bg-neutral-200/70" />
            </div>
          ))}
        </aside>
        <div aria-hidden="true">
          <EmployeeIntelligencePanelSkeleton label="Loading team intelligence…" />
        </div>
      </WorkspaceLoadingSkeleton>
    );
  }
  return (
    <WorkspaceLoadingSkeleton label="Loading team intelligence…" className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3" aria-hidden="true">
        <section className="rounded-xl border border-neutral-200 bg-white p-4 xl:col-span-2">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <div className="h-4 w-32 animate-pulse rounded bg-neutral-200/80" />
              <div className="h-3 w-64 animate-pulse rounded bg-neutral-100" />
            </div>
            <div className="h-6 w-28 animate-pulse rounded-full bg-neutral-200/70" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl bg-neutral-50 p-3 space-y-2">
                <div className="h-3 w-20 animate-pulse rounded bg-neutral-200/70" />
                <div className="h-6 w-12 animate-pulse rounded bg-neutral-200/80" />
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg border border-neutral-100 bg-neutral-50/60 p-3 space-y-1.5">
                <div className="h-3 w-28 animate-pulse rounded bg-neutral-200/70" />
                <div className="h-5 w-16 animate-pulse rounded bg-neutral-200/80" />
                <div className="h-2.5 w-36 animate-pulse rounded bg-neutral-100" />
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
          <div className="h-3.5 w-40 animate-pulse rounded bg-neutral-200/80" />
          <div className="h-3 w-56 animate-pulse rounded bg-neutral-100" />
          <div className="mt-4 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-32 animate-pulse rounded bg-neutral-200/80" />
                  <div className="h-3 w-8 animate-pulse rounded bg-neutral-200/70" />
                </div>
                <div className="h-1.5 w-full animate-pulse rounded-full bg-neutral-100" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </WorkspaceLoadingSkeleton>
  );
}
