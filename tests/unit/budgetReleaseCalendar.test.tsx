// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {useState} from 'react';
import {cleanup,render,screen,fireEvent,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {BudgetSection,DepartmentBudgetBundle} from '../../src/app/features/budget/types';
import {budgetReleaseScheduleError,lockedReleaseEditError,pendingReleaseAmount,releaseSchedulesYearError} from '../../src/app/features/budget/selectors/budgetReleaseSchedule';
import {budgetVersionChanges} from '../../src/app/features/budget/selectors/budgetVersions';
import {BudgetReleaseCalendar} from '../../src/app/features/budget/components/BudgetReleaseCalendar';
import {BudgetReleaseScheduleEditor} from '../../src/app/features/budget/components/BudgetReleaseScheduleEditor';
const account:BudgetSection={id:'account',name:'Supplies',amount:30000,heldAmount:15000,position:0,releaseSchedule:[{id:'one',date:'2026-11-01',amount:10000,status:'pending'},{id:'two',date:'2026-11-02',amount:5000,status:'pending'}]};
const data=(sections=[account])=>({summary:{id:'budget',orgId:'office',fiscalYear:2026,status:'locked'},sections,sectionsVersion:4,releaseScheduleAvailable:true} as DepartmentBudgetBundle);
beforeEach(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-31T16:00:00Z'));});
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
 expect(lockedReleaseEditError([account],[{...account,heldAmount:10000}])).toContain('become available on their release dates');
 expect(lockedReleaseEditError([account],[])).toContain('release records');
 expect(lockedReleaseEditError([account],[{...account,releaseSchedule:account.releaseSchedule!.map(r=>({...r,date:'2026-12-01'}))}])).toBe('');
});
it('shows a due tranche as released only after the server records it',()=>{
 const {rerender}=render(<BudgetReleaseCalendar data={data()}/>);
 expect(screen.getByText('Release due',{exact:true})).toBeVisible();
 expect(screen.getByText('Scheduled',{exact:true})).toBeVisible();
 expect(screen.getByText(/15,000.00 pending/)).toBeVisible();
 expect(screen.queryByRole('button',{name:'Confirm availability'})).toBeNull();
 const [first,second]=account.releaseSchedule!;
 rerender(<BudgetReleaseCalendar data={data([{...account,heldAmount:5000,releaseSchedule:[{...first,status:'confirmed',automatic:true},second]}])}/>);
 expect(screen.getByText('Released',{exact:true})).toBeVisible();
 expect(screen.getByText('Released automatically')).toBeVisible();
 expect(screen.getByText(/5,000.00 pending/)).toBeVisible();
 expect(screen.getByText('Scheduled',{exact:true})).toBeVisible();
});
it('selects dates without changing the saved schedule',()=>{
 render(<BudgetReleaseCalendar data={data()}/>);fireEvent.click(screen.getByRole('button',{name:'Show releases for 2026-11-02'}));
 expect(within(screen.getByLabelText('Office budget release calendar')).getAllByText('Supplies')).toHaveLength(1);
});
it('includes Q4 target and calendar edits in the version history',()=>{
 const before={version:1,total:30000,actorName:'Head',createdAt:'2026-11-01',reason:'Initial',accounts:[account],q4Target:75};
 const changes=budgetVersionChanges(before,{...before,version:2,q4Target:90,accounts:[{...account,releaseSchedule:[{...account.releaseSchedule![0],date:'2026-12-01'},account.releaseSchedule![1]]}]});
 expect(changes).toContainEqual(expect.objectContaining({field:'Q4 utilization target',before:'75%',after:'90%'}));expect(changes).toContainEqual(expect.objectContaining({field:'Release schedule'}));
});
