import type {Workspace} from '../types';
export function workspaceChoices(workspaces:Workspace[],recent:string[],query:string){
 const unique=[...new Map(workspaces.map(workspace=>[workspace.id,workspace])).values()];
 const needle=query.trim().toLocaleLowerCase();
 const matches=unique.filter(workspace=>`${workspace.name} ${workspace.kind} ${workspace.owner_name||''}`.toLocaleLowerCase().includes(needle));
 const recentRows=[...new Set(recent)].map(id=>matches.find(workspace=>workspace.id===id)).filter((workspace):workspace is Workspace=>!!workspace);
 if(needle||matches.length<=5||!recentRows.length||recentRows.length===matches.length)return [{label:'Workspaces',rows:matches}];
 const recentIds=new Set(recentRows.map(workspace=>workspace.id));
 return [{label:'Recent workspaces',rows:recentRows},{label:'Workspaces',rows:matches.filter(workspace=>!recentIds.has(workspace.id))}];
}
