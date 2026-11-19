import { isAdminRole } from "../../shared/roles";
import type { GuidedTourSection } from "./types";

export function suggestedFirstSteps(role: string, sections: GuidedTourSection[]) {
  const priorities = isAdminRole(role)
    ? ["users"]
    : role === "head"
      ? ["projects", "team", "budget", "reviews"]
      : role === "accounting_staff"
        ? ["accounting_overview", "accounting_releases", "personal_work"]
        : ["personal_work", "tasks", "projects", "inbox"];
  const descriptions: Record<string, string> = {
    projects: "Manage office work plans, task groups, PDF proposal imports, and project funding.",
    team: "Open Analytics for delivery, workload, clean reports, and Deep Analysis, or manage your Office Team.",
    budget: "Plan and lock your annual Office Budget, authorize task funding, and track cash releases.",
    reviews: "Inspect submitted evidence and work history, then approve or request clear revisions.",
    personal_work: "See your assigned tasks, subtasks, leadership items, reviews, and history in one place.",
    inbox: "Check items that need your action alongside notifications and work messages.",
    tasks: "Track your assigned tasks across List, Kanban, Timeline, and Hierarchy views.",
    subtasks: "Update your subtask progress, attach evidence, and submit completed work for review.",
    accounting_overview: "Check pending cash releases, settlements, and fiscal-year ledger summaries.",
    accounting_releases: "Process voucher and cash releases and verify liquidation receipts.",
    users: "Create and maintain user accounts, roles, locked accounts, and access defaults.",
    org_tree: "Maintain offices and assign each office's Head.",
    dashboard: "Review today's workspace summary, active delivery, and urgent deadlines.",
  };
  const matches = priorities.flatMap((id) => {
    const section = sections.find((item) => item.id === id);
    return section ? [{ ...section, description: descriptions[id] || `Open ${section.label} to get started.` }] : [];
  });
  return matches.length
    ? matches.slice(0, 2)
    : sections.slice(0, 2).map((section) => ({
        ...section,
        description: `Open ${section.label} to see your available actions.`,
      }));
}
