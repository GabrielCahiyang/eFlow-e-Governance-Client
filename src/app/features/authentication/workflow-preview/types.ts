export type WorkflowKind = "interdepartmental" | "department";
export type WorkflowStage = "prepare" | "approve" | "work" | "finish";
export type PreviewIcon = "proposal" | "plan" | "departments" | "team" | "approval" | "publish" | "progress" | "evidence" | "funding" | "complete" | "archive";

export interface WorkflowStep {
  id: string;
  title: string;
  stage: WorkflowStage;
  icon: PreviewIcon;
  actor: string;
  location: string;
  description: string;
  actions: string[];
  outcome: string;
  condition?: string;
  returnPath?: string;
  preview: {
    title: string;
    status: string;
    rows: { label: string; value: string; tone?: "ready" | "pending" | "info" }[];
  };
}

export interface WorkflowGuide {
  kind: WorkflowKind;
  title: string;
  summary: string;
  scope: string;
  steps: WorkflowStep[];
}
