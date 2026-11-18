import { supabase } from "../../../../lib/supabase";
import { registerAuthCacheReset } from "../../../shared/authCacheReset";

const TASK_MAINTENANCE_COOLDOWN_MS = 15 * 60 * 1000;
const TASK_MAINTENANCE_STORAGE_KEY = "eflow:task-maintenance-last-run";

let maintenancePromise: Promise<void> | null = null;
let lastCompletedAt = 0;

function readLastRunAt(): number {
  if (lastCompletedAt > 0) return lastCompletedAt;
  try {
    const stored = Number(globalThis.sessionStorage?.getItem(TASK_MAINTENANCE_STORAGE_KEY) || 0);
    if (Number.isFinite(stored) && stored > 0) return stored;
  } catch {
    // Ignore storage read failures.
  }
  return 0;
}

function recordCompletedAt(timestamp: number): void {
  lastCompletedAt = timestamp;
  try {
    globalThis.sessionStorage?.setItem(TASK_MAINTENANCE_STORAGE_KEY, String(timestamp));
  } catch {
    // Ignore storage write failures.
  }
}

export function resetTaskMaintenanceCooldown(): void {
  maintenancePromise = null;
  lastCompletedAt = 0;
  try {
    globalThis.sessionStorage?.removeItem(TASK_MAINTENANCE_STORAGE_KEY);
  } catch {
    // Ignore storage removal failures.
  }
}

registerAuthCacheReset(resetTaskMaintenanceCooldown);

export function runTaskMaintenance(): Promise<void> {
  if (maintenancePromise) return maintenancePromise;
  const now = Date.now();
  const lastRun = readLastRunAt();
  if (lastRun > 0 && now - lastRun < TASK_MAINTENANCE_COOLDOWN_MS) {
    return Promise.resolve();
  }
  const current = Promise.all([
    supabase.rpc("dispatch_task_reminders"),
    supabase.rpc("materialize_due_task_templates"),
  ])
    .then((results) => {
      const failure = results.find((result) => result.error);
      if (failure?.error) throw new Error(failure.error.message);
      recordCompletedAt(Date.now());
    })
    .finally(() => {
      if (maintenancePromise === current) maintenancePromise = null;
    });
  maintenancePromise = current;
  return current;
}
