import { supabase } from '../../../../lib/supabase';
import { withSupabaseSessionRetry } from '../../../shared/supabaseSession';

export async function removeProjectOffice(target: { participationId?: string; identityId?: string }) {
  const result = await withSupabaseSessionRetry(() => supabase.rpc('phase65_remove_project_office', {
    p_participation: target.participationId || null,
    p_identity: target.identityId || null,
  }));
  if (result.error) throw result.error;
}
