// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { saveBudgetSections } from "../../src/app/features/budget/services/budgetSectionService";
import { lockDepartmentFiscalBudget } from "../../src/app/features/budget/services/budgetService";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnnualBudgetSetup } from "../../src/app/features/budget/components/AnnualBudgetSetup";
import type { DepartmentBudgetBundle } from "../../src/app/features/budget/types";

vi.mock("../../src/app/features/budget/components/LockedBudgetControls", () => ({ LockedBudgetControls: () => null }));
vi.mock("../../src/app/features/budget/services/budgetService", () => ({ lockDepartmentFiscalBudget: vi.fn() }));
vi.mock("../../src/app/features/budget/services/budgetSectionService", () => ({ saveBudgetSections: vi.fn() }));
vi.mock("../../src/app/components/ui/useConfirmation", () => ({ useConfirmation: () => ({ dialog: null, confirm: vi.fn().mockResolvedValue(true) }) }));
vi.mock("../../src/app/shared/useExplicitDraft", () => ({ useExplicitDraft: () => ({ pendingRef: { current: false }, markClean: vi.fn() }) }));

const empty: DepartmentBudgetBundle = { summary: null, sections: [], sectionsAvailable: false, lines: [], commitments: [], allocations: [], allocationLines: [], requests: [], requestAttachments: [], releases: [], liquidations: [], ledger: [], adjustments: [] };
const saved = { ...empty, summary: {
  id: "budget", orgId: "office", fiscalYear: 2026, status: "locked", approvedAmount: 123456.78,
  dailyPettyCashReleaseLimit: 30000, perReceiptLimit: 5000, liquidationDueDays: 15,
  allowReceiptLimitOverride: false, underutilizationThreshold: 75,
} } as DepartmentBudgetBundle;
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('lets the Head edit a locked Q4 target through audited readjustment and restores it on Cancel',async()=>{
 render(<AnnualBudgetSetup orgId="office" fiscalYear={2026} data={{...saved,sectionsAvailable:true,sections:[{id:'supplies',name:'Supplies',amount:30000,heldAmount:0,position:0}]}} canEdit onChanged={vi.fn()}/>);
 const target=screen.getByLabelText('Q4 utilization target (%)') as HTMLInputElement;expect(target.disabled).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Readjust budget'}));expect(target.disabled).toBe(false);fireEvent.change(target,{target:{value:'90'}});fireEvent.click(screen.getByRole('button',{name:'Cancel adjustment'}));expect(target.value).toBe('75');
 fireEvent.click(screen.getByRole('button',{name:'Readjust budget'}));fireEvent.change(target,{target:{value:'90'}});fireEvent.change(screen.getByPlaceholderText('Explain what changed and why.'),{target:{value:'Updated Q4 goal'}});fireEvent.click(screen.getByRole('button',{name:'Save V2'}));
 await waitFor(()=>expect(saveBudgetSections).toHaveBeenCalledWith(expect.objectContaining({reason:'Updated Q4 goal',settings:expect.objectContaining({threshold:90})})));
});

