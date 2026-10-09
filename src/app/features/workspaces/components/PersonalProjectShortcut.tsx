import { useEffect, useState } from 'react';
import type { PersonalCommand } from '../types';
export function PersonalProjectShortcut({officeId,shortcuts,busy,run,onRefresh}:{officeId:string;shortcuts:string[];busy:boolean;run:(command:PersonalCommand,payload:Record<string,unknown>)=>Promise<boolean>;onRefresh:()=>Promise<void>}){
 const persisted=shortcuts.includes(officeId);
 const [draft,setDraft]=useState<boolean>();
 useEffect(()=>setDraft(undefined),[persisted]);
 return <label className="r3-shortcut-choice"><input type="checkbox" checked={draft??persisted} disabled={busy} onChange={async event=>{
  const enabled=event.target.checked;setDraft(enabled);
  if(await run('shortcut',{office_workspace_id:officeId,enabled}))void onRefresh();else setDraft(undefined);
 }}/> Show an explicit shortcut in my Office workspace. Only existing project members can see it; this grants no Office-wide access.</label>;
}
