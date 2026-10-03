// @vitest-environment jsdom

import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewKindSwitch, type ReviewKind } from "../../src/app/features/reviews/components/ReviewKindSwitch";
import { canOpenBudgetReviewWorkspace } from "../../src/app/features/reviews/selectors";

function Harness() {
  const [active, setActive] = useState<ReviewKind>("tasks");
  return (
    <div>
      <ReviewKindSwitch active={active} includeBudget onChange={setActive} />
      <output>{active}</output>
    </div>
  );
}

describe("financial review navigation", () => {
  it("keeps financial approvals inside the Head review workspace", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("tab", { name: "Budget", exact: true }));
    expect(screen.getByText("budget", { selector: "output" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Budget", exact: true }).getAttribute("aria-selected")).toBe("true");
  });

  it("exposes financial approvals to a Task Leader without granting office-wide scope", () => {
    expect(canOpenBudgetReviewWorkspace("leading", "member")).toBe(true);
    expect(canOpenBudgetReviewWorkspace("department", "member")).toBe(false);
    expect(canOpenBudgetReviewWorkspace("department", "head")).toBe(true);
  });
});
