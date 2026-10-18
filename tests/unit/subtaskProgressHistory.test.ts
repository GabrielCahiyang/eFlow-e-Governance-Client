// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/app/features/subtasks/components/SubtaskEvidenceLink", () => ({
  SubtaskEvidenceLink: ({ fileName }: { fileName: string }) => createElement("span", null, fileName),
}));

import { SubtaskProgressHistory } from "../../src/app/features/subtasks/components/SubtaskProgressHistory";

describe("leader subtask progress history", () => {
  it("shows employee notes, blocker details, next step, attachment, and percentage", () => {
    render(createElement(SubtaskProgressHistory, {
      updates: [{
        id: "progress-1",
        subtaskId: "subtask-1",
        taskId: "task-1",
        authorId: "employee-1",
        authorName: "Gabriel Cahiyang",
        percentComplete: 50,
        blockerCategory: "Waiting on approval",
        blocker: "Needs signed attendance sheet",
        nextStep: "Prepare the final agenda",
        note: "Draft agenda is complete",
        attachmentPath: "subtasks/subtask-1/progress/evidence.pdf",
        attachmentName: "evidence.pdf",
        createdAt: Date.now(),
      }],
    }));

    expect(screen.getByText("Gabriel Cahiyang")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText('Recorded progress value').closest('details')?.open).toBe(false);
    expect(screen.getByText('Stuck')).toBeTruthy();
    expect(screen.getByText("Draft agenda is complete")).toBeTruthy();
    expect(screen.getByText(/Needs signed attendance sheet/)).toBeTruthy();
    expect(screen.getByText(/Prepare the final agenda/)).toBeTruthy();
    expect(screen.getByText("evidence.pdf")).toBeTruthy();
  });
});
