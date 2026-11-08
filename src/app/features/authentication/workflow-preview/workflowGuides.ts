import type { WorkflowKind } from "./types";

export const WORKFLOW_GUIDES: Record<WorkflowKind, { title: string; summary: string }> = {
  interdepartmental: {
    title: "Interdepartmental flow",
    summary: "See how an outside office joins a single project, from invitation through delivery and closeout.",
  },
  department: {
    title: "Within-office flow",
    summary: "Follow a funded project from setup through task delivery, cash settlement, and archive.",
  },
};
