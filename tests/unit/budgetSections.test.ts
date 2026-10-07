import { describe, expect, it } from "vitest";
import { addSectionChild, openingSections, removeSectionTree, sectionTotal, validateBudgetSections } from "../../src/app/features/budget/selectors/budgetSections";
import type { BudgetSection, DepartmentBudgetBundle } from "../../src/app/features/budget/types";
const section = (id: string, amount = 0, parentId?: string): BudgetSection => ({ id, parentId, name: id, amount, heldAmount: 0, position: 0 });
describe("dynamic annual sections", () => {
  it("counts only leaf amounts and uses cents", () => {
    const rows = [section("MOOE"),section("Office",.1,"MOOE"),section("Travel",.2,"MOOE")];
    expect(sectionTotal(rows)).toBe(.3);
    expect(sectionTotal(rows,"MOOE")).toBe(.3);
    expect(sectionTotal(rows,"Office")).toBe(.1);
  });
  it("retains authority and hold when adding the first breakdown", () => {
    const rows = addSectionChild([{ ...section("supplies",300000), heldAmount: 10000 }],"supplies");
    expect(rows[0].amount).toBe(0);
    expect(rows[1].name).toBe("Undistributed balance");
    expect(sectionTotal(rows)).toBe(300000);
    expect(sectionTotal(rows,undefined,"heldAmount")).toBe(10000);
    expect(validateBudgetSections(rows)).toBe("");
  });
  it("deletes a subtree and reaches zero after the last row", () => {
    const rows=[section("a"),section("b",2,"a"),section("c",1)];
    expect(sectionTotal(removeSectionTree(rows,"a"))).toBe(1);
    expect(sectionTotal(removeSectionTree(removeSectionTree(rows,"a"),"c"))).toBe(0);
  });
  it("rejects cycles, missing parents, duplicate IDs, excess holds and double counting", () => {
    for(const rows of [[section("a",0,"a")],[section("a",0,"missing")],[section("a"),section("a")],[{...section("a",10),heldAmount:11}],[section("a",1),section("b",2,"a")]]) expect(validateBudgetSections(rows)).not.toBe("");
  });
  it("leaves retired records out of totals", () => expect(sectionTotal([{...section("old",10),retired:true},section("new",5)])).toBe(5));
  it("can save again after an old parent and its breakdown have been retired", () => {
    const rows = [{ ...section("old-parent"), retired: true }, { ...section("old-child", 10, "old-parent"), retired: true }, section("active", 20)];
    expect(validateBudgetSections(rows)).toBe("");
    expect(sectionTotal(rows)).toBe(20);
  });
  it("does not replace a loaded empty draft with the opening amount", () => {
    expect(openingSections({sectionsAvailable:true,sections:[],summary:{approvedAmount:10}} as unknown as DepartmentBudgetBundle)).toEqual([]);
  });
});
