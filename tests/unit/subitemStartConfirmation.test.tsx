// @vitest-environment jsdom
import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
const api=vi.hoisted(()=>({start:vi.fn()}));
vi.mock('../../src/app/features/subtasks/services/subtaskWorkflowService',()=>({startScheduledSubtask:api.start}));
import {SubitemStartPanel} from '../../src/app/features/subtasks/components/SubitemStartPanel';
beforeEach(()=>{api.start.mockReset();api.start.mockResolvedValue(undefined);});
afterEach(cleanup);
it('cancels Start without checking authority or writing, and prevents stacked confirmations',async()=>{
 const recheck=vi.fn(),onStarted=vi.fn();
 render(<SubitemStartPanel taskId="root" subtaskId="node" pending={false} blockedReason={null} recheck={recheck} onStarted={onStarted}/>);
 const start=screen.getByRole('button',{name:'Start work'});
 fireEvent.click(start);fireEvent.click(start);
 expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
 fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button',{name:'Cancel'}));
 await waitFor(()=>expect(screen.queryByRole('alertdialog')).toBeNull());
 expect(recheck).not.toHaveBeenCalled();expect(api.start).not.toHaveBeenCalled();
});
it('rechecks after confirmation and writes once while disabled through the refresh',async()=>{
 let finish!:()=>void;
 const recheck=vi.fn().mockResolvedValue(undefined),onStarted=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));
 render(<SubitemStartPanel taskId="root" subtaskId="node" pending={false} blockedReason={null} recheck={recheck} onStarted={onStarted}/>);
 fireEvent.click(screen.getByRole('button',{name:'Start work'}));
 expect(recheck).not.toHaveBeenCalled();
 const confirm=within(screen.getByRole('alertdialog')).getByRole('button',{name:'Start work'});
 fireEvent.click(confirm);fireEvent.click(confirm);
 await waitFor(()=>expect(api.start).toHaveBeenCalledExactlyOnceWith('root','node'));
 expect(recheck).toHaveBeenCalledOnce();expect(screen.getByRole('status').textContent).toContain('Subtask started');
 await act(async()=>finish());
});
it('retains an error and makes no write when authority changes during confirmation',async()=>{
 const recheck=vi.fn().mockRejectedValue(new Error('Current authority denied'));
 render(<SubitemStartPanel taskId="root" subtaskId="node" pending={false} blockedReason={null} recheck={recheck} onStarted={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Start work'}));
 fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button',{name:'Start work'}));
 expect((await screen.findByRole('alert')).textContent).toBe('Current authority denied');expect(api.start).not.toHaveBeenCalled();
});
