import type React from 'react';
import { Activity, Board, Calendar, Chart, CheckList, CreditCard, Dashboard, Description, Security, Table, Team, Timeline, Versioning } from '@vibe/icons';
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
  { id:'readiness', label:'Readiness & closeout', category:'Governance', description:'Review structure, Office participation, task owners, schedule and financial closeout.' },
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
    id: "workload",
    label: "Workload & Team",
    category: "Insights",
    description: "Team member allocation, deliverable ownership, and delivery health.",
  },
  {
    id: "budget",
    label: "Budget Overview",
    category: "Insights",
    description: "Allocated funds, line items, petty cash, and receipts.",
    requiresBudget: true,
  },

  // Governance
  {
    id: "signoff",
    label: "Approval Status",
    category: "Governance",
    description: "Office endorsement matrix, approval status, and approval quorum.",
  },
  {
    id: "evidence",
    label: "Evidence Register",
    category: "Governance",
    description: "Directory of uploaded work artifacts, attachments, and completions.",
  },
  {
    id: "decisions",
    label: "Decision History",
    category: "Governance",
    description: "Formal change requests, approval notes, and milestone decisions.",
  },
];

/** Existing URL/prop aliases resolve to the same project view; unknown values are ignored. */
export function resolveProjectView(value: string | null | undefined): ProjectCommandTab | null {
  const aliases: Record<string, ProjectCommandTab> = { plan: 'timeline', delivery: 'timeline', work: 'tasks', people: 'workload', team: 'workload', main_table: 'tasks', 'main-table': 'tasks', 'proposal-context': 'proposal_context' };
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
  calendar: Calendar,
  reports: Table,
  proposal_context: Description,
  activity: Activity,
  reviews: CheckList,
  dashboard: Chart,
  workload: Team,
  budget: CreditCard,
  signoff: Security,
  evidence: CheckList,
  decisions: Versioning,
};
