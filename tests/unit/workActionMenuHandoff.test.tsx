// @vitest-environment jsdom
import {useEffect,useRef,useState} from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {WorkNodeActionMenu} from '../../src/app/features/nested-work/components/WorkNodeActionMenu';

afterEach(cleanup);
it('opens and focuses an editor only after its dropdown detaches, exactly once',async()=>{
 const selected=vi.fn();
 function Proof(){
  const [open,setOpen]=useState(false),input=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(open)input.current?.focus();},[open]);
  return <><WorkNodeActionMenu label="Node actions" actions={[{id:'edit',label:'Edit details',onSelect:()=>{
   selected(document.querySelector('[role="menu"]'));setOpen(true);
  }}]}/>{open&&<input ref={input} aria-label="Subitem title"/>}</>;
 }
 render(<Proof/>);
 fireEvent.keyDown(screen.getByRole('button',{name:'Node actions'}),{key:'Enter'});
 fireEvent.click(await screen.findByRole('menuitem',{name:'Edit details'}));
 await waitFor(()=>expect(selected).toHaveBeenCalledExactlyOnceWith(null));
 const input=await screen.findByRole('textbox',{name:'Subitem title'});
 await waitFor(()=>expect(document.activeElement).toBe(input));
 expect(screen.queryByRole('menu')).toBeNull();
});
it('cancelling a menu or selecting a disabled action never opens an editor',async()=>{
 const selected=vi.fn();
 render(<WorkNodeActionMenu label="Node actions" actions={[{id:'edit',label:'Edit details',disabled:true,disabledReason:'Verify current work access',onSelect:selected}]}/>);
 const trigger=screen.getByRole('button',{name:'Node actions'});
 trigger.focus();fireEvent.keyDown(trigger,{key:'Enter'});
 const item=await screen.findByRole('menuitem',{name:'Edit details'});
 expect(item.getAttribute('aria-disabled')).toBe('true');fireEvent.click(item);
 fireEvent.keyDown(screen.getByRole('menu'),{key:'Escape'});
 await waitFor(()=>expect(screen.queryByRole('menu')).toBeNull());
 expect(selected).not.toHaveBeenCalled();
 await waitFor(()=>expect(document.activeElement).toBe(trigger));
});
