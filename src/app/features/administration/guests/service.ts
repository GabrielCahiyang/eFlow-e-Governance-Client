import { supabase } from '../../../../lib/supabase';
import type { ProjectGuest, GuestAccountEvent } from './types';

async function call<T>(name: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw new Error(error.code === 'PGRST202' ? 'Guest account management is not available yet. Ask Admin to check the database update.' : error.message);
  return data as T;
}
export const readProjectGuests = () => call<ProjectGuest[]>('admin_project_guests');
export const readGuestHistory = (id: string) => call<GuestAccountEvent[]>('admin_project_guest_history', {p_user: id});
export const changeGuestState = (id: string, active: boolean, reason: string, key: string) =>
  call<void>('admin_set_project_guest_state', {p_user: id, p_active: active, p_reason: reason, p_key: key});
