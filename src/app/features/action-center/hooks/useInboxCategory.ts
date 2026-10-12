import {useSyncExternalStore} from 'react';
import {NAVIGATION_LOCATION_EVENT} from '../../../shared/navigationHistory';
const subscribe=(notify:()=>void)=>{window.addEventListener(NAVIGATION_LOCATION_EVENT,notify);window.addEventListener('popstate',notify);return()=>{window.removeEventListener(NAVIGATION_LOCATION_EVENT,notify);window.removeEventListener('popstate',notify);};};
/** Reads the existing route; there is no separate category selection authority. */
export function useInboxCategory(page:string,role:string){
 const selected=useSyncExternalStore(subscribe,()=>window.location.pathname==='/inbox'?new URLSearchParams(window.location.search).get('page')||page:page,()=>page);
 return selected==='Updates'||selected==='Inbox'&&role==='admin'?'updates':'actions';
}
