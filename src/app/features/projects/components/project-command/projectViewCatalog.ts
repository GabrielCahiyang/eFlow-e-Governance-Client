import type React from 'react';
import { Activity, Board, Calendar, Chart, CheckList, CreditCard, Dashboard, Description, Security, Table, Team, Timeline, Versioning } from '@vibe/icons';
import type { PermanentProjectView, ProjectViewMeta } from './types';

export const PERMANENT_TABS: { id: PermanentProjectView; label: string }[] = [
  { id: "tasks", label: "Main table" },
  { id: "gantt", label: "Gantt" },
  { id: "overview", label: "Overview" },
  { id: "timeline", label: "Timeline" },
  { id: "calendar", label: "Calendar" },
];

export const OPTIONAL_VIEWS_CATALOG: ProjectViewMeta[] = [
  { id:'readiness', label:'Readiness & closeout', category:'Governance', description:'Review structure, Office participation, task owners, schedule and financial closeout.' },
  { id:'board', label:'Board', category:'Project', description:'Status lanes over the same tasks, with permitted drag-and-drop moves.' },
  { id:'offices', label:'Offices', category:'Project', description:'Task ownership, completion and overdue work by Office.' },
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
    id: "dashboard",
    label: "Project Dashboard",
    category: "Insights",
    description: "Modular productivity widgets: delivery progress, blockers, and bottlenecks.",
  },
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
