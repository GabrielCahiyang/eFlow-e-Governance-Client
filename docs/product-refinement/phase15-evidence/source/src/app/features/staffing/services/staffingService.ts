import { phase2Request } from '../../../shared/phase2Api';
import { readAiText, requestAiChat, type AiQueueUpdate } from '../../ai';
import type { StaffingContext, StaffRecommendation } from '../types';
export const fetchStaffingContext = (taskId: string) => phase2Request<StaffingContext>('staffing/'+encodeURIComponent(taskId)+'/context');
export function parseStaffRecommendations(text: string, context: StaffingContext): StaffRecommendation[] {
  const payload: unknown = JSON.parse(text);
  if (!payload || typeof payload !== 'object' || !('recommendations' in payload) || !Array.isArray(payload.recommendations)) throw new Error('The AI response was incomplete. Try again.');
  const seen = new Set<string>();
  const rows: StaffRecommendation[] = [];
  for (const row of payload.recommendations) {
    const person = context.candidates.find(p=>p.id===row?.userId);
    if (!person || seen.has(person.id)) continue;
    const facts = [...person.skills,...person.training,...person.education,...person.experience,...person.specializations,...person.certifications,person.experience_summary].filter(Boolean);
    const evidence = Array.isArray(row.evidence) ? row.evidence.filter((e: unknown): e is string=>typeof e==='string' && facts.includes(e)).slice(0,5) : [];
    if (!evidence.length) continue;
    seen.add(person.id);
    rows.push({userId:person.id,evidence,activeTasks:person.activeTasks,remainingHours:person.remainingHours,unknownEffortTasks:person.unknownEffortTasks});
  }
  if (!rows.length) throw new Error('No recommendations cited confirmed profile facts. Try again after checking professional profiles.');
  return rows.slice(0,5);
}
export async function recommendStaff(context: StaffingContext, onQueueUpdate: (update: AiQueueUpdate) => void) {
  const response = await requestAiChat({messages:[{role:'user',content:'Recommend eligible staff for this project task.'}],workspace_staffing:{schemaVersion:1,taskId:context.task.id}}, {onQueueUpdate});
  return parseStaffRecommendations(readAiText(response),context);
}
