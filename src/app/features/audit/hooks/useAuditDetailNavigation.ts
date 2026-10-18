import {useLayoutEffect,useRef,useState,type RefObject} from 'react';
type ScrollPosition={element:Element;top:number;left:number};
/** Keep the list mounted, including its private table sort, and restore its real scroll containers. */
export function useAuditDetailNavigation(list:RefObject<HTMLDivElement|null>){
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const origin=useRef<HTMLElement|null>(null),positions=useRef<ScrollPosition[]>([]),returnPending=useRef(false);
 const open=(id:string,trigger:HTMLElement)=>{
  origin.current=trigger;const containers=new Set<Element>();
  for(let element:Element|null=list.current;element;element=element.parentElement)containers.add(element);
  list.current?.querySelectorAll('.eflow-scroll-region').forEach(element=>containers.add(element));
  if(document.scrollingElement)containers.add(document.scrollingElement);
  positions.current=[...containers].map(element=>({element,top:element.scrollTop,left:element.scrollLeft}));setSelectedId(id);
 };
 const back=()=>{returnPending.current=true;setSelectedId(null);};
 useLayoutEffect(()=>{
  if(selectedId||!returnPending.current)return;returnPending.current=false;
  positions.current.forEach(({element,top,left})=>{element.scrollTop=top;element.scrollLeft=left;});
  const target=origin.current?.isConnected?origin.current:list.current?.querySelector<HTMLElement>('input');target?.focus({preventScroll:true});
 },[selectedId,list]);
 return {selectedId,open,back};
}
