import type { ShellNavigationItem } from '../navigation';
/** Personal work is contextual; account Inbox, Accounting and explicit support grants remain discoverable. */
export function buildWorkspaceNavigation(items:ShellNavigationItem[],personal:boolean,foreignOffice:boolean):ShellNavigationItem[]{
 if(!personal&&!foreignOffice)return items;
 const projects:ShellNavigationItem={id:'projects',label:'Projects',icon:null,group:'workspaces',pages:[{label:'Projects'}]};
 const overview:ShellNavigationItem={id:'dashboard',label:'Workspace Overview',icon:null,group:'workspaces',pages:[{label:'Workspace Overview'}]};
 if(foreignOffice)return [overview,projects,...items.filter(item=>item.group!=='workspaces')];
 return [overview,projects,...items.filter(item=>['personal_work','inbox'].includes(item.id)||['accounting','admin-center'].includes(item.group))];
}
