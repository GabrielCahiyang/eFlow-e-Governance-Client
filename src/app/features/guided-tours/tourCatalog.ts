import type { GuidedTourSection, GuidedTourStep } from "./types";

const SECTION_GUIDANCE: Record<string, string> = {
  dashboard: "Review the office or system summary, urgent work, deadlines, and the items that need attention today.",
  command: "Use the command center to understand current operations before opening detailed workspaces.",
  projects: "Open operational projects, inspect milestones and members, build work plans, import AI proposal drafts, and reuse approved templates.",
  tasks: "Track task ownership and lifecycle status. Switch between List, Kanban, Timeline, and Hierarchy without changing the underlying records.",
  budget: "Heads set and lock the annual budget, authorize task funding requests, verify receipts, and monitor utilization. Members request and liquidate cash inside the task or subtask that needs it.",
  leading: "Manage work where you are the Team Leader, create and assign subtasks, and review member evidence.",
  subtasks: "Open each assigned subtask, report progress, attach evidence, and submit completed work to the Team Leader.",
  reviews: "Validate submitted evidence, inspect work history, approve acceptable work, or request specific corrections.",
  team: "Supervise assignments, workloads, deadlines, blockers, and current member activity within your office.",
  intelligence: "Review workload and performance indicators to identify delays, overload, or support needs.",
  deadlines: "See upcoming and overdue work in one place and open the affected task for action.",
  history: "Review completed, cancelled, reopened, and previously submitted work without changing its audit history.",
  performance: "Review your operational performance indicators and the records used to calculate them.",
  reports: "Filter and review operational reports, then export information when the page provides an export action.",
  announcements: "Read official announcements and confirm which communications are new or already viewed.",
  users: "Create and maintain user accounts, roles, employment identifiers, activation state, and direct office assignment.",
  org_tree: "Maintain the official office structure and assign each office's Head.",
  permissions: "Review role capabilities and explicit user overrides. Database security remains enforced separately by Supabase policies.",
  audit: "Inspect accountable system activity, actors, timestamps, affected records, and recorded reasons.",
  administration: "Maintain system configuration and operational settings intended for administrators.",
  migration: "Use controlled migration tools only for reviewed data movement and verify results before leaving the page.",
  portfolio: "Review city-level project health, progress, risks, ownership, and cross-office indicators.",
  transform: "Inspect transformation initiatives and the operational information supporting executive decisions.",
  financial: "Review financial execution and project-level financial indicators without changing Finance workflow ownership.",
  legdash: "Review the active legislative pipeline and measures that require action or monitoring.",
  session: "Prepare and manage session records, agenda items, proceedings, and official outputs.",
  committee: "Review committee matters, supporting records, and the measures assigned for committee action.",
  councilor: "Open the Councilor workspace for assigned measures, sessions, and legislative responsibilities.",
  workforce: "Review workforce capacity, risk indicators, and office-level people information.",
  wellness: "Review attendance and wellness alerts that require appropriate HRMO follow-up.",
  compliance: "Track performance and civil-service compliance records available to HRMO.",
  projfin: "Review the financial position of programs and projects within the Finance workspace.",
  liquidation: "Inspect liquidation records, supporting receipts, and verification status.",
  crypto: "Review integrity records and hashes associated with finalized financial activity.",
  settings: "Manage your profile, appearance, notification preferences, and account security.",
};

export function getSectionGuidance(section: string, label: string): string {
  return SECTION_GUIDANCE[section] || `Use ${label} to review and complete the responsibilities available to your role.`;
}

export function getSystemTourSteps(
  sections: GuidedTourSection[],
  navigate: (section: string, page: string) => void,
): GuidedTourStep[] {
  return [
    {
      id: "system-welcome",
      title: "Welcome to eFlow",
      description: "This guided tour introduces your role-specific workspace. It only explains the interface and will never create, approve, delete, or modify records.",
      target: "[data-tour-id='brand']",
    },
    {
      id: "system-navigation",
      title: "Your navigation",
      description: "The sidebar only displays destinations available to your role. Select a destination at any time to move between workspaces.",
      target: "[data-tour-id='primary-navigation']",
    },
    ...sections.map((section) => ({
      id: `system-section-${section.id}`,
      title: section.label,
      description: getSectionGuidance(section.id, section.label),
      target: `[data-tour-section='${section.id}']`,
      beforeShow: () => navigate(section.id, section.page),
    })),
    {
      id: "system-page-help",
      title: "Help for every page",
      description: "Select Walkthrough on any page for instructions focused on that workspace. You can replay page guidance whenever needed.",
      target: "[data-tour-id='page-walkthrough']",
    },
    {
      id: "system-communication",
      title: "Notifications and communication",
      description: "Use these controls to review notifications, open work conversations, and receive call alerts without leaving your workspace.",
      target: "[data-tour-id='communications']",
    },
    {
      id: "system-restart",
      title: "Replay the system tour",
      description: "Start Walkthrough at any time to repeat this complete role-specific tour from the beginning.",
      target: "[data-tour-id='system-walkthrough']",
    },
    {
      id: "system-settings",
      title: "Personal settings",
      description: "Open Settings to update your profile, appearance, notification preferences, and security options.",
      target: "[data-tour-id='settings']",
    },
    {
      id: "system-profile",
      title: "Your signed-in account",
      description: "Confirm your name and role here. Always sign out when you finish using a shared workstation.",
      target: "[data-tour-id='profile']",
    },
  ];
}

export function getPageTourSteps(section: string, page?: string): GuidedTourStep[] {
  const label = page || section;
  return [
    {
      id: "page-navigation",
      title: `${label} in the sidebar`,
      description: "The highlighted sidebar destination shows where you are. Select another destination when you need to change workspaces.",
      target: `[data-tour-section='${section}']`,
    },
    {
      id: "page-title",
      title: label,
      description: getSectionGuidance(section, label),
      target: () => document.querySelector<HTMLElement>("[data-tour-page-content] h1") || document.querySelector<HTMLElement>("[data-tour-page-content]"),
    },
    {
      id: "page-workspace",
      title: "Working on this page",
      description: "Review the summary first, then use the visible filters, views, cards, tables, and action buttons. Disabled controls indicate that the action is unavailable for the current record or your role.",
      target: "[data-tour-page-content]",
    },
    {
      id: "page-help",
      title: "Walkthrough available anytime",
      description: "You can reopen this page guide whenever you need a reminder. Completing or skipping the guide never changes operational data.",
      target: "[data-tour-id='page-walkthrough']",
    },
  ];
}
