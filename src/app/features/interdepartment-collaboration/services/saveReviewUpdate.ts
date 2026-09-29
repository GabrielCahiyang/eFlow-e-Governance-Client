export class SavedPlanApprovalError extends Error {}

/** Preserve the saved version if the subsequent approval-request transaction fails. */
export async function saveReviewUpdate(save: () => Promise<unknown>, requestReview?: () => Promise<void>): Promise<void> {
  await save();
  if (!requestReview) return;
  try { await requestReview(); }
  catch (error) {
    const detail = error instanceof Error ? error.message : "Please try again.";
    throw new SavedPlanApprovalError(`Changes saved. Approval requests could not be sent. Use Resend approval requests to retry. ${detail}`);
  }
}
