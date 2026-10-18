// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {BudgetOperationalSignals} from '../../src/app/features/budget/components/BudgetOperationalSignals';
import type {DepartmentBudgetBundle} from '../../src/app/features/budget/types';

afterEach(cleanup);
const empty:DepartmentBudgetBundle={summary:null,sections:[],lines:[],commitments:[],allocations:[],allocationLines:[],requests:[],requestAttachments:[],releases:[],liquidations:[],ledger:[],adjustments:[]};
it('gives the four simultaneous empty budget cards different illustrations and keeps the mapping stable when a card fills',()=>{
  const view=render(<BudgetOperationalSignals data={empty}/>);
  const pictures=()=>Array.from(view.container.querySelectorAll('img.eflow-empty-illustration'));
  const sources=pictures().map(image=>image.getAttribute('src'));
  expect(sources).toHaveLength(4);
  expect(new Set(sources).size).toBe(4);
  expect(new Set(pictures().map(image=>image.getAttribute('data-style'))).size).toBe(4);
  view.rerender(<BudgetOperationalSignals data={{...empty,ledger:[{id:'entry',entryType:'budget_locked',amount:1000,description:'Annual budget locked',createdAt:Date.now()}]}}/>);
  expect(screen.getByText('Annual budget locked')).toBeVisible();
  expect(pictures().map(image=>image.getAttribute('src'))).toEqual(sources.slice(0,3));
  expect(screen.queryByText('Audited financial actions will appear here.')).toBeNull();
});
