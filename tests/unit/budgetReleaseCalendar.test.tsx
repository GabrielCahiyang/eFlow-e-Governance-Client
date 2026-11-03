// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {useState} from 'react';
import {cleanup,render,screen,fireEvent,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {BudgetSection,DepartmentBudgetBundle} from '../../src/app/features/budget/types';
import {budgetReleaseScheduleError,lockedReleaseEditError,pendingReleaseAmount,releaseSchedulesYearError} from '../../src/app/features/budget/selectors/budgetReleaseSchedule';
import {budgetVersionChanges} from '../../src/app/features/budget/selectors/budgetVersions';
const mocks=vi.hoisted(()=>({role:'accounting_staff',confirm:vi.fn(),toast:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({userProfile:{id:'accountant',org_id:'office',role:mocks.role}})}));
vi.mock('../../src/app/components/ui/Modal',()=>({Modal:({title,children,footer}:any)=><div role="dialog" aria-label={title}>{children}{footer}</div>}));
vi.mock('../../src/app/components/ui/Toast',()=>({useToast:()=>({toast:mocks.toast})}));
vi.mock('../../src/app/features/budget/services/budgetSectionService',()=>({confirmOfficeBudgetRelease:mocks.confirm}));
import {BudgetReleaseCalendar} from '../../src/app/features/budget/components/BudgetReleaseCalendar';
import {BudgetReleaseScheduleEditor} from '../../src/app/features/budget/components/BudgetReleaseScheduleEditor';
const account:BudgetSection={id:'account',name:'Supplies',amount:30000,heldAmount:15000,position:0,releaseSchedule:[{id:'one',date:'2026-11-01',amount:10000,status:'pending'},{id:'two',date:'2026-11-02',amount:5000,status:'pending'}]};
const data=()=>({summary:{id:'budget',orgId:'office',fiscalYear:2026,status:'locked'},sections:[account],sectionsVersion:4,releaseScheduleAvailable:true,canConfirmBudgetReleases:true} as DepartmentBudgetBundle);
beforeEach(()=>{vi.clearAllMocks();vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-01T08:00:00Z'));mocks.role='accounting_staff';mocks.confirm.mockResolvedValue(undefined);});
afterEach(()=>{cleanup();vi.useRealTimers();});
it('supports optional multiple dated releases and derives the held balance',()=>{
 function Harness(){const [row,setRow]=useState<BudgetSection>({...account,releaseSchedule:[],heldAmount:0});return <><output aria-label="Held">{row.heldAmount}</output><BudgetReleaseScheduleEditor account={row} year={2026} disabled={false} onChange={update=>setRow(old=>({...old,...update}))}/></>;}
 render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Schedule a release'}));
 fireEvent.change(screen.getByLabelText('Release 1 date for Supplies'),{target:{value:'2026-11-01'}});fireEvent.change(screen.getByLabelText('Release 1 amount for Supplies'),{target:{value:'10000'}});
 fireEvent.click(screen.getByRole('button',{name:'Add another release'}));fireEvent.change(screen.getByLabelText('Release 2 amount for Supplies'),{target:{value:'5000'}});
 expect(screen.getByLabelText('Held')).toHaveTextContent('15000');expect(screen.getByLabelText('Release 2 date for Supplies')).toHaveAttribute('max','2026-12-31');
});
it('preserves an existing undated hold and asks for its date',()=>{
 render(<BudgetReleaseScheduleEditor account={{...account,releaseSchedule:undefined}} year={2026} disabled={false} onChange={vi.fn()}/>);
 expect(screen.getByLabelText('Release 1 amount for Supplies')).toHaveValue('15,000');expect(screen.getByLabelText('Release 1 date for Supplies')).toHaveValue('');
});
it('requires positive amounts, valid dates, unique releases, and an account ceiling',()=>{
 expect(budgetReleaseScheduleError(account)).toBe('');
 expect(budgetReleaseScheduleError({...account,releaseSchedule:[account.releaseSchedule![0],account.releaseSchedule![0]]})).toContain('unique');
 expect(budgetReleaseScheduleError({...account,releaseSchedule:[{...account.releaseSchedule![0],date:''}]})).toContain('valid release date');
 expect(budgetReleaseScheduleError({...account,releaseSchedule:[{...account.releaseSchedule![0],amount:31000}]})).toContain('exceed');
 expect(budgetReleaseScheduleError({...account,releaseSchedule:[{...account.releaseSchedule![0],amount:0}]})).toContain('positive');
 expect(releaseSchedulesYearError([account],2027)).toContain('2027');expect(pendingReleaseAmount([{...account.releaseSchedule![0],status:'confirmed'},account.releaseSchedule![1]])).toBe(5000);
});
it('keeps confirmed rows visible but immutable',()=>{
 render(<BudgetReleaseScheduleEditor account={{...account,heldAmount:0,releaseSchedule:[{...account.releaseSchedule![0],status:'confirmed'}]}} disabled={false} year={2026} onChange={vi.fn()}/>);
 expect(screen.getByLabelText('Release 1 date for Supplies')).toBeDisabled();expect(screen.getByLabelText('Release 1 amount for Supplies')).toBeDisabled();expect(screen.queryByRole('button',{name:/Remove release/})).toBeNull();
});
it('blocks reducing pending releases after lock while allowing rescheduling',()=>{
 expect(lockedReleaseEditError([account],[{...account,heldAmount:10000}])).toContain('Accounting must confirm');
 expect(lockedReleaseEditError([account],[])).toContain('release records');
 expect(lockedReleaseEditError([account],[{...account,releaseSchedule:account.releaseSchedule!.map(r=>({...r,date:'2026-12-01'}))}])).toBe('');
});
it('requires Yes and a reference, prevents early confirmation and supports Cancel',async()=>{
 render(<BudgetReleaseCalendar data={data()} onChanged={vi.fn()}/>);
 const buttons=screen.getAllByRole('button',{name:'Confirm availability'});expect(buttons[0]).toBeEnabled();expect(buttons[1]).toBeDisabled();
 fireEvent.click(buttons[0]);expect(mocks.confirm).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Yes, confirm availability'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(screen.queryByRole('dialog')).toBeNull();expect(mocks.confirm).not.toHaveBeenCalled();
 fireEvent.click(buttons[0]);fireEvent.change(screen.getByRole('textbox',{name:'Release reference or note'}),{target:{value:'Funding notice 123'}});fireEvent.click(screen.getByRole('button',{name:'Yes, confirm availability'}));
 await waitFor(()=>expect(mocks.confirm).toHaveBeenCalledWith('account','one',4,'Funding notice 123'));expect(mocks.toast).toHaveBeenCalledWith(expect.stringContaining('now available'),'success');
});
it.each(['head','member'])('never exposes Accounting confirmation to %s',role=>{
 mocks.role=role;render(<BudgetReleaseCalendar data={data()} onChanged={vi.fn()}/>);expect(screen.queryByRole('button',{name:'Confirm availability'})).toBeNull();
});
it('keeps errors red and preserves the release note for retry',async()=>{
 mocks.confirm.mockRejectedValue(new Error('The budget changed. Check the latest schedule.'));render(<BudgetReleaseCalendar data={data()} onChanged={vi.fn()}/>);
 fireEvent.click(screen.getAllByRole('button',{name:'Confirm availability'})[0]);fireEvent.change(screen.getByRole('textbox'),{target:{value:'Notice 123'}});fireEvent.click(screen.getByRole('button',{name:'Yes, confirm availability'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('budget changed');expect(screen.getByRole('textbox')).toHaveValue('Notice 123');
});
it('selects dates without changing the saved schedule',()=>{
 render(<BudgetReleaseCalendar data={data()} onChanged={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'Show releases for 2026-11-02'}));
 expect(within(screen.getByLabelText('Office budget release calendar')).getAllByText('Supplies')).toHaveLength(1);expect(mocks.confirm).not.toHaveBeenCalled();
});
it('includes Q4 target and calendar edits in the version history',()=>{
 const before={version:1,total:30000,actorName:'Head',createdAt:'2026-11-01',reason:'Initial',accounts:[account],q4Target:75};
 const changes=budgetVersionChanges(before,{...before,version:2,q4Target:90,accounts:[{...account,releaseSchedule:[{...account.releaseSchedule![0],date:'2026-12-01'},account.releaseSchedule![1]]}]});
 expect(changes).toContainEqual(expect.objectContaining({field:'Q4 utilization target',before:'75%',after:'90%'}));expect(changes).toContainEqual(expect.objectContaining({field:'Release schedule'}));
});
