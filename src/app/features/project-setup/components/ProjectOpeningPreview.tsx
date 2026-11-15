import { WorkspaceIllustration, type WorkspaceIllustrationRow } from '../../../components/ui/WorkspaceIllustration';
import { summarizeProjectTaskTemplate, type ProjectTaskTemplate } from '../../work-templates';

/** Right-pane project preview; displays starter template metrics and sample tasks when chosen. */
export function ProjectOpeningPreview({
  title,
  selectedTemplate,
}: {
  title: string;
  selectedTemplate?: ProjectTaskTemplate;
}) {
  const summary = selectedTemplate ? summarizeProjectTaskTemplate(selectedTemplate.groups) : undefined;
  const previewRows: WorkspaceIllustrationRow[] | undefined = selectedTemplate
    ? selectedTemplate.groups.flatMap(group =>
        group.tasks.map(task => ({
          title: task.title,
          badge: group.title,
        })),
      )
    : undefined;

  return (
    <aside className="pf-wizard-opening-preview" aria-label="Project space preview">
      <div className="pf-preview-heading">
        <span className="pf-preview-label">
          <span />
          {selectedTemplate ? 'STARTER TEMPLATE PREVIEW' : 'YOUR PROJECT SPACE'}
        </span>
        <h3>{selectedTemplate ? selectedTemplate.name : 'From a plan to progress.'}</h3>
        {summary && (
          <div className="pf-preview-starter-meta">
            <span className="pf-preview-starter-tag">
              {summary.groupCount} {summary.groupCount === 1 ? 'group' : 'groups'}
            </span>
            <span className="pf-preview-starter-tag">
              {summary.taskCount} {summary.taskCount === 1 ? 'task' : 'tasks'}
            </span>
            {summary.subtaskCount > 0 && (
              <span className="pf-preview-starter-tag">
                {summary.subtaskCount} {summary.subtaskCount === 1 ? 'subtask' : 'subtasks'}
              </span>
            )}
          </div>
        )}
      </div>
      <WorkspaceIllustration title={title.trim() || 'Your next great project'} rows={previewRows} />
      <p className="pf-preview-caption">
        {summary && summary.groupNames.length
          ? `Includes groups: ${summary.groupNames.join(' · ')}`
          : 'Tasks, people and progress. Together in one place.'}
      </p>
    </aside>
  );
}
