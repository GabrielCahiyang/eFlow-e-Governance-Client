import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { isAdminRole } from '../../../../shared/roles';
import { useConfirmation } from '../../../../components/ui/useConfirmation';
import { Button } from '../../../../components/ui/button';
import { DataTable, type Column } from '../../../../components/ui/DataTable';
import { readLoginSecurity, saveLoginAttemptLimit, unlockLoginAccount, type LockedAccount, type LoginSecurity } from '../../services/loginSecurityService';

export function LockedAccountsTab() {
  const {userProfile} = useAuth(), admin = isAdminRole(userProfile?.role);
  const [data,setData] = useState<LoginSecurity|null>(null), [limit,setLimit] = useState('');
  const [loading,setLoading] = useState(true), [busy,setBusy] = useState(false), [error,setError] = useState(''), [notice,setNotice] = useState('');
  const pending = useRef(false), version = useRef(0), confirmation = useConfirmation();
  const refresh = useCallback(async () => {
    if (!admin) return;
    const request = ++version.current;
    try {
      const result = await readLoginSecurity();
      if (version.current !== request) return;
      setData(result); setLimit(String(result.max_attempts)); setError('');
    } catch { if (version.current === request) setError('Could not load account security. Please refresh.'); }
    finally { if (version.current === request) setLoading(false); }
  },[admin,userProfile?.id]);
  useEffect(() => { setData(null); setLoading(true); void refresh(); return () => { ++version.current; }; },[refresh]);
  async function change(operation:()=>Promise<unknown>, message:string) {
    if (pending.current) return;
    pending.current=true; setBusy(true); setError(''); setNotice('');
    try { await operation(); setNotice(message); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save this change.'); }
    finally { pending.current=false; setBusy(false); }
  }
  async function unlock(account:LockedAccount) {
    if (pending.current || !admin) return;
    if (!await confirmation.confirm({title:'Unlock account?', description:`Allow ${account.full_name || account.email} to sign in again? Their failed-attempt count will reset to zero.`,actionLabel:'Unlock account'})) return;
    await change(()=>unlockLoginAccount(account.user_id), 'Account unlocked. They can sign in again.');
  }
  const columns:Column<LockedAccount>[] = [
    {key:'full_name',header:'Account',render:a=><div><strong>{a.full_name}</strong><p>{a.email}</p></div>},
    {key:'role',header:'Role',render:a=>a.role},
    {key:'failed_attempts',header:'Failed attempts',render:a=>a.failed_attempts},
    {key:'locked_at',header:'Locked at',render:a=>new Date(a.locked_at).toLocaleString()},
    {key:'actions',header:'Actions',render:a=><Button variant="outline" disabled={busy} onClick={()=>void unlock(a)}>Unlock account</Button>},
  ];
  if (!admin) return <p>Only Admin can view and unlock locked accounts.</p>;
  return <section aria-label="Locked out accounts" className="space-y-5">
    <form className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3" onSubmit={event=>{event.preventDefault(); const value=Number(limit); if(Number.isInteger(value)&&value>=1&&value<=20) void change(()=>saveLoginAttemptLimit(value),'Attempt limit saved.');}}>
      <h2 className="font-semibold">Account lockout settings</h2>
      <label className="flex flex-wrap items-center gap-3">Failed attempts before lockout<input aria-label="Failed attempts before lockout" type="number" min="1" max="20" step="1" required value={limit} disabled={busy||!data} onChange={e=>setLimit(e.target.value)} className="w-24 rounded-md border border-neutral-300 px-3 py-2"/></label>
      <p className="text-sm text-neutral-600">Default: 3. Choose 1–20. Successful sign-in resets the count. Locked accounts stay locked until an Admin unlocks them. Changing the limit does not unlock existing accounts.</p>
      <Button type="submit" disabled={busy||!data||Number(limit)===data.max_attempts}>Save attempt limit</Button>
    </form>
    {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
    <div className="flex items-center justify-between"><h2 className="font-semibold">Locked out accounts ({data?.accounts.length ?? 0})</h2><Button variant="outline" disabled={busy||loading} onClick={()=>void refresh()}>Refresh locked accounts</Button></div>
    <DataTable columns={columns} data={data?.accounts || []} loading={loading} error={!data&&error?error:undefined} onRetry={()=>void refresh()} ariaLabel="Locked out accounts table" keyExtractor={a=>a.user_id} emptyMessage="No locked out accounts."/>
    {confirmation.dialog}
  </section>;
}
