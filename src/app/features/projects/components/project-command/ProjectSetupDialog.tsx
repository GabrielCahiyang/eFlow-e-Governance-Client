import { useState } from 'react';
import { CalendarDays, UsersRound } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/button';
import { requestNavigation } from '../../../../shared/navigationGuard';
import { ProjectReadinessPanel, type ReadinessDestination } from '../../../project-readiness';
import type { Project } from '../../services/types';

export function ProjectSetupDialog({project,canManage,onClose,onOpenSettings,onOpenOffices,onResolve}:{
 project:Project;canManage:boolean;onClose:()=>void;onOpenSettings:()=>void;onOpenOffices:()=>void;onResolve:(view:ReadinessDestination)=>void;
}){
 const [footerTarget,setFooterTarget]=useState<HTMLDivElement|null>(null),[busy,setBusy]=useState(false);
 const leave=(action:()=>void)=>void requestNavigation(()=>{onClose();action();});
 const close=()=>void requestNavigation(onClose);
 return <Modal isOpen title="Project setup" description={project.title} width="max-w-4xl" className="project-setup-modal" bodyClassName="project-setup-body" preventClose={busy} onClose={close}
  footer={<div ref={setFooterTarget} className="w-full"/>}>
  <ProjectReadinessPanel project={project} canManage={canManage} setup footerTarget={footerTarget} onClose={close} onBusyChange={setBusy}
   shortcuts={<><Button variant="outline" disabled={busy} onClick={()=>leave(onOpenSettings)}><CalendarDays size={16} aria-hidden="true"/>Set project dates</Button><Button variant="outline" disabled={busy} onClick={()=>leave(onOpenOffices)}><UsersRound size={16} aria-hidden="true"/>Choose project people</Button></>}
   onResolve={view=>leave(()=>{if(view==='gantt')onOpenSettings();else onResolve(view);})}/>
 </Modal>;
}
