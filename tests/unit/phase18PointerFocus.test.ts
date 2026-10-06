// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {focusActivatedButton} from '../../src/app/shared/focusActivatedButton';
afterEach(()=>{document.body.innerHTML='';});
it('captures the enabled button even when its icon was activated',()=>{
 document.body.innerHTML='<button><span>Open</span></button>';
 const button=document.querySelector('button')!;
 focusActivatedButton(button.firstElementChild);expect(document.activeElement).toBe(button);
});
it('does not move focus into disabled or inert controls',()=>{
 document.body.innerHTML='<input><button disabled>Blocked</button><div inert><button>Inert</button></div>';
 const input=document.querySelector('input')!;input.focus();
 document.querySelectorAll('button').forEach(focusActivatedButton);expect(document.activeElement).toBe(input);
});
