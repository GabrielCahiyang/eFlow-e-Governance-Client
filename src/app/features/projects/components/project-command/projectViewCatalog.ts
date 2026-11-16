import type React from 'react';
import { Settings } from 'lucide-react';
import { Activity, Board, Calendar, Chart, CheckList, CreditCard, Dashboard, Description, Table, Team, Timeline } from '@vibe/icons';
import type { PermanentProjectView, ProjectCommandTab, ProjectViewMeta } from './types';

export const PERMANENT_TABS: { id: PermanentProjectView; label: string }[] = [
  { id: "tasks", label: "Main table" },
  { id: "reviews", label: "Reviews" },
  { id: "members", label: "Members" },
  { id: "budget", label: "Budget" },
  { id: "analytics", label: "Analytics" },
  { id: "settings", label: "Settings" },
];

const CORE_VIEW_DETAILS: Record<PermanentProjectView, { category: "Project" | "Insights"; description: string }> = {
  tasks: { category: "Project", description: "Manage tasks, owners, statuses, and due dates." },
  reviews: { category: "Project", description: "Review task and subtask evidence submissions." },
  members: { category: "Project", description: "View project members, office roles, and access." },
  budget: { category: "Insights", description: "Track allocated funds, line items, petty cash, and receipts." },
  analytics: { category: "Insights", description: "Monitor progress, workload, and delivery metrics." },
  settings: { category: "Project", description: "Edit project details, scope, lead, and schedule." },
};

export const CORE_VIEWS_CATALOG: ProjectViewMeta<PermanentProjectView>[] = PERMANENT_TABS.map(view => ({
  ...view,
  ...CORE_VIEW_DETAILS[view.id],
}));

export const OPTIONAL_VIEWS_CATALOG: ProjectViewMeta[] = [
  // Project
  { id: "board", label: "Board", category: "Project", description: "Organize and move tasks across status columns." },
  { id: "gantt", label: "Gantt", category: "Project", description: "Plan schedules, milestones, and task dependencies." },
  { id: "calendar", label: "Calendar", category: "Project", description: "View task deadlines on a monthly calendar." },
  { id: "overview", label: "Overview", category: "Project", description: "Project summary, milestones, and attention items." },
  {
    id: "reports",
    label: "Reports",
    category: "Project",
    description: "Export progress tables and CSV or PDF summaries.",
  },
  {
    id: "proposal_context",
    label: "Proposal Context",
    category: "Project",
    description: "Originating work plan, participating offices, and revision history.",
    requiresProposal: true,
  },
  {
    id: "activity",
    label: "Audit Trail",
    category: "Project",
    description: "See who changed the project or its tasks, what changed, and when.",
  },
];

/** Existing URL/prop aliases resolve to the same project view; unknown values are ignored. */
export function resolveProjectView(value: string | null | undefined): ProjectCommandTab | null {
  const aliases: Record<string, ProjectCommandTab> = { plan: 'gantt', delivery: 'gantt', timeline: 'gantt', dashboard: 'overview', work: 'tasks', offices: 'members', people: 'members', team: 'members', workload: 'members', readiness: 'overview', signoff: 'members', evidence: 'reviews', decisions: 'activity', 'audit-trail': 'activity', main_table: 'tasks', 'main-table': 'tasks', 'proposal-context': 'proposal_context' };
  if (!value) return null;
  return Object.prototype.hasOwnProperty.call(aliases, value) ? aliases[value] : ([...PERMANENT_TABS, ...OPTIONAL_VIEWS_CATALOG].some(view => view.id === value) ? value as ProjectCommandTab : null);
}

export const VIEW_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  settings: Settings,
  overview: Dashboard,
  tasks: Board,
  timeline: Timeline,
  gantt: Timeline,
  board: Board,
  offices: Team,
  members: Team,
  calendar: Calendar,
  reports: Table,
  proposal_context: Description,
  activity: Activity,
  reviews: CheckList,
  dashboard: Chart,
  analytics: Chart,
  budget: CreditCard,
};
