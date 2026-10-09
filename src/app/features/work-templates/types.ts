export type WorkTemplateVisibility = "personal" | "department";
export type WorkTemplateApprovalStatus = "pending" | "approved" | "rejected";

export interface SubtaskTemplateItem {
  id?: string;
  title: string;
  position: number;
  parentSubtaskId?: string;
}

export interface SubtaskTemplate {
  id: string;
  orgId: string;
  ownerId?: string;
  ownerName?: string;
  title: string;
  description: string;
  visibility: WorkTemplateVisibility;
  approvalStatus: WorkTemplateApprovalStatus;
  isStarter: boolean;
  items: SubtaskTemplateItem[];
  createdAt: number;
  updatedAt: number;
}

export interface SubtaskTemplateDraft {
  id?: string;
  title: string;
  description: string;
  visibility: WorkTemplateVisibility;
  items: SubtaskTemplateItem[];
}

export interface AppliedSubtaskTemplateItem {
  title: string;
  assignedToIds: string[];
}

export type SubtaskTemplateApplyMode = "merge" | "replace";

export interface SubtaskTemplateApplyResult {
  created: number;
  skipped: number;
  replaced: number;
}
