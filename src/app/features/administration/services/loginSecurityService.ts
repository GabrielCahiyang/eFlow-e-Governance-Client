import { controlPanelFetch } from '../../../shared/controlPanelClient';

export interface LockedAccount {user_id:string; email:string; full_name:string; role:string; failed_attempts:number; locked_at:string; last_failed_at:string}
export interface LoginSecurity {max_attempts:number; accounts:LockedAccount[]}
async function request(path:string, init?:RequestInit) {
  const response = await controlPanelFetch('admin/login-security' + path, init, {retryOnEndpointChange:false});
  if (!response.ok) throw new Error(response.status === 403 ? 'Only Admin can manage account lockouts.' :
    'Could not finish this change. Refresh the list before retrying.');
  return response.json();
}
export const readLoginSecurity = ():Promise<LoginSecurity> => request('');
export const saveLoginAttemptLimit = (max_attempts:number) => request('', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({max_attempts})});
export const unlockLoginAccount = (userId:string) => request('/'+encodeURIComponent(userId)+'/unlock', {method:'POST'});
