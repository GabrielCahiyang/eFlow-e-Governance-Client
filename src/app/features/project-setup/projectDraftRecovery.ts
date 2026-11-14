import type {SetupDraft} from './components/ProjectSetupFields';
import type {ProjectFlow} from './types';

export interface ProjectDraftRecovery {
 values:SetupDraft;
 step:number;
 projectId:string;
 base?:ProjectFlow['project'];
 creationAttempt?:{id:string;title:string};
 people?:string[];
 projectType?:string;
 peopleProjectId?:string;
 peopleRequest?:{id:string;users:string[]};
}

export function readProjectDraft(key:string):ProjectDraftRecovery|undefined {
 if(!key)return;
 try{
  const value=JSON.parse(localStorage.getItem(key)??'null') as ProjectDraftRecovery|null;
  if(value&&typeof value.projectId==='string'&&
   (!value.creationAttempt||typeof value.creationAttempt.id==='string'&&typeof value.creationAttempt.title==='string')&&
   Number.isInteger(value.step)&&value.step>=0&&value.step<7&&value.values&&
   (value.projectType===undefined||typeof value.projectType==='string')&&
   (value.peopleProjectId===undefined||value.peopleProjectId===''||value.peopleProjectId===value.projectId)&&
   (!value.people||Array.isArray(value.people)&&value.people.every(id=>typeof id==='string'))&&
   (!value.peopleRequest||typeof value.peopleRequest.id==='string'&&Array.isArray(value.peopleRequest.users)&&value.peopleRequest.users.every(id=>typeof id==='string'))&&
   ['title','description','scope','lead','start','end'].every(field=>typeof value.values[field as keyof SetupDraft]==='string')&&
   typeof value.values.noFunding==='boolean')return value;
 }catch{ /* Browser storage may be unavailable. */ }
}

export function storeProjectDraft(key:string,draft?:ProjectDraftRecovery):boolean {
 if(!key)return false;
 try{
  if(draft)localStorage.setItem(key,JSON.stringify(draft));
  else localStorage.removeItem(key);
  return true;
 }catch{return false;}
}
