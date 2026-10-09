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
  fireEvent.click(screen.getByText("Add section"));
  fireEvent.change(screen.getByLabelText(/^Section name/),{target:{value:"My custom budget"}});
  fireEvent.change(screen.getByLabelText("Budget amount My custom budget"),{target:{value:"300000"}});
  expect(screen.getByLabelText("Total Budget").textContent).toBe("300000");
  fireEvent.click(screen.getByText("Add breakdown"));
  expect(screen.getByLabelText("Budget amount Undistributed balance")).toBeTruthy();
  expect(screen.getByLabelText("Total Budget").textContent).toBe("300000");
  fireEvent.click(screen.getByText("Delete section and breakdown"));
  expect(screen.getByLabelText("Total Budget").textContent).toBe("0");
});
