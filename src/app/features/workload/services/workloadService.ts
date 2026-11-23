import { supabase } from '../../../../lib/supabase';
import { registerAuthCacheReset } from '../../../shared/authCacheReset';
import {
  DEFAULT_WORKLOAD_THRESHOLDS,
  type MemberWorkloadDetail,
  type OfficeWorkloadSummary,
  type ProposedAssignmentRole,
  type WorkloadThresholds,
  type WorkloadThresholdSettingsBundle,
} from '../types';

export const WORKLOAD_CHANGED_EVENT = 'eflow:workload-changed';

const SUMMARY_TTL_MS = 20_000;
const summaryCache = new Map<string, { data: OfficeWorkloadSummary; at: number }>();
const summaryInFlight = new Map<string, Promise<OfficeWorkloadSummary>>();

registerAuthCacheReset(() => {
  summaryCache.clear();
  summaryInFlight.clear();
});

export function invalidateWorkloadCache() {
  summaryCache.clear();
  summaryInFlight.clear();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(WORKLOAD_CHANGED_EVENT));
  }
}

export async function fetchOfficeWorkloadSummary(
  orgId?: string | null,
  options?: { force?: boolean },
): Promise<OfficeWorkloadSummary> {
  const key = orgId || '__default__';
  if (!options?.force) {
    const cached = summaryCache.get(key);
    if (cached && Date.now() - cached.at < SUMMARY_TTL_MS) {
      return cached.data;
    }
    const existing = summaryInFlight.get(key);
    if (existing) return existing;
  }

  const request = (async (): Promise<OfficeWorkloadSummary> => {
    if (typeof supabase.rpc !== 'function') {
      return {
        orgId: orgId || null,
        thresholds: DEFAULT_WORKLOAD_THRESHOLDS,
        members: [],
        calculatedAt: new Date().toISOString(),
      };
    }
    const { data, error } = await supabase.rpc('get_office_workload_summary', {
      p_org_id: orgId || null,
    });
    if (error) {
      if (error.code === 'PGRST202') {
        return {
          orgId: orgId || null,
          thresholds: DEFAULT_WORKLOAD_THRESHOLDS,
          members: [],
          calculatedAt: new Date().toISOString(),
        };
      }
      throw new Error(error.message);
    }
    const parsed = (data || {
      orgId: orgId || null,
      thresholds: DEFAULT_WORKLOAD_THRESHOLDS,
      members: [],
      calculatedAt: new Date().toISOString(),
    }) as OfficeWorkloadSummary;
    summaryCache.set(key, { data: parsed, at: Date.now() });
    return parsed;
  })().finally(() => {
    if (summaryInFlight.get(key) === request) {
      summaryInFlight.delete(key);
    }
  });

  summaryInFlight.set(key, request);
  return request;
}

export async function fetchMemberWorkloadDetail(
  userId: string,
  orgId?: string | null,
): Promise<MemberWorkloadDetail> {
  const { data, error } = await supabase.rpc('get_member_workload_detail', {
    p_user_id: userId,
    p_org_id: orgId || null,
  });
  if (error) throw new Error(error.message);
  return data as MemberWorkloadDetail;
}

export async function recordWorkloadOverloadOverride(input: {
  targetUserId: string;
  contextType: 'project' | 'task' | 'subtask' | 'project_team';
  entityId?: string | null;
  proposedRole: ProposedAssignmentRole;
  reason: string;
  snapshot?: Record<string, unknown>;
}): Promise<void> {
  if (typeof supabase.rpc !== 'function') return;
  const { error } = await supabase.rpc('record_workload_overload_override', {
    p_target_user_id: input.targetUserId,
    p_context_type: input.contextType,
    p_entity_id: input.entityId || null,
    p_proposed_role: input.proposedRole,
    p_reason: input.reason.trim(),
    p_snapshot: input.snapshot || {},
  });
  if (error && error.code !== 'PGRST202') {
    throw new Error(error.message);
  }
  invalidateWorkloadCache();
}

export async function fetchWorkloadThresholdSettings(
  orgId?: string | null,
): Promise<WorkloadThresholdSettingsBundle> {
  const { data, error } = await supabase.rpc('get_workload_threshold_settings', {
    p_org_id: orgId || null,
  });
  if (error) throw new Error(error.message);
  return data as WorkloadThresholdSettingsBundle;
}

export async function saveWorkloadThresholdSettings(
  payload: Omit<WorkloadThresholds, 'id' | 'orgName' | 'updatedAt'>,
): Promise<WorkloadThresholdSettingsBundle> {
  const { data, error } = await supabase.rpc('save_workload_threshold_settings', {
    p_payload: payload,
  });
  if (error) throw new Error(error.message);
  invalidateWorkloadCache();
  return data as WorkloadThresholdSettingsBundle;
}

export async function resetWorkloadThresholdSettings(
  orgId?: string | null,
): Promise<WorkloadThresholdSettingsBundle> {
  const { data, error } = await supabase.rpc('reset_workload_threshold_settings', {
    p_org_id: orgId || null,
  });
  if (error) throw new Error(error.message);
  invalidateWorkloadCache();
  return data as WorkloadThresholdSettingsBundle;
}
