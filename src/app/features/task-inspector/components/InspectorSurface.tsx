import {useLayoutEffect,useRef,type ComponentProps} from 'react';
import {InspectorPanel} from '../../../shared/motion';
import './taskPage.css';

/** The page variant stays inside the application shell and never traps focus. */
export function InspectorSurface({presentation='drawer',...props}:ComponentProps<typeof InspectorPanel>&{presentation?:'drawer'|'page'}){
 const page=useRef<HTMLElement>(null);
 const returnTarget=useRef({element:props.returnFocus,restore:props.onReturnFocus});
 returnTarget.current={element:props.returnFocus,restore:props.onReturnFocus};
 useLayoutEffect(()=>{
  if(presentation!=='page'||!props.open)return;
  page.current?.focus();
  return()=>{const target=returnTarget.current;requestAnimationFrame(()=>{
   if(target.element?.isConnected&&!target.element.closest('[hidden],[inert]'))target.element.focus();else target.restore?.();
  });};
 },[presentation,props.open]);
 if(presentation!=='page')return <InspectorPanel {...props}/>;
 if(!props.open)return null;
 return <section ref={page} tabIndex={-1} className="task-page" aria-label={props.ariaLabel}>{props.children}</section>;
}
