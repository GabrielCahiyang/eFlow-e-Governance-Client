export interface RequestedTaskDetailCapabilities {
  canReview: boolean;
  canPostProgress: boolean;
  canSubmitForReview?: boolean;
  canDiscuss: boolean;
}

/**
 * Read-only oversight is an absolute boundary. Role permissions may add
 * capabilities to operational workspaces, but they cannot bypass this mode.
 */
export function resolveTaskDetailCapabilities(
  readOnly: boolean,
  requested: RequestedTaskDetailCapabilities,
): RequestedTaskDetailCapabilities {
  if (!readOnly) return requested;
  return {
    canReview: false,
    canPostProgress: false,
    canSubmitForReview: false,
    canDiscuss: false,
  };
}

/** Subtask structure belongs exclusively to the effective Task Leader. */
export function resolveSubtaskManagementCapability(
  readOnly: boolean,
  currentUserIsTaskLead: boolean,
): boolean {
  return !readOnly && currentUserIsTaskLead;
}
