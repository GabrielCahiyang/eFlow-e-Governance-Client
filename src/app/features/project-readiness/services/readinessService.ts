import { supabase } from '../../../../lib/supabase';
import type { ProjectReadiness, CloseoutSummary, ReviewKind } from '../types';
import { notifyProjectListeners } from '../../projects';
import type {ProjectFlow} from '../../project-setup';
import { getPhilippineCalendarDate, isCalendarDate } from '../../../shared/calendarDates';
import { formatManilaDate } from '../../../shared/calendarDisplay';
async function readinessRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.code === 'PGRST202' ? 'Readiness checks are not installed yet. Contact your administrator.' : error.message);
  return data as T;
}
const inFlightReadiness = new Map<string, Promise<ProjectReadiness>>();

export function fetchReadiness(projectId:string):Promise<ProjectReadiness>{
 const existing=inFlightReadiness.get(projectId);
 if(existing)return existing;
 const request=(async()=>{
  const readiness=await readinessRpc<ProjectReadiness>('phase7_project_readiness',{p_project:projectId});
  if(readiness.governed)return readiness;
  const setup=await readinessRpc<ProjectFlow>('project_flow_snapshot',{p_project:projectId});
  if(setup.project.id!==projectId)throw new Error('Could not check this project. Try again.');
  const pendingRequests = setup.fundingRequests ?? [];
  const awaitingAccounting = pendingRequests.some(item => item.status === 'pending_accounting');
  const awaitingHead = pendingRequests.some(item => !item.status || item.status === 'pending');
  const p=setup.project,missing:string[]=[];
  if(!p.title?.trim())missing.push('title');if(!p.description?.trim())missing.push('description');if(!p.scope?.trim())missing.push('scope');if(!p.project_lead_id)missing.push('project lead');if(!p.start_date)missing.push('start date');if(!p.target_date)missing.push('target date');if(p.start_date&&p.target_date&&p.target_date<p.start_date)missing.push('valid project dates');if(!p.funding_not_required&&setup.total<=0&&!awaitingAccounting&&!awaitingHead)missing.push('funding or No funding required');
  const detail = setup.ready
    ? 'Project setup is complete.'
    : missing.length
      ? `Complete these in project setup: ${missing.join(', ')}.`
      : !p.funding_not_required && setup.total <= 0 && awaitingAccounting
        ? 'Independent Accounting Staff certification is required for submitted project funding before activation.'
        : !p.funding_not_required && setup.total <= 0 && awaitingHead
          ? 'Office Head endorsement and independent Accounting Staff certification are required for requested project funding before activation.'
          : 'Finish project setup before activating.';
  const check={key:'project_setup',label:'Project details and funding',ok:setup.ready,detail};
  const todayManila = getPhilippineCalendarDate();
  const startDate = p.start_date || readiness.startDate || null;
  const startInFuture = Boolean(startDate && isCalendarDate(startDate) && startDate > todayManila);
  const computedDaysUntilStart =
    startInFuture && startDate
      ? Math.max(
          0,
          Math.round(
            (Date.parse(`${startDate}T12:00:00Z`) - Date.parse(`${todayManila}T12:00:00Z`)) / 86_400_000,
          ),
        )
      : 0;
  const daysUntilStart =
    typeof readiness.daysUntilStart === 'number' ? readiness.daysUntilStart : computedDaysUntilStart;
  const existingChecks = readiness.checks.filter(item => item.key !== 'project_setup');
  const hasServerStartCheck = existingChecks.some(item => item.key === 'start_date_reached');
  const startCheck = startInFuture
    ? {
        key: 'start_date_reached',
        label: 'Project start date reached',
        ok: false,
        detail: `Start date is ${formatManilaDate(startDate, startDate!)} (Philippine Time). Schedule automatic start-date activation or start early with confirmation.`,
      }
    : null;
  const mergedChecks = hasServerStartCheck
    ? [check, ...existingChecks]
    : startCheck
      ? [check, ...existingChecks, startCheck]
      : [check, ...existingChecks];
  const startBlocked = mergedChecks.some(item => item.key === 'start_date_reached' && !item.ok);
  const allChecksExceptStartPass = mergedChecks
    .filter(item => item.key !== 'start_date_reached')
    .every(item => item.ok);
  const ready = readiness.ready && setup.ready && !startBlocked;
  const canActivate = readiness.canActivate && setup.ready && !startBlocked;
  const autoActivationScheduled = Boolean(
    readiness.autoActivationScheduled && setup.ready && startBlocked && allChecksExceptStartPass,
  );
  const canEarlyActivate = Boolean(
    startInFuture && allChecksExceptStartPass && setup.ready && (readiness.canEarlyActivate ?? true),
  );
  const canScheduleActivation = Boolean(
    canEarlyActivate && !autoActivationScheduled && (readiness.canScheduleActivation ?? true),
  );
  return {
    ...readiness,
    ready,
    canActivate,
    canEarlyActivate,
    daysUntilStart,
    canScheduleActivation,
    startDate,
    autoActivationScheduled,
    stage: autoActivationScheduled
      ? 'Scheduled for start date'
      : canActivate || canEarlyActivate
        ? 'Waiting for activation'
        : readiness.stage,
    checks: mergedChecks,
  };
 })().finally(()=>{if(inFlightReadiness.get(projectId)===request)inFlightReadiness.delete(projectId);});
 inFlightReadiness.set(projectId,request);
 return request;
}
export const fetchCloseoutSummary = (projectId: string) => readinessRpc<CloseoutSummary>('phase7_closeout_summary', {p_project: projectId});
export const reviewProject = (projectId: string, kind: ReviewKind) => readinessRpc<void>('phase7_review_project', {p_project: projectId, p_kind: kind});
export async function activateReadyProject(projectId: string) {
  await readinessRpc<void>('phase7_activate_project', {p_project: projectId});
  await notifyProjectListeners();
}
export async function activateProjectEarly(projectId: string, reason = '') {
  await readinessRpc<void>('activate_project_early', {p_project: projectId, p_reason: reason.trim()});
  await notifyProjectListeners();
}
export async function scheduleProjectActivation(projectId: string) {
  await readinessRpc<void>('schedule_project_activation', {p_project: projectId});
  await notifyProjectListeners();
}
export async function cancelScheduledProjectActivation(projectId: string) {
  await readinessRpc<void>('cancel_scheduled_project_activation', {p_project: projectId});
  await notifyProjectListeners();
}
