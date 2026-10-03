// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DraftTaskRow } from "../../src/app/features/proposal-import/components/DraftTaskRow";
import { createManualPlanTask } from "../../src/app/features/proposal-import/services/manualPlanDraft";

describe("manual proposal task editing", () => {
  it("exposes and saves every field required by draft validation", () => {
    const onUpdate = vi.fn();
    render(
      <DraftTaskRow
        dt={createManualPlanTask({
          proposalTitle: "Inter-office plan",
          programIdx: 0,
          projectIdx: 0,
          activityIdx: 0,
        })}
        employees={[]}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
        onOpenModal={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle("Edit task"));
    fireEvent.change(screen.getByRole("textbox", { name: "Task title" }), { target: { value: "Joint delivery" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Task description" }), { target: { value: "Deliver the approved inter-office output." } });
    fireEvent.change(screen.getByLabelText("Task deadline"), { target: { value: "2026-10-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onUpdate).toHaveBeenCalledWith(expect.any(String), { title: "Joint delivery" });
    expect(onUpdate).toHaveBeenCalledWith(expect.any(String), { description: "Deliver the approved inter-office output." });
    expect(onUpdate).toHaveBeenCalledWith(expect.any(String), { deadline: "2026-10-15" });
  });
});
