import { readableUiError } from "../../../shared/userFacingError";
import { useRef, useState } from 'react';
import { BoundedTextInput } from '../../../components/ui/BoundedInput';
import { FeatureDialog } from '../../../components/ui/FeatureDialog';
import { FormField } from '../../../components/ui/FormField';
import { ActionBlockerGroup } from '../../../components/ui/action-blockers';
import { INPUT_LIMITS, textLengthError } from '../../../shared/inputLimits';
import { requestNavigation, useNavigationBlocker } from '../../../shared/navigationGuard';

export function WorkspaceCreateDialog({ kind, context, owner, onClose, onCreate }: {
  kind: 'workspace' | 'project'; context: string; owner: string;
  onClose: () => void; onCreate: (request: string, name: string, timezone: string) => Promise<void>;
}) {
  const [name,setName]=useState('');
  const [touched,setTouched]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const request=useRef(crypto.randomUUID()),pending=useRef(false);
  const fieldLabel=kind==='workspace'?'Workspace name':'Project name';
  const maxLength=kind==='workspace'?INPUT_LIMITS.GROUP_TITLE:INPUT_LIMITS.TITLE;
  const rawNameError=textLengthError(name,fieldLabel,{required:true,min:2,max:maxLength});
  const visibleNameError=touched||dirty?rawNameError:'';
  useNavigationBlocker({label:`Create personal ${kind}`,dirty:Boolean(name.trim()),pending:busy,identity:request.current,onDiscard:()=>{setName('');setTouched(false);setDirty(false);onClose();}});
  const close=()=>{if(!pending.current)void requestNavigation(onClose);};
  return <FeatureDialog title={`Create personal ${kind}`} onClose={close} preventClose={busy} contentClassName="r3-create-dialog">
    <form noValidate onSubmit={async event=>{
      event.preventDefault();
      setTouched(true);
      if(rawNameError||pending.current)return;
      pending.current=true;setBusy(true);setError('');
      try { await onCreate(request.current,name.trim(),'Asia/Manila');setName('');setTouched(false);setDirty(false);onClose(); }
      catch(error){setError(readableUiError(error, "We couldn't confirm whether it was created. Keep this form open and try again here; don't start another creation form.", "write"));}
      finally{pending.current=false;setBusy(false);}
    }}>
      <h2>Create personal {kind}</h2><p>{context} · Personal · Owner: {owner}</p>
      <p>Personal work uses its own review process. Office affiliation and financial permissions remain unchanged.</p>
      <FormField label={fieldLabel} required>
        <BoundedTextInput
          autoFocus
          value={name}
          maxLength={maxLength}
          disabled={busy}
          error={visibleNameError || undefined}
          onBlur={()=>setTouched(true)}
          onChange={e=>{setDirty(true);if(error)setError('');setName(e.target.value);}}
          className="eflow-form-input h-10 w-full rounded-lg border border-border bg-input-background px-3 text-[13px] font-normal text-foreground placeholder:text-muted-foreground outline-none transition-all hover:border-neutral-400 focus:border-ring focus:ring-2 focus:ring-ring/15"
        />
      </FormField>
      {error&&!visibleNameError&&<p role="alert">{error}</p>}
      <footer>
        <button type="button" onClick={close} disabled={busy}>Cancel</button>
        <ActionBlockerGroup actionLabel={`Create ${kind}`} blockers={rawNameError} busy={busy}>
          <button type="submit" className="pt-primary" disabled={busy||Boolean(rawNameError)}>{busy?'Creating…':`Create ${kind}`}</button>
        </ActionBlockerGroup>
      </footer>
    </form>
  </FeatureDialog>;
}
