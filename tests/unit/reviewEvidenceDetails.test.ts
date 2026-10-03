// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/app/features/subtasks/components/SubtaskEvidenceLink", () => ({
  SubtaskEvidenceLink: ({ fileName }: { fileName: string }) => createElement("span", null, fileName),
}));

import { TaskReviewStandards } from "../../src/app/features/reviews/components/TaskReviewStandards";
import { TaskSubtaskEvidenceSection } from "../../src/app/features/reviews/components/TaskSubtaskEvidenceSection";

afterEach(cleanup);

const parentTask = {
  id: "task-1",
  title: "Prepare the detailed work plan",
  description: "Build the delivery plan.",
  status: "for_review" as const,
  createdAt: 0,
  updatedAt: 0,
  teamMemberIds: ["employee-1"],
  teamMemberNames: ["Gabriel Cahiyang"],
  acceptanceCriteria: ["Timeline covers every approved activity"],
  definitionOfDone: "Head accepts the work plan and evidence.",
  dependencyIds: ["dependency-1"],
};

describe("Head review evidence details", () => {
  it("shows completion standards and dependency state", () => {
    render(createElement(TaskReviewStandards, {
      task: parentTask,
      tasks: [parentTask, {
        id: "dependency-1",
        title: "Approve the inception report",
        description: "",
        status: "completed" as const,
        createdAt: 0,
        updatedAt: 0,
      }],
    }));

    expect(screen.getByText("Timeline covers every approved activity")).toBeTruthy();
    expect(screen.getByText("Head accepts the work plan and evidence.")).toBeTruthy();
    expect(screen.getByText("Approve the inception report")).toBeTruthy();
    expect(screen.getByText(/1\/1 complete/)).toBeTruthy();
  });

  it("shows each subtask's contributor, progress timeline, evidence, and leader decision", () => {
    render(createElement(TaskSubtaskEvidenceSection, {
      task: parentTask,
      loading: false,
      evidence: [{
        subtask: {
          id: "subtask-1",
          taskId: "task-1",
          title: "Draft the activity schedule",
          isCompleted: true,
          status: "completed" as const,
          percentComplete: 100,
          assignedTo: "employee-1",
          assignedToIds: ["employee-1"],
          position: 0,
          source: "manual" as const,
          createdAt: 0,
          updatedAt: 0,
        },
        progressUpdates: [{
          id: "progress-1",
          subtaskId: "subtask-1",
          taskId: "task-1",
          authorId: "employee-1",
          authorName: "Gabriel Cahiyang",
          percentComplete: 75,
          blockerCategory: "Waiting on approval",
          blocker: "Awaiting the venue confirmation",
          nextStep: "Finalize the dates",
          note: "Draft schedule attached",
          attachmentPath: "subtasks/subtask-1/progress/draft.pdf",
          attachmentName: "draft-schedule.pdf",
          createdAt: Date.now(),
        }],
        submissions: [{
          id: "submission-1",
          subtaskId: "subtask-1",
          taskId: "task-1",
          version: 1,
          submitterId: "employee-1",
          submitterName: "Gabriel Cahiyang",
          reviewerId: "lead-1",
          note: "Final activity schedule completed.",
          status: "approved" as const,
          decidedByName: "Crisostomo Ibarra",
          submittedAt: Date.now(),
          attachments: [{
            id: "attachment-1",
            fileName: "final-schedule.pdf",
            filePath: "subtasks/subtask-1/submission/final.pdf",
            fileSize: 1024,
            mimeType: "application/pdf",
          }],
        }],
      }],
    }));

    expect(screen.getByText("Draft the activity schedule")).toBeTruthy();
    expect(screen.getAllByText("Gabriel Cahiyang").length).toBeGreaterThan(0);
    expect(screen.getByText("75%")).toBeTruthy();
    expect(screen.getByText("Draft schedule attached")).toBeTruthy();
    expect(screen.getByText(/Awaiting the venue confirmation/)).toBeTruthy();
    expect(screen.getByText(/Finalize the dates/)).toBeTruthy();
    expect(screen.getByText("draft-schedule.pdf")).toBeTruthy();
    expect(screen.getByText("Final activity schedule completed.")).toBeTruthy();
    expect(screen.getByText("final-schedule.pdf")).toBeTruthy();
    expect(screen.getByText("Leader approved")).toBeTruthy();
  });
});
