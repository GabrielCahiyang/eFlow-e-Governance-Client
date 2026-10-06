import { useMemo, useState } from "react";
import { AlertTriangle, Building2, Files, Inbox, ListTodo, UserX } from "lucide-react";
import { useTasks } from "../../../hooks/useFirebaseData";
import { useOrgs } from "../../../hooks/useSupabaseData";
import { TaskDetailDrawer } from "../../task-inspector";
import { Card, LoadingState, PageHeader, SearchInput, SectionEmpty, StatCard, WSelect } from "../../../components/workflow/primitives";
import { useNotificationNavigationIntent } from "../../notifications";
import { buildAdminTaskProposalGroups, isOverdue, isUnassigned } from "../selectors";
import type { Task } from "../taskTypes";
import { AdminTaskOversightList } from "./AdminTaskOversightList";

type QuickFilter = "none" | "unassigned" | "overdue" | "orphaned" | "review";

export function AdminTaskOversight() {
  const { tasks, loading } = useTasks();
  const { orgs } = useOrgs();
  const [query, setQuery] = useState("");
  const [orgFilter, setOrgFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("none");
  const [open, setOpen] = useState<Task | null>(null);

  useNotificationNavigationIntent(
    (intent) => ["task", "task_review", "subtask_review"].includes(intent.kind),
    (intent) => {
      if (loading) return false;
      const match = tasks.find((task) => task.id === intent.taskId);
      if (match) setOpen(match);
      return true;
    },
    [loading, tasks],
  );

  const visibleTasks = useMemo(() => tasks.filter((task) => !task.archivedAt), [tasks]);
  const proposalCount = useMemo(() => buildAdminTaskProposalGroups(visibleTasks).length, [visibleTasks]);
  const organizationIds = useMemo(() => new Set(orgs.map((org) => org.id)), [orgs]);
  const counts = useMemo(() => ({
    unassigned: visibleTasks.filter((task) => isUnassigned(task) || task.status === "pending_assignment").length,
    overdue: visibleTasks.filter(isOverdue).length,
    review: visibleTasks.filter((task) => task.status === "for_review").length,
    orphaned: visibleTasks.filter((task) => task.orgId && !organizationIds.has(task.orgId)).length,
  }), [organizationIds, visibleTasks]);

  const filtered = useMemo(() => {
    let rows = visibleTasks;
    if (orgFilter !== "all") rows = rows.filter((task) => task.orgId === orgFilter);
    if (statusFilter !== "all") rows = rows.filter((task) => task.status === statusFilter);
    if (quickFilter === "unassigned") rows = rows.filter((task) => isUnassigned(task) || task.status === "pending_assignment");
    if (quickFilter === "overdue") rows = rows.filter(isOverdue);
    if (quickFilter === "orphaned") rows = rows.filter((task) => Boolean(task.orgId && !organizationIds.has(task.orgId)));
    if (quickFilter === "review") rows = rows.filter((task) => task.status === "for_review");
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery) {
      rows = rows.filter((task) => [task.title, task.description, task.assigneeName, task.teamName, task.proposalTitle, task.programTitle, task.projectTitle, task.activityTitle]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery)));
    }
    return [...rows].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [orgFilter, organizationIds, query, quickFilter, statusFilter, visibleTasks]);

  if (loading) return <div className="p-8"><LoadingState label="Loading task oversight…" /></div>;
  const organizationName = (orgId?: string) => orgId ? orgs.find((org) => org.id === orgId)?.name || "Unknown organization" : "Not assigned";
  const toggleQuickFilter = (next: QuickFilter) => setQuickFilter((current) => current === next ? "none" : next);

  return (
    <div className="min-h-full bg-neutral-50 p-3 sm:p-8">
      <PageHeader
        eyebrow="Administration · Operational Oversight"
        title="Task Oversight"
        subtitle="Inspect every proposal through its programs, projects, and delivery tasks without changing operational work."
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Proposals" value={proposalCount} hint={`${visibleTasks.length} visible tasks`} icon={<Files size={15} />} />
        <StatCard label="Unassigned" value={counts.unassigned} tone={counts.unassigned ? "info" : "neutral"} icon={<UserX size={15} />} onClick={() => toggleQuickFilter("unassigned")} active={quickFilter === "unassigned"} />
        <StatCard label="Overdue" value={counts.overdue} tone={counts.overdue ? "bad" : "good"} icon={<AlertTriangle size={15} />} onClick={() => toggleQuickFilter("overdue")} active={quickFilter === "overdue"} />
        <StatCard label="Awaiting review" value={counts.review} tone={counts.review ? "warn" : "neutral"} icon={<Inbox size={15} />} onClick={() => toggleQuickFilter("review")} active={quickFilter === "review"} />
        <StatCard label="Data issues" value={counts.orphaned} tone={counts.orphaned ? "bad" : "good"} icon={<Building2 size={15} />} onClick={() => toggleQuickFilter("orphaned")} active={quickFilter === "orphaned"} />
      </div>

      <Card className="mb-4 shadow-sm" bodyClassName="p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder="Search proposal, program, project, task, or person…" className="w-full sm:w-[360px]" />
          <WSelect value={orgFilter} onChange={setOrgFilter} options={[{ value: "all", label: "All organizations" }, ...orgs.map((org) => ({ value: org.id, label: org.name }))]} />
          <WSelect value={statusFilter} onChange={setStatusFilter} options={[
            { value: "all", label: "All statuses" },
            { value: "pending_assignment", label: "Unassigned" },
            { value: "todo", label: "To Do" },
            { value: "in_progress", label: "In Progress" },
            { value: "for_review", label: "For Review" },
            { value: "changes_requested", label: "Changes Requested" },
            { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
          ]} />
          <div className="ml-auto flex items-center gap-2 text-[10.5px] text-neutral-500"><ListTodo size={13} /> {filtered.length} matching records</div>
          {quickFilter !== "none" && <button type="button" onClick={() => setQuickFilter("none")} className="rounded-lg px-2.5 py-1.5 text-[10.5px] font-medium text-neutral-600 hover:bg-neutral-100">Clear signal filter</button>}
        </div>
      </Card>

      {filtered.length ? (
        <AdminTaskOversightList tasks={filtered} orgName={organizationName} onOpen={setOpen} />
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white"><SectionEmpty icon={<ListTodo size={30} />} title="No task records match" description="Adjust the search, organization, status, or signal filters." /></div>
      )}

      <TaskDetailDrawer task={open} onClose={() => setOpen(null)} canReview={false} canDiscuss={false} readOnly />
    </div>
  );
}
