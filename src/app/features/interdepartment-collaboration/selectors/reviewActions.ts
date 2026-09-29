import type { CollaborationDraftStatus } from "../types";

export function canRequestCollaborationApproval(status: CollaborationDraftStatus, isOwner: boolean, departmentOnly: boolean) {
  return isOwner && !departmentOnly && ["draft", "changes_requested", "in_review"].includes(status);
}

export function shouldResendAfterUpdate(status: CollaborationDraftStatus, material: boolean, departmentOnly: boolean) {
  return material && !departmentOnly && ["in_review", "changes_requested", "ready_to_commit"].includes(status);
}
