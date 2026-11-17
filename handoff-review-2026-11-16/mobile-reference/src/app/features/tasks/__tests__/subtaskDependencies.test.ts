import { expect, test } from "@jest/globals";
import type {
  WorkNode,
  WorkTreeSnapshot,
} from "../../../../core/web/app/features/nested-work/types";
import { subtaskDependencies } from "../subtaskDependencies";
import { plannedStartReached } from "../subtaskSchedule";

const first = {
  id: "a",
  task_id: "root",
  parent_subtask_id: null,
  sibling_order: 0,
  status: "todo",
} as WorkNode;
const second = { ...first, id: "b", sibling_order: 1 };
const current = { ...first, id: "c", sibling_order: 2 };
const tree = {
  root: { id: "root", kind: "office" },
  nodes: [first, second, current],
} as WorkTreeSnapshot;

test("explicit dependencies replace sibling order and report restricted counts without record details", () => {
  expect(
    subtaskDependencies(tree, {
      ...current,
      dependency_ids: ["a"],
      pending_dependency_count: 2,
      restricted_dependency_count: 1,
    }),
  ).toEqual({ items: [first], pendingCount: 2, missingCount: 1, known: true });
  expect(
    subtaskDependencies(tree, { ...current, dependency_ids: [] }),
  ).toEqual({ items: [], pendingCount: 0, missingCount: 0, known: true });
  expect(
    subtaskDependencies(tree, { ...current, dependency_ids: null }).items,
  ).toEqual([first, second]);

  const unknownDeps = subtaskDependencies(tree, current);
  expect(unknownDeps.known).toBe(false);
  expect(unknownDeps.pendingCount).toBeGreaterThan(0);

  const cancelledSibling = { ...first, id: "cancelled-1", status: "cancelled" } as unknown as WorkNode;
  const cancelledTree = { ...tree, nodes: [first, cancelledSibling, current] } as WorkTreeSnapshot;
  expect(
    subtaskDependencies(cancelledTree, { ...current, dependency_ids: ["cancelled-1"] }),
  ).toEqual({ items: [cancelledSibling], missingCount: 0, pendingCount: 1, known: true });
  expect(
    subtaskDependencies(cancelledTree, { ...current, dependency_ids: null }),
  ).toEqual({ items: [first, cancelledSibling], missingCount: 0, pendingCount: 2, known: true });
});

test("a cancelled legacy prerequisite blocks start even when every other sibling is completed", () => {
  const cancelled = { ...first, status: "cancelled" } as unknown as WorkNode;
  const node = { ...current, dependency_ids: null };
  const snapshot = { ...tree, nodes: [cancelled, { ...second, status: "completed" as const }, node] };
  expect(subtaskDependencies(snapshot, node).pendingCount).toBe(1);
  expect(subtaskDependencies({ ...snapshot, root: { ...snapshot.root, kind: "personal" } }, node).pendingCount).toBe(1);
});

test("explicit independence has the same dependency readiness for Start and Complete", () => {
  const node = { ...current, dependency_ids: [] };
  expect(subtaskDependencies(tree, node).pendingCount).toBe(0);
  expect(subtaskDependencies(tree, node)).toEqual({ items: [], missingCount: 0, pendingCount: 0, known: true });
  expect(subtaskDependencies(tree, { ...node, is_standalone: true }).pendingCount).toBe(0);
});

test("missing Office dependency fields stay unknown; the planning support flag alone does not block execution", () => {
  expect(subtaskDependencies({ ...tree, supportsSubtaskDependencies: true }, current).known).toBe(false);
  expect(subtaskDependencies(tree, { ...current, is_standalone: true }).known).toBe(false);
  expect(subtaskDependencies({ ...tree, nodes: [current] }, { ...current, dependency_ids: null }).known).toBe(true);
  expect(subtaskDependencies(tree, { ...current, dependency_ids: [] }).pendingCount).toBe(0);
});

test("scheduled starts accept overdue work and reject future and missing dates", () => {
  expect(plannedStartReached("2026-11-13", "2026-11-14")).toBe(true);
  expect(plannedStartReached("2026-11-14", "2026-11-14")).toBe(true);
  expect(plannedStartReached("2026-11-15", "2026-11-14")).toBe(false);
  expect(plannedStartReached("2026-11-14")).toBe(false);
  expect(plannedStartReached(null, "2026-11-14")).toBe(false);
});
