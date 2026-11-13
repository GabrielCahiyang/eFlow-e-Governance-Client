import { describe, expect, it } from "vitest";
import {
  getSequentialStepNumber,
  getSubtaskPrerequisite,
  moveSequenceItem,
  moveSequenceItemToTarget,
  resequenceItems,
} from "../../src/app/features/subtasks/selectors/sequencing";

const items = [
  { id: "invite", position: 4 },
  { id: "slides", position: 9 },
  { id: "venue", position: 12 },
];

describe("ordered subtask sequencing", () => {
  it("normalizes gaps into contiguous zero-based positions", () => {
    expect(resequenceItems(items).map((item) => item.position)).toEqual([0, 1, 2]);
  });

  it("supports accessible up/down movement without changing IDs", () => {
    const result = moveSequenceItem(items, 2, 1);
    expect(result.map((item) => item.id)).toEqual(["invite", "venue", "slides"]);
    expect(result.map((item) => item.position)).toEqual([0, 1, 2]);
  });

  it("supports drag-to-target movement and leaves invalid requests stable", () => {
    expect(moveSequenceItemToTarget(items, "invite", "venue").map((item) => item.id)).toEqual(["slides", "venue", "invite"]);
    expect(moveSequenceItemToTarget(items, "missing", "venue").map((item) => item.id)).toEqual(["invite", "slides", "venue"]);
  });

  it("locks ordered work behind the first unfinished earlier step", () => {
    const sequence = [
      { id: "step-1", taskId: "task-1", title: "Invite participants", position: 0, isCompleted: false, isStandalone: false },
      { id: "step-2", taskId: "task-1", title: "Prepare slides", position: 1, isCompleted: false, isStandalone: false },
    ];
    expect(getSubtaskPrerequisite(sequence[1], sequence)?.id).toBe("step-1");
    expect(getSequentialStepNumber(sequence[1], sequence)).toBe(2);
    sequence[0].isCompleted = true;
    expect(getSubtaskPrerequisite(sequence[1], sequence)).toBeNull();
  });

  it("lets standalone work run in parallel without blocking the ordered chain", () => {
    const sequence = [
      { id: "step-1", taskId: "task-1", title: "Invite participants", position: 0, isCompleted: true, isStandalone: false },
      { id: "parallel", taskId: "task-1", title: "Arrange snacks", position: 1, isCompleted: false, isStandalone: true },
      { id: "step-2", taskId: "task-1", title: "Run meeting", position: 2, isCompleted: false, isStandalone: false },
    ];
    expect(getSubtaskPrerequisite(sequence[1], sequence)).toBeNull();
    expect(getSubtaskPrerequisite(sequence[2], sequence)).toBeNull();
    expect(getSequentialStepNumber(sequence[1], sequence)).toBeNull();
    expect(getSequentialStepNumber(sequence[2], sequence)).toBe(2);
  });

  it("never lets another parent task become a prerequisite", () => {
    const other = { id: "other", taskId: "task-2", title: "Other", position: 0, isCompleted: false };
    const current = { id: "current", taskId: "task-1", title: "Current", position: 1, isCompleted: false };
    expect(getSubtaskPrerequisite(current, [other, current])).toBeNull();
  });

  it("uses explicit sibling dependencies instead of earlier steps, including an empty selection", () => {
    const earlier = { id: "earlier", title: "Earlier", position: 0, isCompleted: false, dependencyIds: null };
    const later = { ...earlier, id: "later", position: 2 };
    const current = { ...earlier, id: "current", position: 1, dependencyIds: ["later"] };
    expect(getSubtaskPrerequisite(current, [earlier, later])).toBe(later);
    expect(getSubtaskPrerequisite(current, [earlier, { ...later, isCompleted: true }])).toBeNull();
    expect(getSubtaskPrerequisite({ ...current, dependencyIds: [] }, [earlier, later])).toBeNull();
  });
});
