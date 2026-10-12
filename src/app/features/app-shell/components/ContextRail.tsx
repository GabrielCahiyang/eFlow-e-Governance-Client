import type {ComponentProps,ReactNode} from 'react';
import {navigationGroupLabels,type ShellNavigationItem} from '../../navigation';
import {getEflowNavigationIcon} from '../eflowNavigationIcons';
import {ContextRailHeader} from './ContextRailHeader';
import {WorkspaceNavigationPanel} from './WorkspaceNavigationPanel';
type Props=ComponentProps<typeof WorkspaceNavigationPanel>&{role:string};
function Destinations({items,activeSection,activePage,onPageSelect}:{items:ShellNavigationItem[]}&Pick<Props,'activeSection'|'activePage'|'onPageSelect'>){
 return <>{items.map(item=>{return <div key={item.id} data-tour-section={item.id}>{item.pages.filter(page=>item.id!=='inbox'||page.label!=='Inbox').map(page=>{
  const Icon=getEflowNavigationIcon(item.id,page.label);
  const label=item.pages.length===1?item.label:page.label;
  return <button key={page.label} id={item.id==='inbox'&&page.label==='Updates'?'inbox-updates-context':undefined} type="button" className="eflow-workspace-navigation__destination" aria-current={activeSection===item.id&&activePage===page.label?'page':undefined} onClick={()=>onPageSelect(item.id,page.label)}><Icon size={17} aria-hidden="true"/><span>{label}</span>{item.hasAlert&&<span className="eflow-navigation-alert" aria-label="Actions pending"/>}</button>;
 })}</div>;})}</>;
}
function ContextContent({children,...props}:Props&{children:ReactNode}){
 const collapsed=props.preference.value.collapsed&&!props.mobile,title=navigationGroupLabels[props.group];
 return <section className="eflow-workspace-navigation eflow-scroll-region" aria-label={`${title} content`} data-context-rail={props.group}><header className="eflow-workspace-navigation__header"><ContextRailHeader title={title} collapsed={collapsed} mobile={props.mobile} onCollapse={()=>props.preference.setCollapsed(!collapsed)}/></header>{!collapsed&&<nav className="eflow-workspace-navigation__destinations" aria-label={`${title} destinations`}>{children}</nav>}</section>;
}
export function MyWorkContextRail(props:Props){return <ContextContent {...props}><Destinations {...props} items={props.items.filter(item=>item.id==='personal_work')}/></ContextContent>;}
export function InboxContextRail(props:Props){
 const page=props.activeSection==='inbox'&&(!props.activePage||props.activePage==='Inbox')?(props.role==='admin'?'Updates':'Needs action'):props.activePage;
 return <ContextContent {...props}><Destinations {...props} activePage={page} items={props.items.filter(item=>item.group==='inbox')}/></ContextContent>;
}
/** Route-derived presentation dispatch; no independent active navigation state. */
export function ContextRail(props:Props){
 if(props.group==='workspaces')return <WorkspaceNavigationPanel {...props}/>;
 if(props.group==='my-work')return <MyWorkContextRail {...props}/>;
 if(props.group==='inbox')return <InboxContextRail {...props}/>;
 const items=props.group==='account'?[{id:'settings',label:'Account',group:props.group,icon:null,pages:['Profile','Appearance','Notifications','Security'].map(label=>({label}))}]:props.items.filter(item=>item.group===props.group);
 return <ContextContent {...props}><Destinations {...props} items={items}/></ContextContent>;
}
