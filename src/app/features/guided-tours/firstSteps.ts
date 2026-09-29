import type { GuidedTourSection } from "./types";

export function suggestedFirstSteps(role: string, sections: GuidedTourSection[]) {
  const priorities = role === "super_admin" ? ["projects", "users", "org_tree"]
    : ["dept_head", "department_head"].includes(role) ? ["projects", "team", "reviews"]
    : ["tasks", "subtasks", "reviews", "dashboard"];
  const descriptions: Record<string, string> = {
    projects: role === "super_admin" ? "See citywide projects and department approval status." : "Create a work plan, then review its tasks, departments, team, and budget.",
    team: "Check available staff and workload before assigning tasks.",
    reviews: "Open pending requests and review the work before deciding.",
    tasks: "Open your assigned tasks and check their deadlines.",
    subtasks: "Update your work and submit evidence when it is ready.",
    users: "Check accounts and their access roles.",
    org_tree: "Check departments and their designated heads.",
    dashboard: "Review the work and alerts available to your account.",
  };
  const matches = priorities.flatMap((id) => {
    const section = sections.find((item) => item.id === id);
    return section ? [{ ...section, description: descriptions[id] }] : [];
  });
  return matches.length ? matches.slice(0, 2) : sections.slice(0, 2).map((section) => ({ ...section, description: `Open ${section.label} to see your available actions.` }));
}
