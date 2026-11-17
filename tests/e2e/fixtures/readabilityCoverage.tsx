import '@vibe/core/tokens';
import '@fontsource-variable/figtree/wght.css';
import '../../../src/styles/index.css';
import '../../../src/app/features/project-setup/projectSetup.css';
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { FlowError } from '../../../src/app/features/project-setup/components/FlowError';
import { ErrorState } from '../../../src/app/components/workflow/primitives';
import { readableUiError } from '../../../src/app/shared/userFacingError';
import { EflowVibeThemeProvider } from '../../../src/app/shared/vibe/EflowVibeProvider';

function Proof() {
  const [kind,setKind] = useState<'network'|'setup'|'rule'>('network');
  const [retry,setRetry] = useState(0),[dark,setDark]=useState(false);
  useEffect(()=>{document.documentElement.classList.toggle('dark',dark);},[dark]);
  const reason=kind==='network'?new TypeError('Failed to fetch'):kind==='setup'?{code:'PGRST202',message:'RPC private_project_save not found in schema cache'}:new Error('A subtask\'s due date must be on or before its task\'s due date.');
  return <EflowVibeThemeProvider preference={dark?'dark':'light'}><main style={{padding:24,minHeight:'100dvh',background:'var(--eflow-canvas)',color:'var(--eflow-text)'}}>
    <h1>Readability coverage</h1><div style={{display:'flex',flexWrap:'wrap',gap:16,marginBlock:20}}>
      <button onClick={()=>setKind('network')}>Connection interrupted</button><button onClick={()=>setKind('setup')}>Feature unavailable</button><button onClick={()=>setKind('rule')}>Date rule</button><button onClick={()=>setDark(!dark)}>Switch theme</button>
    </div>
    <section aria-label="Project setup error" style={{maxWidth:760}}><FlowError error={readableUiError(reason,"We couldn't confirm whether the project was created. Keep this setup open and try again here; don't start another project.")}/></section>
    <section aria-label="Loading error"><ErrorState onRetry={()=>setRetry(retry+1)}/></section>
    <output aria-label="Reload attempts">{retry}</output>
  </main></EflowVibeThemeProvider>;
}
createRoot(document.getElementById('root')!).render(<Proof/>);
