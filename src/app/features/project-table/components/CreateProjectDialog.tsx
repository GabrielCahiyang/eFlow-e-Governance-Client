import {useRef} from 'react';
import {createProject,notifyProjectListeners,type Project} from '../../projects';
import {ProjectFlowError,ProjectSetupWizard} from '../../project-setup';
import {useAuth} from '../../../contexts/AuthContext';
import type {UserProfile} from '../../../types';
export function CreateProjectDialog({open,onClose,onCreated,officeId,officeName,profiles=[]}:{open:boolean;onClose:()=>void;onCreated:(p:Project,ready?:boolean)=>void;officeId:string;officeName?:string;ownerName?:string;profiles?:UserProfile[]}){
 const created=useRef<Project|undefined>(undefined);
 const {user}=useAuth();
 const recoveryKey=user&&officeId?`eflow:project-draft:${user.id}:${officeId}`:'';
 async function close(id?:string,ready?:boolean){
  if(id){
   const project=created.current?.id===id?created.current:(await notifyProjectListeners()).find(project=>project.id===id);
   if(project)onCreated(project,ready);
  }
  onClose();
 }
 if(!open)return null;
 return <ProjectSetupWizard key={recoveryKey} recoveryKey={recoveryKey} profiles={profiles.filter(person=>person.org_id===officeId)} officeName={officeName}
  createDraft={async (title,requestId)=>{
   try{
    const project=await createProject({title,orgId:officeId,status:'planning',sourceType:'manual'},requestId);
    created.current=project;
    return project.id;
   }catch(error){
    if(error&&typeof error==='object'&&'code' in error&&typeof error.code==='string'&&/^(22|23|28|42)[0-9A-Z]{3}$/.test(error.code)){
     throw new ProjectFlowError('Project creation was rejected. Check your Office access and project details, then retry.',error.code);
    }
    throw error;
   }
  }} onClose={id=>void close(id)} onFinish={id=>void close(id,true)}/>;
}
