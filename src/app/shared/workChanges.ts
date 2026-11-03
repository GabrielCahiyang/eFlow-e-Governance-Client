import {supabase} from '../../lib/supabase';

type Listener={rootId?:string;refresh:()=>void};
const listeners=new Set<Listener>();
let channel:ReturnType<typeof supabase.channel>|undefined;
let queued:ReturnType<typeof setTimeout>|undefined;
const roots=new Set<string>();let all=false;
function changed(rootId?:string){
  if(rootId)roots.add(rootId);else all=true;
  if(queued!==undefined)return;
  queued=setTimeout(()=>{
    queued=undefined;const changedRoots=new Set(roots),every=all;roots.clear();all=false;
    for(const listener of listeners)if(every||!listener.rootId||changedRoots.has(listener.rootId))listener.refresh();
  },30);
}
const localChange=(event:Event)=>changed((event as CustomEvent<{taskId?:string}>).detail?.taskId);
/** Realtime invalidates authorized reads; its payload never becomes UI/cache data.
 * Share one channel across tables, My Work lists and open work inspectors. */
export function subscribeWorkChanges(refresh:()=>void,rootId?:string){
  if(typeof window==='undefined')return()=>{};
  const listener={refresh,rootId};listeners.add(listener);
  if(listeners.size===1){
    window.addEventListener('eflow:work-updated',localChange);
    try{
      channel=supabase.channel(`work-changes-${crypto.randomUUID()}`);
      const currentChannel=channel;let connectedOnce=false;
      // Only subscribe to tables in the hosted Realtime publication. Personal
      // work still uses committed local events and the consumers' focus/poll reads.
      for(const table of ['tasks','subtasks','subtask_progress_updates']){
        channel.on('postgres_changes',{event:'*',schema:'public',table},payload=>{
          if(channel!==currentChannel)return;
          const row=(payload.new||{}) as Record<string,unknown>,old=(payload.old||{}) as Record<string,unknown>;
          const root=String((table==='tasks'?row.id||old.id:row.task_id||old.task_id)||'');
          changed(root||undefined);
          if(old.task_id&&old.task_id!==row.task_id)changed(String(old.task_id));
        });
      }
      channel.subscribe(status=>{
        if(channel!==currentChannel)return;
        if(status==='SUBSCRIBED'){if(connectedOnce)changed();connectedOnce=true;}
        else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')connectedOnce=true;
      });
    }catch{channel=undefined;} // Existing focus/poll reads also cover unavailable Realtime.
  }
  return()=>{
    listeners.delete(listener);
    if(listeners.size)return;
    window.removeEventListener('eflow:work-updated',localChange);
    if(queued!==undefined)clearTimeout(queued);queued=undefined;roots.clear();all=false;
    if(channel){void supabase.removeChannel(channel);channel=undefined;}
  };
}
