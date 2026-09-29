import { describe, expect, it } from "vitest";
import { departmentApprovalRows } from "../../src/app/features/interdepartment-collaboration/selectors/departmentApprovalRows";

describe("department approval matrix", () => {
  const participant = { orgId: "office", participationRole: "participant", approvalPolicy: "one_of" } as any;
  it("does not count an old version or label a declined decision as approved", () => {
    const old = { organizationId: "office", revisionId: "old", decision: "approved", createdAt: 1 } as any;
    expect(departmentApprovalRows([participant], [old], "new")[0].status).toBe("Not requested");
    expect(departmentApprovalRows([participant], [{ ...old, revisionId: "new", decision: "declined" }], "new")[0].status).toBe("Declined");
  });
  it("distinguishes lead offices and observers from actual approvals", () => {
    expect(departmentApprovalRows([{ ...participant, participationRole: "owner" }, { ...participant, participationRole: "observer" }], [], "current").map((row) => row.status)).toEqual(["Lead department", "Approval not required"]);
  });
});
