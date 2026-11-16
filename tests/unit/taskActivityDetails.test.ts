import { describe, expect, it } from "vitest";
import { taskActivityDetails } from "../../src/app/features/tasks/selectors/taskActivityDetails";

describe("taskActivityDetails", () => {
  it("renders recorded deltas and reason from committed metadata", () => {
    expect(taskActivityDetails({ action: "work_details_edited", details: "legacy", metadata: {
      version: 1, fields: [{ key: "priority", label: "Priority", before: "medium", after: "high" }], reason: "Approved reschedule",
    } })).toEqual(["Priority: medium → high", "Reason: Approved reschedule"]);
  });

  it("keeps legacy content when metadata is missing or unsupported", () => {
    expect(taskActivityDetails({ action: "work_details_edited", details: "Title updated", metadata: null })).toEqual(["Title updated"]);
    expect(taskActivityDetails({ action: "work_details_edited", details: "Title updated", metadata: { version: 2 } })).toEqual(["Title updated"]);
  });

  it("does not invent a before value or render an empty delta", () => {
    expect(taskActivityDetails({ action: "work_details_edited", details: "Recorded activity", metadata: {
      version: 1, fields: [{ key: "priority", label: "Priority", before: "medium", after: "high" }, { key: "x", label: 1, before: "", after: "" }],
    } })).toEqual(["Priority: medium → high"]);
  });
});
