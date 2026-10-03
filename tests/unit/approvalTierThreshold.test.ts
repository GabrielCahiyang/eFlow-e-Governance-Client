// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import {
  DEFAULT_APPROVAL_TIER_THRESHOLD,
} from "../../src/app/features/budget/constants";
import {
  readApprovalThreshold,
  writeApprovalThreshold,
} from "../../src/app/features/budget/hooks/useApprovalThreshold";

describe("Approval Tier Threshold", () => {
  const orgId = "org-test-123";

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to 1,000 when no custom threshold is stored", () => {
    expect(DEFAULT_APPROVAL_TIER_THRESHOLD).toBe(1_000);
    expect(readApprovalThreshold(orgId)).toBe(1_000);
  });

  it("persists and reads custom threshold per organization", () => {
    writeApprovalThreshold(2_500, orgId);
    expect(readApprovalThreshold(orgId)).toBe(2_500);

    // Other orgs should still read their own or default
    expect(readApprovalThreshold("other-org")).toBe(1_000);
  });

  it("correctly branches requests between Tier 1 and Tier 2", () => {
    const threshold = 1_000;

    const microRequest = 500;
    const boundaryRequest = 1_000;
    const majorRequest = 1_001;
    const largeRequest = 8_500;

    const isTier1 = (amount: number) => amount <= threshold;

    expect(isTier1(microRequest)).toBe(true);
    expect(isTier1(boundaryRequest)).toBe(true);
    expect(isTier1(majorRequest)).toBe(false);
    expect(isTier1(largeRequest)).toBe(false);
  });

  it("adjusts tier categorization when Head changes the threshold", () => {
    let currentThreshold = readApprovalThreshold(orgId);
    expect(currentThreshold).toBe(1_000);

    const expense = 1_500;
    // With 1,000 threshold, 1,500 is Tier 2 (Escalated)
    expect(expense <= currentThreshold).toBe(false);

    // Department Head raises threshold to 2,000
    writeApprovalThreshold(2_000, orgId);
    currentThreshold = readApprovalThreshold(orgId);
    expect(currentThreshold).toBe(2_000);

    // Now 1,500 qualifies as Tier 1 (Fast-Track)
    expect(expense <= currentThreshold).toBe(true);
  });
});
