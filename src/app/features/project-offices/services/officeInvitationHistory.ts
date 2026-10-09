import { supabase } from '../../../../lib/supabase';
import { withSupabaseSessionRetry } from '../../../shared/supabaseSession';
import type { Invitation } from '../../invitations';

// Explicit column grants and the existing Office-Head RLS policy protect this
// read. Tokens, acceptance claims and private invitation links stay server-side.
const fields = 'id,email,account_role,invitation_type,project_office_id,project_office_identity_id,status,expires_at,accepted_at,revoked_at,last_sent_at,send_count,email_delivery_status,created_at';

export async function readOfficeInvitationHistory(projectId: string, kind: 'project_office' | 'project_office_identity') {
  const table = kind === 'project_office' ? 'project_offices' : 'project_office_identities';
  const column = kind === 'project_office' ? 'project_office_id' : 'project_office_identity_id';
  const targets = await withSupabaseSessionRetry(() => supabase.from(table).select('id').eq('project_id', projectId));
  if (targets.error) throw targets.error;
  if (!targets.data?.length) return { invitations: [] as Invitation[] };
  const result = await withSupabaseSessionRetry(() => supabase.from('user_invitations').select(fields)
    .eq('invitation_type', kind).in(column, targets.data.map(row => row.id)).order('created_at', { ascending: false }).limit(250));
  if (result.error) throw result.error;
  const invitations = (result.data || []).map(row => ({ ...row,
    status: row.status === 'pending' && Date.parse(row.expires_at) <= Date.now() ? 'expired' : row.status,
  })) as Invitation[];
  return { invitations };
}
