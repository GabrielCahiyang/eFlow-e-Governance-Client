import type { PreviewTourStep } from "./walkthroughSteps";

export function getPreviewWorkspace(step: PreviewTourStep) {
  const labels = { plans: "Plans & Projects", leading: "Work I'm Leading", subtasks: "My Subtasks", reviews: step.actor === "Task Leader" ? "Leader Reviews" : "Reviews", budget: "Department Budget", accounting: "Voucher & Cash Releases" };
  const title = { plans: step.screen === "start" ? "Plans & Projects" : "Community Services Improvement", leading: "Pinned — You're Leading", subtasks: "My Subtask Checklist", reviews: "For Review", budget: "Department Budget", accounting: "Voucher & Cash Releases" };
  return { label: labels[step.workspace], title: title[step.workspace], path: [labels[step.workspace], step.tab, step.detail].filter(Boolean).join(" → ") };
}
