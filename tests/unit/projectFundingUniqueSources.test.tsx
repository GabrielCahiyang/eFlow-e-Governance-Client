// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('../../src/app/shared/navigationGuard',()=>({useNavigationBlocker:vi.fn()}));
vi.mock('../../src/app/features/project-setup/services/projectFlow',()=>({projectFlowCall:vi.fn(),ProjectFlowError:class extends Error{}}));
import {ProjectFundingPanel} from '../../src/app/features/project-setup/components/ProjectFundingPanel';
afterEach(cleanup);
it('disables a source in other rows, caps rows to source count, and makes a removed source available again',()=>{
 const data={project:{id:'p',status:'planning'},canAllocate:true,canAuthorize:true,sources:[{id:'one',name:'First',year:2026,available:40000},{id:'two',name:'Second',year:2026,available:10000}],funds:[],fundingRequests:[],taskFunding:[],liquidations:[],requests:[],total:0,allocated:0,unallocated:0,released:0,spent:0} as any;
 render(<ProjectFundingPanel data={data} reload={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('Office Budget source'),{target:{value:'one'}});
 fireEvent.click(screen.getByRole('button',{name:'Add funding source'}));
 const second=screen.getAllByLabelText('Office Budget source')[1] as HTMLSelectElement;
 expect(second.querySelector('option[value="one"]')).toBeDisabled();
 expect(second.querySelector('option[value="two"]')).toBeEnabled();
 expect(screen.getByRole('button',{name:'Add funding source'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Remove funding row 1'}));
 expect(screen.getByRole('button',{name:'Add funding source'})).toBeEnabled();
 expect((screen.getByLabelText('Office Budget source') as HTMLSelectElement).querySelector('option[value="one"]')).toBeEnabled();
});
