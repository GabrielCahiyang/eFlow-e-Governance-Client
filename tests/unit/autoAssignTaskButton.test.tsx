// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({prepare:vi.fn(),apply:vi.fn()}));
vi.mock('../../src/app/features/staffing/services/autoAssignment',()=>({prepareAutoAssignment:api.prepare,applyAutoAssignment:api.apply}));
import {AutoAssignTaskButton} from '../../src/app/features/staffing/components/AutoAssignTaskButton';
import type {WorkTreeSnapshot} from '../../src/app/features/nested-work';
const snapshot={root:{id:'qa-task'},nodes:[],revision:1} as unknown as WorkTreeSnapshot;
beforeEach(()=>vi.clearAllMocks());afterEach(cleanup);
it('shows actual queue stages, blocks duplicate clicks and saves the team once',async()=>{
 let finish!:(request:any)=>void;api.prepare.mockImplementation((_snapshot,update)=>{update({status:'queued',jobsAhead:2});return new Promise(resolve=>{finish=resolve;});});api.apply.mockResolvedValue(snapshot);
 const busy=vi.fn(),assigned=vi.fn().mockResolvedValue(undefined);
 render(<AutoAssignTaskButton snapshot={snapshot} disabled={false} onBusyChange={busy} onAssigned={assigned}/>);
 fireEvent.click(screen.getByRole('button',{name:'AI auto assign'}));
 expect(screen.getByRole('status').textContent).toBe('Waiting for AI · 2 ahead');
 fireEvent.click(screen.getByRole('button',{name:'Assigning…'}));expect(api.prepare).toHaveBeenCalledOnce();
 act(()=>api.prepare.mock.calls[0][1]({status:'processing',progress:{message:'Comparing confirmed skills and workload'}}));
 expect(screen.getByRole('status').textContent).toContain('Comparing confirmed skills');
 await act(async()=>finish({id:'qa-request',root:'qa-task'}));await waitFor(()=>expect(assigned).toHaveBeenCalledWith(snapshot));
 expect(api.apply).toHaveBeenCalledOnce();expect(busy.mock.calls.map(([value])=>value)).toEqual([true,false]);
 expect((screen.getByRole('button',{name:'Team assigned'}) as HTMLButtonElement).disabled).toBe(true);
});
it('retries an uncertain save with the identical request without rerunning the model',async()=>{
 const request={id:'stable-request',root:'qa-task'};api.prepare.mockResolvedValue(request);api.apply.mockRejectedValueOnce(new Error('Connection interrupted')).mockResolvedValue(snapshot);
 render(<AutoAssignTaskButton snapshot={snapshot} disabled={false} onBusyChange={vi.fn()} onAssigned={vi.fn().mockResolvedValue(undefined)}/>);
 fireEvent.click(screen.getByRole('button',{name:'AI auto assign'}));await screen.findByRole('alert');
 fireEvent.click(screen.getByRole('button',{name:'Retry assignment'}));await screen.findByRole('button',{name:'Team assigned'});
 expect(api.prepare).toHaveBeenCalledOnce();expect(api.apply.mock.calls).toEqual([[request],[request]]);
});
