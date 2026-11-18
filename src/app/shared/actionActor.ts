import { supabase } from '../../lib/supabase';

export async function assertActionActor(actor: string): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (!actor || error || data.session?.user.id !== actor) {
    throw new Error('Sign in with the original account to continue.');
  }
}
