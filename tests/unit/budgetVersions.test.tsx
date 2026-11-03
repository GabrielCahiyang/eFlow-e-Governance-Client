// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {budgetProtectionIssue,budgetVersionChanges} from '../../src/app/features/budget/selectors/budgetVersions';
import {BudgetVersionBanner} from '../../src/app/features/budget/components/BudgetVersionBanner';
import type {DepartmentBudgetBundle,OfficeBudgetVersion} from '../../src/app/features/budget/types';
afterEach(cleanup);
const account={id:'account',name:'Supplies',amount:30000,heldAmount:0,position:0};
const v1:OfficeBudgetVersion={version:1,total:30000,actorName:'Cheryl Gallo',reason:'Initial locked budget',createdAt:'2026-11-01T02:00:00Z',accounts:[account]};
it('protects project reservations without adding spending already inside that reservation',()=>{
 const saved=[{...account,committedAmount:20000,spentAmount:5000,protectedAmount:20000,reservations:[{id:'p1',name:'Project 1',amount:20000}]}];
 expect(budgetProtectionIssue(saved,[{...account,amount:19000}])).toMatchObject({minimum:20000,sources:[{name:'Project 1',amount:20000}]});
 expect(budgetProtectionIssue(saved,[{...account,amount:20000}])).toBeNull();expect(budgetProtectionIssue(saved,[{...account,amount:50000}])).toBeNull();
});
it('protects removed accounts, held funds and funded accounts converted into parents',()=>{
 const saved=[{...account,protectedAmount:20000}];
 expect(budgetProtectionIssue(saved,[])?.entered).toBe(0);
 expect(budgetProtectionIssue(saved,[{...account,amount:20000,heldAmount:1000}])?.minimum).toBe(21000);
 expect(budgetProtectionIssue(saved,[{...account,amount:0},{...account,id:'child',parentId:'account',amount:30000}])?.minimum).toBe(20000);
});
it('records before/after amounts, renamed, added and removed accounts',()=>{
 const v2={...v1,version:2,total:55000,accounts:[{...account,name:'Meeting supplies',amount:50000},{...account,id:'new',name:'Travel',amount:5000}]};
 expect(budgetVersionChanges(v1,v2)).toEqual(expect.arrayContaining([expect.objectContaining({field:'Budget',before:'₱30,000.00',after:'₱50,000.00'}),expect.objectContaining({field:'Name',after:'Meeting supplies'}),expect.objectContaining({field:'Added',account:'Travel'})]));
 expect(budgetVersionChanges(v2,{...v2,accounts:[v2.accounts[0]]})).toContainEqual(expect.objectContaining({field:'Removed',account:'Travel'}));
});
it('shows a prominent current version, Head name, reason and previous version changes',()=>{
 const v2={...v1,version:2,total:50000,reason:'Approved additional funding',accounts:[{...account,amount:50000}]};
 render(<BudgetVersionBanner data={{summary:{status:'locked',fiscalYear:2026,approvedAmount:50000},budgetVersions:[v1,v2]} as DepartmentBudgetBundle}/>);
 expect(screen.getByText('V2',{exact:true})).toBeVisible();expect(screen.getByText(/Office Budget · FY 2026/)).toBeVisible();
 fireEvent.click(screen.getByText(/Version history/));expect(screen.getByText('V1 · ₱30,000.00')).toBeVisible();expect(screen.getAllByText('Approved additional funding').length).toBe(2);expect(screen.getByText('₱30,000.00',{exact:true})).toBeVisible();
});
