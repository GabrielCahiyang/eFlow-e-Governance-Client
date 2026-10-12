// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {getEflowNavigationIcon} from '../../src/app/features/app-shell/eflowNavigationIcons';
import {ProductivitySidebar} from '../../src/app/features/app-shell/components/ProductivitySidebar';
import {buildShellNavigation} from '../../src/app/features/navigation';
import {EflowVibeThemeProvider} from '../../src/app/shared/vibe';

Object.defineProperty(window,'matchMedia',{writable:true,value:()=>({matches:false,addEventListener(){},removeEventListener(){}})});
afterEach(()=>{cleanup();localStorage.clear();});

for(const role of ['admin','head','member','accounting_staff'])it(role+' has distinguishable icons for every visible destination in each context',()=>{
 const items=buildShellNavigation({role,can:()=>true,hasLeadingWork:true});
 for(const group of new Set(items.map(item=>item.group))){
  const pages=items.filter(item=>item.group===group&&(group!=='my-work'||item.id==='personal_work'))
   .flatMap(item=>item.pages.filter(page=>item.id!=='inbox'||page.label!=='Inbox').map(page=>({label:page.label,icon:getEflowNavigationIcon(item.id,page.label)})));
  expect(new Set(pages.map(page=>page.icon)).size,group+': '+pages.map(page=>page.label).join(', ')).toBe(pages.length);
 }
});

it('renders four different My Work glyphs without changing names, selected state or navigation',()=>{
 const select=vi.fn();
 render(<EflowVibeThemeProvider preference="light"><ProductivitySidebar role="member" activeSection="personal_work" activePage="History" navigationItems={buildShellNavigation({role:'member',can:()=>true})} onPageSelect={select} userId="actor" workspaceId="office"/></EflowVibeThemeProvider>);
 const nav=within(screen.getByRole('navigation',{name:'My Work destinations'}));
 const expected=[['Assigned work','lucide-clipboard-list'],['Leading','lucide-flag-triangle-right'],['Subtasks','lucide-list-tree'],['History','lucide-history']];
 for(const [name,glyph] of expected){const icon=nav.getByRole('button',{name,exact:true}).querySelector('svg')!;expect(icon.classList.contains(glyph)).toBe(true);expect(icon.getAttribute('aria-hidden')).toBe('true');expect(icon.getAttribute('width')).toBe('17');}
 expect(nav.getByRole('button',{name:'History',exact:true}).getAttribute('aria-current')).toBe('page');
 fireEvent.click(nav.getByRole('button',{name:'Leading',exact:true}));expect(select).toHaveBeenLastCalledWith('personal_work','Leading');
});

it('also distinguishes the four account settings destinations',()=>{
 const icons=['Profile','Appearance','Notifications','Security'].map(page=>getEflowNavigationIcon('settings',page));
 expect(new Set(icons).size).toBe(4);
});
