import { useCallback, useEffect, useRef, useState } from 'react';
import { LockKeyhole, RefreshCw, Unlock } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { isAdminRole } from '../../../../shared/roles';
import { useConfirmation } from '../../../../components/ui/useConfirmation';
import { Button } from '../../../../components/ui/button';
import { DataTable, type Column } from '../../../../components/ui/DataTable';
import { FeedbackState } from '../../../../components/ui/FeedbackState';
import { readLoginSecurity, saveLoginAttemptLimit, unlockLoginAccount, type LockedAccount, type LoginSecurity } from '../../services/loginSecurityService';
import { useExplicitDraft } from '../../../../shared/useExplicitDraft';
import { requestNavigation } from '../../../../shared/navigationGuard';

export function LockedAccountsTab() {
  const {userProfile} = useAuth(), admin = isAdminRole(userProfile?.role);
  const [data,setData] = useState<LoginSecurity|null>(null), [limit,setLimit] = useState('');
  const [loading,setLoading] = useState(true), [busy,setBusy] = useState(false), [error,setError] = useState(''), [notice,setNotice] = useState('');
  const pending = useRef(false), version = useRef(0), confirmation = useConfirmation();
  const current = useRef({data,limit}); current.current = {data,limit};
  const actor = useRef(userProfile?.id); actor.current = userProfile?.id;
  const draft = useExplicitDraft('Account lockout settings', Boolean(data && limit !== String(data.max_attempts)), busy, () => setLimit(String(data?.max_attempts || '')), userProfile?.id);
  const refresh = useCallback(async (preserveDraft = true) => {
    if (!admin) return;
    const request = ++version.current;
    try {
      const result = await readLoginSecurity();
      if (version.current !== request) return;
      const edited = current.current.data && current.current.limit !== String(current.current.data.max_attempts);
      setData(result); setLimit(preserveDraft && edited ? current.current.limit : String(result.max_attempts)); setError('');
    } catch { if (version.current === request) setError('Could not load account security. Please refresh.'); }
    finally { if (version.current === request) setLoading(false); }
  },[admin,userProfile?.id]);
  useEffect(() => {
    current.current = {data:null,limit:''};
    pending.current=false; draft.pendingRef.current=false;
    setData(null); setLimit(''); setBusy(false); setLoading(true); setError(''); setNotice('');
    void refresh(false);
    return () => { ++version.current; };
  },[refresh]);
  async function change(operation:()=>Promise<unknown>, message:string, settings = false) {
    if (pending.current) return;
    const initiatedBy = actor.current;
    pending.current=true; draft.pendingRef.current=true; setBusy(true); setError(''); setNotice('');
    try {
      await operation();
      if (actor.current !== initiatedBy) return;
      if (settings) {
        setData(previous => previous ? {...previous,max_attempts:Number(limit)} : previous);
        draft.markClean();
      }
      setNotice(message); await refresh(!settings);
    }
    catch (reason) { if(actor.current === initiatedBy) setError(reason instanceof Error ? reason.message : 'Could not save this change.'); }
    finally { if(actor.current === initiatedBy) { pending.current=false; draft.pendingRef.current=false; setBusy(false); } }
  }
  async function unlock(account:LockedAccount) {
    if (pending.current || !admin) return;
    if (!await confirmation.confirm({title:'Unlock account?', description:`Allow ${account.full_name || account.email} to sign in again? Their failed-attempt count resets to zero.`,actionLabel:'Unlock account'})) return;
    await change(()=>unlockLoginAccount(account.user_id), 'Account unlocked. They can sign in again.');
  }
  const columns:Column<LockedAccount>[] = [
    {key:'full_name',header:'Account',render:a=><div><strong className="text-[var(--eflow-text)]">{a.full_name}</strong><p className="text-xs text-[var(--eflow-text-muted)]">{a.email}</p></div>},
    {key:'role',header:'Role',render:a=>a.role},
    {key:'failed_attempts',header:'Failed attempts',render:a=><span className="eflow-tabular">{a.failed_attempts}</span>},
    {key:'locked_at',header:'Locked at',render:a=><span className="eflow-tabular">{new Date(a.locked_at).toLocaleString()}</span>},
    {key:'actions',header:'Actions',render:a=><Button variant="outline" size="sm" disabled={busy} onClick={()=>void unlock(a)}><Unlock size={13} aria-hidden="true" />Unlock account</Button>},
  ];
  if (!admin) return <p className="text-sm text-[var(--eflow-text-muted)]">Only Admin can view and unlock locked accounts.</p>;
  return <section aria-label="Locked out accounts" className="space-y-5">
    <form className="eflow-admin-card space-y-4" onSubmit={event=>{event.preventDefault(); const value=Number(limit); if(Number.isInteger(value)&&value>=1&&value<=20) void change(()=>saveLoginAttemptLimit(value),'Attempt limit saved.',true);}}>
      <div className="eflow-admin-card__title-row">
        <span className="eflow-admin-icon-chip" aria-hidden="true"><LockKeyhole size={16} /></span>
        <div>
          <h2>Sign-in lockout rules</h2>
          <p className="eflow-admin-copy">Protect accounts by locking sign-in after repeated wrong passwords. Successful sign-in resets the counter; changing this limit does not unlock already locked accounts.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1.5 text-sm font-medium text-[var(--eflow-text)]">
          Failed attempts before lockout
          <input aria-label="Failed attempts before lockout" type="number" min="1" max="20" step="1" required value={limit} disabled={busy||!data} onChange={e=>setLimit(e.target.value)} className="h-10 w-28 rounded-lg border border-[var(--eflow-border)] px-3 text-sm"/>
        </label>
        <Button type="submit" disabled={busy||!data||Number(limit)===data.max_attempts}>Save attempt limit</Button>
      </div>
      <p className="text-xs text-[var(--eflow-text-muted)]">Default: 3 attempts (allowed range 1–20).</p>
    </form>
    {notice&&<FeedbackState tone="success" title="Saved">{notice}</FeedbackState>}
    {error&&<FeedbackState tone="error" title="Could not update lockout security">{error}</FeedbackState>}
    <div className="eflow-admin-subsection-header items-center">
      <div>
        <h2 className="text-base font-semibold text-[var(--eflow-text)]">Locked out accounts (<span className="eflow-tabular">{data?.accounts.length ?? 0}</span>)</h2>
        <p className="eflow-admin-copy">Accounts locked due to repeated failed password attempts.</p>
      </div>
      <Button variant="outline" disabled={busy||loading} onClick={()=>void requestNavigation(()=>void refresh(false))}>
        <RefreshCw size={13} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
        Refresh locked accounts
      </Button>
    </div>
    <DataTable columns={columns} data={data?.accounts || []} loading={loading} error={!data&&error?error:undefined} onRetry={()=>void refresh()} ariaLabel="Locked out accounts table" keyExtractor={a=>a.user_id} emptyIllustration="complete" emptyMessage="No locked out accounts."/>
    {confirmation.dialog}
  </section>;
}
