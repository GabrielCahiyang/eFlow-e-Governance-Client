import type { Project } from '../services/types';
import { Button } from '../../../components/ui/button';
export function ProjectDraftList({projects,onOpen}:{projects:Project[];onOpen:(id:string)=>void}) {
  if (!projects.length) return null;
  return <section aria-label="Draft projects" className="mb-5 space-y-3">
    <h3 className="font-semibold">Project drafts ({projects.length})</h3>
    {projects.map(project=><article key={project.id} className="flex items-center justify-between gap-3 rounded-xl border bg-white p-4">
      <div><strong>{project.title}</strong><p className="text-sm text-neutral-600">Draft · Fill in the plan, then ask your Office Head to publish.</p></div>
      <Button variant="outline" onClick={()=>onOpen(project.id)}>Open draft</Button>
    </article>)}
  </section>;
}
