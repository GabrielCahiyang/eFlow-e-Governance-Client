// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountingOverview } from '../../src/app/features/budget/components/AccountingOverview';
import { OfficeBudgetWorkspace } from '../../src/app/features/budget/components/OfficeBudgetWorkspace';
import type { useDepartmentBudget } from '../../src/app/features/budget/hooks/useDepartmentBudget';
import type { useGeneralJournal } from '../../src/app/features/budget/hooks/useGeneralJournal';

const state = vi.hoisted(() => ({ budget: vi.fn(), journal: vi.fn(), profile: {id:'actor-a',role:'head',org_id:'office-a'} }));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({userProfile:state.profile,can:()=>true})}));
vi.mock('../../src/app/hooks/useFirebaseData',()=>({useTasks:()=>({tasks:[]})}));
vi.mock('../../src/app/features/budget/hooks/useDepartmentBudget',()=>({useDepartmentBudget:state.budget}));
vi.mock('../../src/app/features/budget/hooks/useGeneralJournal',()=>({useGeneralJournal:state.journal}));
vi.mock('../../src/app/features/navigation',async()=>({...await import('../../src/app/features/navigation/queryContext'),writeNavigationLocation:vi.fn()}));

function owner() {
  const budget = {summary:null,lines:[],commitments:[],allocations:[],allocationLines:[],requests:[],requestAttachments:[],releases:[],liquidations:[],ledger:[],adjustments:[],loading:false,refreshing:false,error:'',refresh:vi.fn().mockResolvedValue(undefined)} as ReturnType<typeof useDepartmentBudget>;
  const journal = {entries:[],accounts:[],loading:false,refreshing:false,error:'',refresh:vi.fn().mockResolvedValue(undefined)} as ReturnType<typeof useGeneralJournal>;
  return {budget,journal};
}
afterEach(()=>{cleanup();vi.clearAllMocks();window.history.replaceState({},'', '/');});
describe('P5b financial presentation ownership',()=>{
  it('Overview hands off without mounting a settlement decision controller',()=>{
    const {budget}=owner();const next=vi.fn();render(<AccountingOverview budget={budget} journalCount={0} onSettlements={next}/>);
    expect(screen.getByText(/0 pending receipt packages/)).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Settle & post'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'View settlements'}));expect(next).toHaveBeenCalledOnce();
    expect(screen.getAllByText('Not configured')).toHaveLength(2);
  });
  it('failed reads never advertise zero financial totals or an empty settlement list',()=>{
    const {budget}=owner();budget.error='Read unavailable';render(<AccountingOverview budget={budget}/>);
    expect(screen.getByText('The settlement count is unavailable.',{exact:false})).toBeTruthy();
    expect(screen.getAllByText('Unavailable')).toHaveLength(5);
    expect(screen.queryByText(/0 pending receipt/)).toBeNull();
  });
  it('embedded Budget consumes its supplied owners and has no second page heading',()=>{
    const dataOwner=owner();render(<OfficeBudgetWorkspace fiscalYear={2027} embedded dataOwner={dataOwner}/>);
    expect(state.budget).not.toHaveBeenCalled();expect(state.journal).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading',{level:1})).toBeNull();
    expect(screen.getByRole('combobox',{name:'Budget view'})).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Create annual budget'})).toBeTruthy();
  });
  it('standalone Head Budget retains one scoped owner for each data source',()=>{
    const dataOwner=owner();state.budget.mockReturnValue(dataOwner.budget);state.journal.mockReturnValue(dataOwner.journal);
    render(<OfficeBudgetWorkspace fiscalYear={2028}/>);
    expect(state.budget).toHaveBeenCalledExactlyOnceWith('office-a',2028);
    expect(state.journal).toHaveBeenCalledExactlyOnceWith('office-a',2028,'actor-a');
    expect(screen.getByRole('heading',{name:'Office Budget',level:1})).toBeTruthy();
  });
});
