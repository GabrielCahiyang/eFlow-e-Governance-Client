import {useEffect,useState} from 'react';
import {fetchReturnedBudget,type ReturnedBudget} from '../services/returnedBudget';

const NONE:ReturnedBudget={task:0,subtasks:new Map()};
const EVENTS=['eflow:project-setup','eflow:work-updated','eflow:finance-updated'];

/** Budget returned to the project when this work was completed (finished work only). */
export function useReturnedBudget(taskId:string|undefined,enabled:boolean):ReturnedBudget{
 const [state,setState]=useState<{taskId?:string;value:ReturnedBudget}>({value:NONE});
 useEffect(()=>{
  if(!taskId||!enabled){setState({value:NONE});return;}
  let active=true,timer:ReturnType<typeof setTimeout>|undefined;
  const load=()=>{void fetchReturnedBudget(taskId).then(value=>{if(active)setState({taskId,value});}).catch(()=>{});};
  const refresh=()=>{clearTimeout(timer);timer=setTimeout(load,200);};
  load();
  EVENTS.forEach(name=>window.addEventListener(name,refresh));
  return()=>{active=false;clearTimeout(timer);EVENTS.forEach(name=>window.removeEventListener(name,refresh));};
 },[taskId,enabled]);
 return state.taskId===taskId?state.value:NONE;
}
