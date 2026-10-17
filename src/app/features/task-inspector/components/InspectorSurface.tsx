import {useLayoutEffect,useRef,type ComponentProps} from 'react';
import {InspectorPanel} from '../../../shared/motion';
import './taskPage.css';

/** The page variant stays inside the application shell and never traps focus. */
export function InspectorSurface({presentation='drawer',...props}:ComponentProps<typeof InspectorPanel>&{presentation?:'drawer'|'page'}){
 const page=useRef<HTMLElement>(null);
 useLayoutEffect(()=>{if(presentation==='page'&&props.open)page.current?.focus();},[presentation,props.open]);
 if(presentation!=='page')return <InspectorPanel {...props}/>;
 if(!props.open)return null;
 return <section ref={page} tabIndex={-1} className="task-page" aria-label={props.ariaLabel}>{props.children}</section>;
}
