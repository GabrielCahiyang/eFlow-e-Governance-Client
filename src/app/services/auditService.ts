// ─── eFlow Audit Service (Supabase) ──────────────────────────────
// Append-only audit trail. Every state-changing workflow action should write
// exactly one event here with actor, time, entity, action, and outcome.
//
// audit_events is append-only at the database level: there is an INSERT policy
// but deliberately no UPDATE/DELETE policy, so no normal client can rewrite
// history. Reads are scoped by RLS (admin, own actions, or own subtree).

import { supabase } from '../../lib/supabase';

export interface AuditEvent {
  id: string;
  actorId?: string;
  actorName: string;
  entityType: string;
  entityId?: string;
  action: string;
  reason?: string;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: Record<string, unknown>;
  orgId?: string;
  createdAt: number;
}

export interface RecordAuditInput {
  entityType: string;
  entityId?: string;
  action: string;
  reason?: string;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: Record<string, unknown>;
  orgId?: string | null;
}

function rowToEvent(row: Record<string, unknown>): AuditEvent {
  return {
    id: row.id as string,
    actorId: (row.actor_id as string) || undefined,
    actorName: (row.actor_name as string) || 'System',
    entityType: (row.entity_type as string) || '',
    entityId: (row.entity_id as string) || undefined,
    action: (row.action as string) || '',
    reason: (row.reason as string) || undefined,
    beforeData: row.before_data ?? undefined,
    afterData: row.after_data ?? undefined,
    metadata: (row.metadata as Record<string, unknown>) || undefined,
    orgId: (row.org_id as string) || undefined,
    createdAt: new Date((row.created_at as string) || Date.now()).getTime(),
  };
}

// ─── recordAudit ─────────────────────────────────────────────────
// Uses the authenticated actor identity (never a client-supplied user id).
// Fire-and-forget safe: failures are logged, never thrown into the workflow
// action that triggered them.
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    let actorName = 'System';
    let orgId = input.orgId ?? null;
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, org_id')
        .eq('id', user.id)
        .maybeSingle();
      actorName = (profile?.full_name as string) || user.email || 'User';
      if (orgId === null) orgId = (profile?.org_id as string) || null;
    }

    await supabase.from('audit_events').insert({
      actor_id: user?.id || null,
      actor_name: actorName,
      entity_type: input.entityType,
      entity_id: input.entityId || null,
      action: input.action,
      reason: input.reason || null,
      before_data: input.beforeData ?? null,
      after_data: input.afterData ?? null,
      metadata: input.metadata ?? null,
      org_id: orgId,
    });
  } catch (err) {
    console.error('Failed to record audit event:', err);
  }
}

export interface AuditFilter {
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  orgId?: string;
  from?: string; // ISO date
  to?: string;   // ISO date
  limit?: number;
}

export async function fetchAuditEvents(filter: AuditFilter = {}): Promise<AuditEvent[]> {
  let query = supabase
    .from('audit_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 200);

  if (filter.actorId) query = query.eq('actor_id', filter.actorId);
  if (filter.action) query = query.eq('action', filter.action);
  if (filter.entityType) query = query.eq('entity_type', filter.entityType);
  if (filter.entityId) query = query.eq('entity_id', filter.entityId);
  if (filter.orgId) query = query.eq('org_id', filter.orgId);
  if (filter.from) query = query.gte('created_at', filter.from);
  if (filter.to) query = query.lte('created_at', filter.to);

  const { data, error } = await query;
  if (error) {
    console.error('Failed to fetch audit events:', error);
    return [];
  }
  return (data || []).map(rowToEvent);
}

export function subscribeToAuditEvents(
  callback: (events: AuditEvent[]) => void,
  filter: AuditFilter = {},
): () => void {
  const load = () => fetchAuditEvents(filter).then(callback);
  load();

  const channelId = `audit-${Math.random().toString(36).slice(2)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_events' }, () => load())
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// ─── Redaction ───────────────────────────────────────────────────
// Field-by-field diff helper that hides sensitive keys in the detail drawer.
const SENSITIVE_KEYS = /pass(word)?|token|secret|api[_-]?key|ssn|tin|credential/i;

export function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.test(key)) return '••••••••';
  return value;
}

export interface DiffRow {
  key: string;
  before: unknown;
  after: unknown;
  changed: boolean;
}

export function buildDiff(before: unknown, after: unknown): DiffRow[] {
  const b = (before && typeof before === 'object' ? before : {}) as Record<string, unknown>;
  const a = (after && typeof after === 'object' ? after : {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)])).sort();
  return keys.map((key) => {
    const bv = redactValue(key, b[key]);
    const av = redactValue(key, a[key]);
    return { key, before: bv, after: av, changed: JSON.stringify(bv) !== JSON.stringify(av) };
  });
}
