// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {useState} from 'react';
import {InlineEditableText,WorkspaceTabs,SplitActionButton} from '../../src/app/components/ui/workspace';
afterEach(cleanup);
describe('workspace interaction foundation',()=>{
 it('cancels with Escape and saves the next edit once despite Enter followed by blur',async()=>{
  let finish!:()=>void;const save=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve}));
  render(<InlineEditableText value="Original" label="project title" onSave={save}/>);
  fireEvent.click(screen.getByRole('button',{name:'Edit project title'}));
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'Cancelled'}});
  fireEvent.keyDown(screen.getByRole('textbox'),{key:'Escape'});
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Edit project title'}));
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'  Updated  '}});
  fireEvent.keyDown(screen.getByRole('textbox'),{key:'Enter'});
  fireEvent.blur(screen.getByRole('textbox'));
  expect(save).toHaveBeenCalledExactlyOnceWith('Updated');finish();
  await waitFor(()=>expect(screen.queryByRole('textbox')).toBeNull());
 });
 it('keeps an unsuccessful edit open with accessible feedback',async()=>{
  render(<InlineEditableText value="Original" label="task title" onSave={async()=>{throw new Error('Connection lost')}}/>);
  fireEvent.click(screen.getByRole('button'));
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'Update'}});
  fireEvent.keyDown(screen.getByRole('textbox'),{key:'Enter'});
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','Connection lost');
  expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true');
 });
 it('switches controlled workspace tabs using the keyboard',()=>{
  function Tabs(){const [value,onValueChange]=useState('main');return <WorkspaceTabs label="Views" value={value} onValueChange={onValueChange} tabs={[{id:'main',label:'Main',content:<p>Main content</p>},{id:'history',label:'History',content:<p>History content</p>}]}/>;}
  render(<Tabs/>);const first=screen.getByRole('tab',{name:'Main'});first.focus();
  fireEvent.keyDown(first,{key:'ArrowRight'});fireEvent.keyDown(screen.getByRole('tab',{name:'History'}),{key:'Enter'});
  expect(screen.getByRole('tab',{name:'History'}).getAttribute('aria-selected')).toBe('true');
 });
 it('separates the common action from its contextual menu',async()=>{
  const primary=vi.fn(),secondary=vi.fn();render(<SplitActionButton label="New task" onClick={primary} actions={[{id:'template',label:'Use template',onSelect:secondary}]}/>);
  fireEvent.click(screen.getByRole('button',{name:'New task',exact:true}));expect(primary).toHaveBeenCalledOnce();
  fireEvent.keyDown(screen.getByRole('button',{name:'New task options'}),{key:'Enter'});
  fireEvent.click(await screen.findByRole('menuitem',{name:'Use template'}));await waitFor(()=>expect(secondary).toHaveBeenCalledOnce());expect(document.activeElement).toBe(screen.getByRole('button',{name:'New task options'}));expect(primary).toHaveBeenCalledOnce();
 });
});