describe("annual section availability", () => {
  it("disables readjustment when a project appears and keeps Cancel available for an open draft", () => {
    const data = {...saved, sectionsAvailable: true, sections: [{id: "supplies", name: "Supplies", amount: 123456.78, heldAmount: 0, position: 0}]};
    const onChanged = vi.fn();
    const view = render(<AnnualBudgetSetup orgId="office" fiscalYear={2026} data={data} canEdit onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", {name: "Readjust budget"}));
    fireEvent.change(screen.getByPlaceholderText("Explain what changed and why."), {target: {value: "Adjust supplies"}});
    view.rerender(<AnnualBudgetSetup orgId="office" fiscalYear={2026} data={{...data, readjustmentBlockedByProjects: true}} canEdit onChanged={onChanged} />);
    const save = screen.getByRole<HTMLButtonElement>("button", {name: "Save V2"});
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect(saveBudgetSections).not.toHaveBeenCalled();
    expect(screen.getByText(/Office has no projects/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", {name: "Cancel adjustment"}));
    expect(screen.getByRole<HTMLButtonElement>("button", {name: "Readjust budget"}).disabled).toBe(true);
    view.rerender(<AnnualBudgetSetup orgId="office" fiscalYear={2026} data={data} canEdit onChanged={onChanged} />);
    expect(screen.getByRole<HTMLButtonElement>("button", {name: "Readjust budget"}).disabled).toBe(false);
  });
  it('shows a server rejection in red and keeps the failed adjustment draft',async()=>{
    vi.mocked(saveBudgetSections).mockRejectedValueOnce(Object.assign(new Error('Budget changed while you edited'),{protection:{kind:'budget_account_protected',account:'Supplies',entered:19000,minimum:20000,sources:[{id:'p',name:'Project 1',amount:20000}]}}));const changed=vi.fn();
    render(<AnnualBudgetSetup orgId="office" fiscalYear={2026} data={{...saved,sectionsAvailable:true,sections:[{id:'supplies',name:'Supplies',amount:30000,heldAmount:0,position:0}]}} canEdit onChanged={changed}/>);
    fireEvent.click(screen.getByRole('button',{name:'Readjust budget'}));fireEvent.change(screen.getByLabelText('Budget amount Supplies'),{target:{value:'19000'}});fireEvent.change(screen.getByPlaceholderText('Explain what changed and why.'),{target:{value:'Correction requested'}});
    fireEvent.click(screen.getByRole('button',{name:'Save V2'}));await screen.findByRole('alert');
    expect(screen.getByRole('alert').className).toContain('bg-rose-50');expect(screen.getByRole('alert').textContent).toContain('Project 1');expect((screen.getByLabelText('Budget amount Supplies') as HTMLInputElement).value).toBe('19,000');expect(changed).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Save V2'})).toBeTruthy();
  });
  it('keeps the original edit revision if a newer budget arrives while the Head is editing',async()=>{
    vi.mocked(saveBudgetSections).mockResolvedValue('budget');const data={...saved,sectionsAvailable:true,sectionsVersion:3,sections:[{id:'supplies',name:'Supplies',amount:30000,heldAmount:0,position:0}]};
    const view=render(<AnnualBudgetSetup orgId="office" fiscalYear={2026} data={data} canEdit onChanged={vi.fn().mockResolvedValue(undefined)}/>);
    fireEvent.click(screen.getByRole('button',{name:'Readjust budget'}));fireEvent.change(screen.getByLabelText('Budget amount Supplies'),{target:{value:'50000'}});fireEvent.change(screen.getByPlaceholderText('Explain what changed and why.'),{target:{value:'Additional authority'}});
    view.rerender(<AnnualBudgetSetup orgId="office" fiscalYear={2026} data={{...data,sectionsVersion:4}} canEdit onChanged={vi.fn().mockResolvedValue(undefined)}/>);
    fireEvent.click(screen.getByRole('button',{name:'Save V2'}));await waitFor(()=>expect(saveBudgetSections).toHaveBeenCalledOnce());expect(vi.mocked(saveBudgetSections).mock.calls[0][0].expectedVersion).toBe(3);
  });
  it('adds a new account after lock and saves the complete adjustment with its version and reason',async()=>{
    vi.mocked(saveBudgetSections).mockResolvedValue('budget');const changed=vi.fn().mockResolvedValue(undefined);
    render(<AnnualBudgetSetup orgId="office" fiscalYear={2026} data={{...saved,sectionsAvailable:true,canAdjustBudget:true,sectionsVersion:3,sections:[{id:'supplies',name:'Supplies',amount:123456.78,heldAmount:0,position:0}]}} canEdit onChanged={changed}/>);
    fireEvent.click(screen.getByRole('button',{name:'Readjust budget'}));fireEvent.click(screen.getByRole('button',{name:'Add account'}));
    fireEvent.change(screen.getAllByLabelText(/^Account name/)[1],{target:{value:'Travel'}});fireEvent.change(screen.getByLabelText('Budget amount Travel'),{target:{value:'5000'}});
    fireEvent.change(screen.getByPlaceholderText('Explain what changed and why.'),{target:{value:'Approved travel funding'}});
    fireEvent.click(screen.getByRole('button',{name:'Save V2'}));await waitFor(()=>expect(saveBudgetSections).toHaveBeenCalledOnce());
    expect(vi.mocked(saveBudgetSections).mock.calls[0][0]).toMatchObject({expectedVersion:3,reason:'Approved travel funding',sections:expect.arrayContaining([expect.objectContaining({name:'Travel',amount:5000})])});await waitFor(()=>expect(changed).toHaveBeenCalledOnce());
  });
  it('shows named project reservations and blocks an account below its protected minimum',()=>{
    render(<AnnualBudgetSetup orgId="office" fiscalYear={2026} data={{...saved,sectionsAvailable:true,sections:[{id:'supplies',name:'Supplies',amount:30000,heldAmount:0,position:0,protectedAmount:20000,reservations:[{id:'project-1',name:'Project 1',amount:20000}]}]}} canEdit onChanged={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'Readjust budget'}));fireEvent.change(screen.getByLabelText('Budget amount Supplies'),{target:{value:'19000'}});
    expect(screen.getByRole('alert').textContent).toContain('₱20,000.00');expect(screen.getByRole('alert').textContent).toContain('Project 1');expect((screen.getByRole('button',{name:'Save V2'}) as HTMLButtonElement).disabled).toBe(true);expect(saveBudgetSections).not.toHaveBeenCalled();
  });
  it('withholds locked adjustment when server says the actor is not the appointed office Head',()=>{
    render(<AnnualBudgetSetup orgId="office" fiscalYear={2026} data={{...saved,sectionsAvailable:true,canAdjustBudget:false}} canEdit onChanged={vi.fn()}/>);
    expect(screen.queryByRole('button',{name:'Readjust budget'})).toBeNull();expect(screen.getByText('Only the office Head can readjust this budget.')).toBeTruthy();
  });
  it("blocks locking an unfinished amount while allowing the draft to save, then enables locking after correction", async () => {
    vi.mocked(saveBudgetSections).mockResolvedValue('budget');
    render(<AnnualBudgetSetup orgId="office" fiscalYear={2028} data={{...empty, sectionsAvailable:true, sections:[
      {id:'supplies',name:'Supplies',amount:1000,heldAmount:0,position:0},
      {id:'travel',name:'Travel',amount:0,heldAmount:0,position:1},
    ]}} canEdit onChanged={vi.fn().mockResolvedValue(undefined)}/>);
    const lock = screen.getByRole('button',{name:'Save & lock annual budget'});
    expect((lock as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain('Travel');
    fireEvent.click(lock);
    expect(lockDepartmentFiscalBudget).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Save draft',exact:true}));
    await waitFor(()=>expect(saveBudgetSections).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText('Budget amount Travel',{exact:true}),{target:{value:'0.01'}});
    await waitFor(()=>expect((lock as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it("shows the actual saved amount, never an empty editor, when section support is missing", () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const view = render(<AnnualBudgetSetup orgId="office" fiscalYear={2026} data={empty} canEdit onChanged={refresh} />);
    view.rerender(<AnnualBudgetSetup orgId="office" fiscalYear={2026} data={saved} canEdit onChanged={refresh} />);
    expect(screen.getAllByText("₱123,456.78")).toHaveLength(2);
    expect(screen.queryByText(/No accounts yet/)).toBeNull();
    expect(screen.queryByText("₱0.00")).toBeNull();
    expect(screen.queryByRole("button", { name: 'Readjust budget' })).toBeNull();
    expect(screen.queryByRole("button", { name: /Save draft/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Refresh budget" }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("loads preserved opening sections when support becomes available", () => {
    const view = render(<AnnualBudgetSetup orgId="office" fiscalYear={2026} data={saved} canEdit onChanged={vi.fn()} />);
    view.rerender(<AnnualBudgetSetup orgId="office" fiscalYear={2026} data={{ ...saved, sectionsAvailable: true, sections: [{ id: "opening", name: "Existing budget", amount: 123456.78, heldAmount: 0, position: 0 }] }} canEdit onChanged={vi.fn()} />);
    expect(screen.queryByText(/temporarily unavailable/)).toBeNull();
    expect(screen.getByDisplayValue("Existing budget")).toBeTruthy();
    expect(screen.getByText("₱123,456.78")).toBeTruthy();
    expect(screen.queryByText(/No accounts yet/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: 'Readjust budget' }));
    expect(screen.getByRole("button", { name: "Add account" })).toBeTruthy();
  });

  it("shows an empty editable draft only for a genuinely empty supported budget", () => {
    render(<AnnualBudgetSetup orgId="office" fiscalYear={2027} data={{ ...empty, sectionsAvailable: true }} canEdit onChanged={vi.fn()} />);
    expect(screen.getByText("₱0.00")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add account" })).toBeTruthy();
    expect(screen.getByText(/Add your first account/)).toBeTruthy();
  });
});
