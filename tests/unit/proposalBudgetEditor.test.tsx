// @vitest-environment jsdom

import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProposalBudgetEditor } from "../../src/app/features/budget";
import type { ProposalBudgetDraft } from "../../src/app/features/budget";

const initial: ProposalBudgetDraft = {
  fiscalYear: 2026,
  totalAmount: 0,
  lines: [{
    id: "line-1",
    expenseClass: "Other Expenses",
    category: "Operating Expenses",
    particular: "",
    fundSource: "Office appropriation",
    amount: 0,
    position: 0,
  }],
};

function Harness() {
  const [value, setValue] = useState(initial);
  return <ProposalBudgetEditor value={value} onChange={setValue} />;
}

describe("proposal budget editor", () => {
  it("groups multiple particulars under one category and fixes the fund source", () => {
    render(<Harness />);

    expect(screen.getByRole("combobox", { name: "Expense class" })).toBeTruthy();
    const fundSource = screen.getByRole("combobox", { name: "Fund source" }) as HTMLSelectElement;
    expect(fundSource.value).toBe("Office Budget");
    expect(fundSource.querySelectorAll("option")).toHaveLength(1);
    expect((screen.getByRole("textbox", { name: "Category 1" }) as HTMLInputElement).value).toBe("Operating Expenses");

    fireEvent.change(screen.getByRole("spinbutton", { name: "Amount for particular 1" }), { target: { value: "1500" } });
    expect(screen.getAllByText("₱1,500.00").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Add particular" }));
    expect(screen.getByRole("textbox", { name: "Particular 2 for Operating Expenses" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add category" }));
    expect((screen.getByRole("textbox", { name: "Category 2" }) as HTMLInputElement).value).toBe("New category 2");
  });
});
