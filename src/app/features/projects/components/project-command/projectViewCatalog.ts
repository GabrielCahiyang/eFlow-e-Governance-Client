import type React from 'react';
import { Activity, Board, Calendar, Chart, CheckList, CreditCard, Dashboard, Description, Table, Team, Timeline } from '@vibe/icons';
import type { PermanentProjectView, ProjectCommandTab, ProjectViewMeta } from './types';

export const PERMANENT_TABS: { id: PermanentProjectView; label: string }[] = [
  { id: "tasks", label: "Main table" },
  { id: "board", label: "Board" },
  { id: "gantt", label: "Gantt" },
  { id: "calendar", label: "Calendar" },
  { id: "dashboard", label: "Project Dashboard" },
  { id: "offices", label: "Offices" },
];

export const CORE_VIEWS_CATALOG: ProjectViewMeta<PermanentProjectView>[] = PERMANENT_TABS.map(view => ({
  ...view, category: 'Project', description: 'Core project view over the same authorized tasks and project context.',
}));

export const OPTIONAL_VIEWS_CATALOG: ProjectViewMeta[] = [
  { id:'members', label:'Members', category:'Project', description:'Selected project people, Office responsibilities and effective access.' },
  { id:'overview', label:'Overview', category:'Project', description:'Project delivery summary, milestones and attention items.' },
  { id:'timeline', label:'Timeline', category:'Project', description:'Existing milestone planning and schedule tools.' },
  // Project
  {
    id: "reports",
    label: "Reports",
    category: "Project",
    description: "Exportable data registers, progress tables, and CSV/PDF summaries.",
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
    label: "Activity",
    category: "Project",
    description: "Chronological human-readable audit trail of all project events.",
  },
  {
    id: "reviews",
    label: "Reviews",
    category: "Project",
    description: "Task and subtask evidence reviews scoped to this project.",
  },

  // Insights
  {
    id: "budget",
    label: "Budget Overview",
    category: "Insights",
    description: "Allocated funds, line items, petty cash, and receipts.",
    requiresBudget: true,
  },

  // Governance
];

/** Existing URL/prop aliases resolve to the same project view; unknown values are ignored. */
export function resolveProjectView(value: string | null | undefined): ProjectCommandTab | null {
  const aliases: Record<string, ProjectCommandTab> = { plan: 'timeline', delivery: 'timeline', work: 'tasks', people: 'offices', team: 'offices', workload: 'offices', readiness: 'overview', signoff: 'offices', evidence: 'reviews', decisions: 'activity', main_table: 'tasks', 'main-table': 'tasks', 'proposal-context': 'proposal_context' };
  if (!value) return null;
  return Object.prototype.hasOwnProperty.call(aliases, value) ? aliases[value] : ([...PERMANENT_TABS, ...OPTIONAL_VIEWS_CATALOG].some(view => view.id === value) ? value as ProjectCommandTab : null);
}

export const VIEW_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
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
  budget: CreditCard,
};
