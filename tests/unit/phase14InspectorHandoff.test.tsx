// @vitest-environment jsdom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTaskInspector } from '../../src/app/features/task-inspector/hooks/useTaskInspector';
import { useExplicitDraft } from '../../src/app/shared/useExplicitDraft';
import { installNavigationConfirmation } from '../../src/app/shared/navigationGuard';
let uninstall:(()=>void)|undefined;afterEach(()=>{cleanup();uninstall?.();});
function DraftEditor({onTask}:{onTask:()=>void}){const [note,setNote]=useState('Unsaved membership');useExplicitDraft('Office members',!!note,false,()=>setNote(''));return <section><input aria-label="Membership draft" value={note} onChange={e=>setNote(e.target.value)}/><button onClick={onTask}>Open related task</button></section>;}
function Handoff(){const inspector=useTaskInspector('project');const [editor,setEditor]=useState(true);return <>{editor&&<DraftEditor onTask={()=>inspector.openTask('task',{view:'offices'},()=>setEditor(false))}/>}<output aria-label="Opened task">{inspector.taskId||'None'}</output></>;}
describe('Phase 14 guarded inspector handoff',()=>{
 it('keeps task-ID-only selection and explicit origin focus contracts',async()=>{
  const trigger=document.createElement('button');document.body.appendChild(trigger);trigger.focus();
  const hook=renderHook(()=>useTaskInspector('project'));
  await act(async()=>hook.result.current.openTask('task'));
  expect(hook.result.current.taskId).toBe('task');expect(hook.result.current.origin).toEqual({view:'project',returnFocus:trigger});
  const restoreFocus=vi.fn();await act(async()=>hook.result.current.openTask('task',{view:'Table',section:'work',returnFocus:trigger,restoreFocus}));
  expect(hook.result.current.origin).toEqual({view:'Table',section:'work',returnFocus:trigger,restoreFocus});
  hook.unmount();trigger.remove();
 });
 it('retains the source on refusal and opens the task and closes the source after exactly one accepted confirmation',async()=>{
  const decision=vi.fn().mockResolvedValue(false);uninstall=installNavigationConfirmation(decision);render(<Handoff/>);fireEvent.click(screen.getByRole('button',{name:'Open related task'}));await waitFor(()=>expect(decision).toHaveBeenCalledOnce());expect(screen.getByLabelText('Opened task').textContent).toBe('None');expect((screen.getByLabelText('Membership draft') as HTMLInputElement).value).toBe('Unsaved membership');
  decision.mockResolvedValue(true);await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Open related task'})));expect(decision).toHaveBeenCalledTimes(2);expect(screen.getByLabelText('Opened task').textContent).toBe('task');expect(screen.queryByLabelText('Membership draft')).toBeNull();
 });
});
