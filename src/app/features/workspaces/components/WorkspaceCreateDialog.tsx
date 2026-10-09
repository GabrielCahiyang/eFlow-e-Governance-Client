import { useRef, useState } from 'react';
import { FeatureDialog } from '../../../components/ui/FeatureDialog';
import { FormField, SelectInput, TextInput } from '../../../components/ui/FormField';
import { requestNavigation, useNavigationBlocker } from '../../../shared/navigationGuard';

export function WorkspaceCreateDialog({ kind, context, owner, onClose, onCreate }: {
  kind: 'workspace' | 'project'; context: string; owner: string;
  onClose: () => void; onCreate: (request: string, name: string, timezone: string) => Promise<void>;
}) {
  const [name,setName]=useState(''),[timezone,setTimezone]=useState('Asia/Singapore');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const request=useRef(crypto.randomUUID()),pending=useRef(false);
  useNavigationBlocker({label:`Create personal ${kind}`,dirty:Boolean(name.trim()),pending:busy,identity:request.current,onDiscard:()=>{setName('');onClose();}});
  const close=()=>{if(!pending.current)void requestNavigation(onClose);};
  return <FeatureDialog title={`Create personal ${kind}`} onClose={close} preventClose={busy} contentClassName="r3-create-dialog">
    <form onSubmit={async event=>{
      event.preventDefault(); if(!name.trim()||pending.current)return;
      pending.current=true;setBusy(true);setError('');
      try { await onCreate(request.current,name.trim(),timezone);setName('');onClose(); }
      catch(error){setError(error instanceof Error?error.message:'Could not create. Retry keeps the same request identity.');}
      finally{pending.current=false;setBusy(false);}
    }}>
      <h2>Create personal {kind}</h2><p>{context} · Personal · Owner: {owner}</p>
      <p>Personal work uses its own review process. Office affiliation and financial permissions remain unchanged.</p>
      <FormField label={kind==='workspace'?'Workspace name':'Project name'} required><TextInput autoFocus value={name} maxLength={kind==='workspace'?120:200} disabled={busy} onChange={e=>setName(e.target.value)} /></FormField>
      {kind==='workspace'&&<FormField label="Workspace timezone"><SelectInput value={timezone} disabled={busy} onChange={e=>setTimezone(e.target.value)} options={['Asia/Singapore','Asia/Manila','Etc/UTC'].map(value=>({value,label:value}))} /></FormField>}
      {error&&<p role="alert">{error}</p>}
      <footer><button type="button" onClick={close} disabled={busy}>Cancel</button><button type="submit" className="pt-primary" disabled={busy||!name.trim()}>{busy?'Creating…':`Create ${kind}`}</button></footer>
    </form>
  </FeatureDialog>;
}
