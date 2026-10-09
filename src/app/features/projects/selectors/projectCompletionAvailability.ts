import type { ProjectCompletionReadiness } from '../services/projectLifecycleService';
export interface CompletionAvailability { enabled: boolean; reason: string }

/** Presentation only. The completion RPC and database trigger remain the authority. */
export function projectCompletionAvailability(status: string, allowed: boolean, loading: boolean, error: string, readiness?: ProjectCompletionReadiness): CompletionAvailability {
  if (!allowed) return { enabled: false, reason: 'Only an authorized Office Head can complete this project.' };
  if (status === 'completed' || status === 'archived') return { enabled: false, reason: 'This project is already closed.' };
  if (loading) return { enabled: false, reason: 'Checking completion requirements…' };
  if (error) return { enabled: false, reason: `Completion checks unavailable: ${error}` };
  if (!readiness) return { enabled: false, reason: 'Check current completion requirements first.' };
  if (readiness.blockers.length) return { enabled: false, reason: `${readiness.blockers.length} completion requirement(s) remain. ${readiness.blockers[0].title}: ${readiness.blockers[0].detail}` };
  return readiness.canComplete ? { enabled: true, reason: 'All current completion checks passed.' } : { enabled: false, reason: 'This project is not ready to complete. View completion requirements.' };
}
