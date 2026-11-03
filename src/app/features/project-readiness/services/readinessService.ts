import { supabase } from '../../../../lib/supabase';
import type { ProjectReadiness, CloseoutSummary, ReviewKind } from '../types';
import { notifyProjectListeners } from '../../projects';
import type {ProjectFlow} from '../../project-setup';
async function readinessRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.code === 'PGRST202' ? 'Readiness checks are not installed yet. Contact your administrator.' : error.message);
  return data as T;
}
export async function fetchReadiness(projectId:string):Promise<ProjectReadiness>{
 const readiness=await readinessRpc<ProjectReadiness>('phase7_project_readiness',{p_project:projectId});
 if(readiness.governed)return readiness;
 const setup=await readinessRpc<ProjectFlow>('project_flow_snapshot',{p_project:projectId});
 if(setup.project.id!==projectId)throw new Error('Could not check this project. Try again.');
 const p=setup.project,missing:string[]=[];
 if(!p.title?.trim())missing.push('title');if(!p.description?.trim())missing.push('description');if(!p.scope?.trim())missing.push('scope');if(!p.project_lead_id)missing.push('project lead');if(!p.start_date)missing.push('start date');if(!p.target_date)missing.push('target date');if(p.start_date&&p.target_date&&p.target_date<p.start_date)missing.push('valid project dates');if(!p.funding_not_required&&setup.total<=0)missing.push('funding or No funding required');
 const check={key:'project_setup',label:'Project details and funding',ok:setup.ready,detail:setup.ready?'Project setup is complete.':missing.length?`Complete these in project setup: ${missing.join(', ')}.`:'Finish project setup before activating.'};
 return {...readiness,ready:readiness.ready&&setup.ready,canActivate:readiness.canActivate&&setup.ready,checks:[check,...readiness.checks.filter(item=>item.key!=='project_setup')]};
}
export const fetchCloseoutSummary = (projectId: string) => readinessRpc<CloseoutSummary>('phase7_closeout_summary', {p_project: projectId});
export const reviewProject = (projectId: string, kind: ReviewKind) => readinessRpc<void>('phase7_review_project', {p_project: projectId, p_kind: kind});
export async function activateReadyProject(projectId: string) {
  await readinessRpc<void>('phase7_activate_project', {p_project: projectId});
  await notifyProjectListeners();
}
