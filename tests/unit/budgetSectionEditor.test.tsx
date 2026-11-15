// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { BudgetSectionEditor } from "../../src/app/features/budget/components/BudgetSectionEditor";
import { sectionTotal } from "../../src/app/features/budget/selectors/budgetSections";
import type { BudgetSection } from "../../src/app/features/budget/types";
afterEach(cleanup);
it("adds, renames, changes, breaks down and deletes custom sections with an immediate total", () => {
  function Harness() {
    const [sections,setSections]=useState<BudgetSection[]>([]);
    return <><output aria-label="Total Budget">{sectionTotal(sections)}</output><BudgetSectionEditor sections={sections} onChange={setSections} disabled={false}/></>;
  }
  render(<Harness/>);
  fireEvent.click(screen.getByText("Add account"));
  fireEvent.change(screen.getByLabelText(/^Account name/),{target:{value:"My custom budget"}});
  fireEvent.change(screen.getByLabelText("Budget amount My custom budget"),{target:{value:"300000"}});
  expect(screen.getByLabelText("Total Budget").textContent).toBe("300000");
  fireEvent.click(screen.getByText("Add breakdown"));
  expect(screen.getByLabelText("Budget amount Undistributed balance")).toBeTruthy();
  expect(screen.getByLabelText("Total Budget").textContent).toBe("300000");
  fireEvent.click(screen.getByText("Delete account and breakdown"));
  expect(screen.getByLabelText("Total Budget").textContent).toBe("0");
});

it("renders read-only locked accounts in compact table rows without edit controls", () => {
  const { container } = render(
    <BudgetSectionEditor
      disabled={true}
      sections={[{ id: "ops", name: "Operations", amount: 50000, heldAmount: 0, position: 0 }]}
      onChange={() => {}}
    />,
  );
  expect(container.querySelector(".eflow-budget-ledger--readonly")).toBeTruthy();
  expect((screen.getByDisplayValue("Operations") as HTMLInputElement).disabled).toBe(true);
  expect(screen.queryByText("Add account")).toBeNull();
  expect(screen.queryByText("Add breakdown")).toBeNull();
});
