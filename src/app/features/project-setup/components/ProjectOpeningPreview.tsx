import {WorkspaceIllustration} from '../../../components/ui/WorkspaceIllustration';

/** Decorative preview; the project title is the only draft value displayed. */
export function ProjectOpeningPreview({title}:{title:string}){
 return <aside className="pf-wizard-opening-preview" aria-hidden="true">
  <div className="pf-preview-heading">
   <span className="pf-preview-label"><span/>YOUR PROJECT SPACE</span>
   <h3>From a plan to progress.</h3>
  </div>
  <WorkspaceIllustration title={title.trim()||'Your next great project'}/>
  <p className="pf-preview-caption">Tasks, people and progress. Together in one place.</p>
 </aside>;
}
