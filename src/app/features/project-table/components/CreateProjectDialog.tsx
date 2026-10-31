import {useRef} from 'react';
import {createProject,type Project} from '../../projects';
import {ProjectSetupWizard} from '../../project-setup';
import type {UserProfile} from '../../../types';
export function CreateProjectDialog({open,onClose,onCreated,officeId,officeName,profiles=[]}:{open:boolean;onClose:()=>void;onCreated:(p:Project,ready?:boolean)=>void;officeId:string;officeName?:string;ownerName?:string;profiles?:UserProfile[]}){
 const created=useRef<Project|undefined>(undefined);
 const close=()=>{if(created.current)onCreated(created.current);onClose();};
 if(!open)return null;
 return <ProjectSetupWizard profiles={profiles.filter(person=>person.org_id===officeId)} officeName={officeName} createDraft={async title=>{const project=await createProject({title,orgId:officeId,status:'planning',sourceType:'manual'});created.current=project;return project.id;}} onClose={close} onFinish={()=>{if(created.current)onCreated(created.current,true);onClose();}}/>;
}
