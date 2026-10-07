import { Button } from '../../../components/ui/button';
import type { ProjectReadiness } from '../types';
export function DraftPublicationAction({readiness,busy,onPublish}:{readiness:ProjectReadiness;busy:boolean;onPublish:()=>void}) {
  const missing=readiness.checks.filter(check=>!check.ok);
  return <section aria-label="Publish draft" className="p7-actions">
    {missing.length ? <div><h3>Cannot publish yet</h3><ul>{missing.map(check=><li key={check.key}>{check.label}: {check.detail}</li>)}</ul><p>Use the buttons above to fix each item.</p></div> : <p>Required details and current reviews are complete.</p>}
    {readiness.canPublish ? <Button disabled={busy||!readiness.canActivate} onClick={onPublish}>Publish project</Button> : <p>Only the owning Office’s Head can publish this project.</p>}
    <p>Until published, this project remains in Drafts—not Open Projects.</p>
  </section>;
}
