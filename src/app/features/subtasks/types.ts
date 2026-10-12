import type { Subtask } from "../../services/subtaskService";
import type { WorkNodeDisplayMetadata } from "../nested-work";

export interface SubtaskSubmissionAttachment {
  id?: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}

export interface SubtaskProgressUpdate {
  id: string;
  subtaskId: string;
  taskId: string;
  authorId: string;
  authorName: string;
  percentComplete: number;
  blockerCategory?: string;
  blocker?: string;
  nextStep?: string;
  note?: string;
  attachmentPath?: string;
  attachmentName?: string;
  createdAt: number;
}

export interface SubtaskSubmission {
  /** Current item context only; recorded submitter/reviewer remain authoritative. */
  workContext?: WorkNodeDisplayMetadata;
  id: string;
  subtaskId: string;
  taskId: string;
  version: number;
  submitterId: string;
  submitterName: string;
  reviewerId: string;
  note: string;
  status: "pending" | "approved" | "changes_requested";
  decisionFeedback?: string;
  decidedByName?: string;
  /** Actual recorded decision identity/time; never the current queue reviewer. */
  decidedById?: string;
  decidedAt?: number;
  submittedAt: number;
  attachments: SubtaskSubmissionAttachment[];
}

export interface SubtaskReviewItem {
  subtask: Subtask;
  submission: SubtaskSubmission;
  taskTitle: string;
  projectTitle?: string;
}

export interface SubtaskReviewerIdentity {
  id: string;
  name: string;
  role: string;
  organizationName?: string;
}
