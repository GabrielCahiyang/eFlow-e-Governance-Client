import type { ProjectCommandTab } from './types';
import { Button as VibeButton } from '@vibe/core';
import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Share2, Star } from 'lucide-react';
import { ActionMenu, WorkspaceTooltip, type WorkspaceAction } from '../../../../components/ui/workspace';
import { Button } from '../../../../components/ui/button';
import { FeedbackState } from '../../../../components/ui/FeedbackState';
import { Modal } from '../../../../components/ui/Modal';
import { useToast } from '../../../../components/ui/Toast';
import {ProjectSetupDialog} from './ProjectSetupDialog';
import {ProjectAccessPanel} from '../../../project-access';
import { fetchProjectGroups, tasksInGroup } from '../../../project-table';
import type { Subtask } from '../../../subtasks';
import type { Task } from '../../../tasks';
import {
  saveProjectTaskTemplate,
  summarizeProjectTaskTemplate,
  type ProjectTaskGroup,
} from '../../../work-templates';
import { requestNavigation } from '../../../../shared/navigationGuard';
import { useNavigationFavorites } from '../../../../shared/navigationPreferences';
import type { Project } from '../../services/types';
import { useProjectCompletionAvailability } from '../../hooks/useProjectCompletionAvailability';
import {ProjectPublicationAction} from '../../../project-publication';

export interface ProjectLifecycleActions { complete?: () => void; archive?: () => void; restore?: () => void; delete?: () => void; }
export function ProjectUtilities({ setupReady=true, project, canManage, lifecycle, userId, contextId, authorizedProjectIds, view, tasks = [], subtasks = [], onOpenOffices, onOpenSettings, onResolveView }: {
  setupReady?:boolean;project: Project; canManage: boolean; lifecycle: ProjectLifecycleActions; userId: string; contextId: string; authorizedProjectIds: string[]; view: string; tasks?: Task[]; subtasks?: Subtask[]; onOpenOffices: () => void; onOpenSettings: () => void; onResolveView: (view:ProjectCommandTab) => void;
}) {
  const { toast } = useToast();
  const [shareOpen, setShareOpen] = useState(false),[copyNotice,setCopyNotice]=useState(''),[setupOpen,setSetupOpen]=useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateGroups, setTemplateGroups] = useState<ProjectTaskGroup[]>([]);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateError, setTemplateError] = useState('');
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const visibleTasks = tasks.filter(task => !task.archivedAt);
  const canSaveTemplate = canManage && setupReady && visibleTasks.length > 0;

  useEffect(() => {
    if (!saveTemplateOpen) return;
    let live = true;
    setTemplateBusy(true);
    setTemplateError('');
    setTemplateName(`${project.title} starter`.slice(0, 120));
    void fetchProjectGroups(project.id)
      .then(groups => {
        if (!live) return;
        const subtaskTitlesForTask = (taskId: string) =>
          subtasks.filter(sub => sub.taskId === taskId && !sub.parentSubtaskId).map(sub => sub.title);
        const built: ProjectTaskGroup[] = groups
          .map(group => ({
            title: group.title,
            tasks: tasksInGroup(visibleTasks, group).map(task => ({
              title: task.title,
              subtasks: subtaskTitlesForTask(task.id),
            })),
          }))
          .filter(group => group.tasks.length > 0);
        setTemplateGroups(
          built.length
            ? built
            : [{ title: 'Project Tasks', tasks: visibleTasks.map(task => ({ title: task.title, subtasks: subtaskTitlesForTask(task.id) })) }],
        );
      })
      .catch(reason => {
        if (live) setTemplateError(reason instanceof Error ? reason.message : 'Could not load project task groups.');
      })
      .finally(() => {
        if (live) setTemplateBusy(false);
      });
    return () => {
      live = false;
    };
  }, [saveTemplateOpen, project.id, project.title]);
  const completion = useProjectCompletionAvailability(project, canManage && Boolean(lifecycle.complete), `${userId}:${contextId}`);
  const openLifecycle = (action: () => void) => requestAnimationFrame(() => {
    // Let the menu close before the existing dialog captures its focus-return target.
    if (!menuTrigger.current) return;
    menuTrigger.current.focus(); action();
  });
  const { favorites, toggle } = useNavigationFavorites(userId, contextId, authorizedProjectIds);
  const favorite = favorites.has(project.id);
  const actions: WorkspaceAction[] = [{ id: 'settings', label: 'Project settings', onSelect: onOpenSettings }];
  actions.push({id:'offices',label:'Project Offices',onSelect:onOpenOffices});
  if (canSaveTemplate) {
    actions.push({
      id: 'save-starter-template',
      label: 'Save as starter template',
      onSelect: () => openLifecycle(() => setSaveTemplateOpen(true)),
    });
  }
  if (lifecycle.complete && !['completed','archived'].includes(project.status)) {
    actions.push({ id: 'requirements', label: 'View completion requirements', onSelect: () => openLifecycle(lifecycle.complete!) });
    actions.push({ id: 'complete', label: 'Mark project complete', disabled: !completion.enabled, disabledReason: completion.reason, onSelect: () => {if(completion.enabled)openLifecycle(lifecycle.complete!);} });
  }
  if (lifecycle.archive && project.status !== 'archived') actions.push({ id: 'archive', label: 'Archive project', disabled: project.status !== 'completed', disabledReason: 'Complete this project before archiving it.', onSelect: () => openLifecycle(lifecycle.archive!) });
  if (lifecycle.restore && project.status === 'archived') actions.push({ id: 'restore', label: 'Restore project', onSelect: () => openLifecycle(lifecycle.restore!) });
  if (project.publicationState==='draft'&&lifecycle.delete) actions.push({ id: 'delete', label: 'Discard project draft', onSelect: () => openLifecycle(lifecycle.delete!) });
  return <div className="eflow-project-identity__utilities">
    {userId && <WorkspaceTooltip content="Personal favorite on this device"><Button variant="ghost" size="icon" aria-label={favorite ? 'Remove project from favorites' : 'Add project to favorites'} aria-pressed={favorite} onClick={() => toggle(project.id)}><Star size={18} fill={favorite ? 'currentColor' : 'none'} /></Button></WorkspaceTooltip>}
    <Button disabled={!setupReady||project.publicationState==='draft'} title={project.publicationState==='draft'?'Activate the project before sharing access.':!setupReady?'Finish project details and funding before sharing access.':undefined} variant="outline" onClick={() => { setShareOpen(true); }}><Share2 size={16} />Invite / share</Button>
    <Button variant="outline" onClick={onOpenSettings}>Project settings</Button>
    <ProjectPublicationAction projectId={project.id} title={project.title} status={project.status} officeId={project.orgId}/>
    {canManage && lifecycle.complete && !['completed','archived'].includes(project.status) && <Button variant="outline" onClick={() => { void requestNavigation(lifecycle.complete!); }}>Completion requirements</Button>}
    {canManage&&['planning','on_hold'].includes(project.status)&&<Button variant="outline" onClick={()=>void requestNavigation(()=>setSetupOpen(value=>!value))} aria-expanded={setupOpen}>Setup & activation</Button>}
    <ActionMenu tooltip="Project actions" trigger={<Button ref={menuTrigger} variant="outline" size="icon" aria-label="Project actions"><MoreHorizontal size={20} /></Button>} actions={actions} />
    {setupOpen&&['planning','on_hold'].includes(project.status)&&<ProjectSetupDialog project={project} canManage={canManage} onClose={()=>setSetupOpen(false)} onOpenSettings={onOpenSettings} onOpenOffices={onOpenOffices} onResolve={onResolveView}/>}
    {shareOpen && <Modal isOpen title="Share project" description={project.title} width="max-w-3xl" onClose={() => void requestNavigation(() => setShareOpen(false))}>
      <ProjectAccessPanel project={project.id}/>
      <p>Ordinary navigation links require existing access and grant no permissions.</p><label>Project navigation link<input readOnly value={new URL(`/projects?page=Projects&project=${encodeURIComponent(project.id)}&view=${encodeURIComponent(view)}`,window.location.origin).href}/></label><Button onClick={()=>{const url=new URL(`/projects?page=Projects&project=${encodeURIComponent(project.id)}&view=${encodeURIComponent(view)}`,window.location.origin).href;void navigator.clipboard.writeText(url).then(()=>setCopyNotice('Navigation link copied.')).catch(()=>setCopyNotice('Select and copy the navigation link.'));}}>Copy navigation link</Button>{copyNotice&&<p role="status">{copyNotice}</p>}
    </Modal>}
    {saveTemplateOpen && (
      <Modal
        isOpen
        title="Save as starter template"
        description={`Reuse task groups, tasks, and subtasks from “${project.title}”.`}
        width="max-w-lg"
        onClose={() => {
          if (!templateBusy) setSaveTemplateOpen(false);
        }}
      >
        <form
          className="grid gap-4"
          onSubmit={event => {
            event.preventDefault();
            if (templateBusy || !templateGroups.length) return;
            setTemplateBusy(true);
            setTemplateError('');
            void saveProjectTaskTemplate(templateName, templateGroups)
              .then(saved => {
                toast(`Starter template “${saved.name}” saved.`, 'success');
                setSaveTemplateOpen(false);
              })
              .catch(reason => {
                setTemplateError(reason instanceof Error ? reason.message : 'Could not save starter template.');
              })
              .finally(() => setTemplateBusy(false));
          }}
        >
          {templateError && (
            <FeedbackState tone="error" title="Could not save starter template">
              {templateError}
            </FeedbackState>
          )}
          <label className="grid gap-1.5 text-sm font-medium text-neutral-800">
            Template name
            <input
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-normal"
              required
              maxLength={120}
              disabled={templateBusy}
              value={templateName}
              onChange={event => setTemplateName(event.target.value)}
            />
          </label>
          {templateBusy && !templateGroups.length ? (
            <p role="status" className="text-xs text-neutral-500">Reading project groups and tasks…</p>
          ) : (
            (() => {
              const summary = summarizeProjectTaskTemplate(templateGroups);
              return (
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-[5px] border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700">
                    {summary.groupCount} {summary.groupCount === 1 ? 'group' : 'groups'}
                  </span>
                  <span className="rounded-[5px] border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700">
                    {summary.taskCount} {summary.taskCount === 1 ? 'task' : 'tasks'}
                  </span>
                  <span className="rounded-[5px] border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700">
                    {summary.subtaskCount} {summary.subtaskCount === 1 ? 'subtask' : 'subtasks'}
                  </span>
                </div>
              );
            })()
          )}
          <div className="flex justify-end gap-2 pt-2">
            <VibeButton
              type="button"
              kind="tertiary"
              size="small"
              disabled={templateBusy}
              onClick={() => setSaveTemplateOpen(false)}
            >
              Cancel
            </VibeButton>
            <VibeButton
              type="submit"
              kind="primary"
              size="small"
              disabled={templateBusy || !templateName.trim() || !templateGroups.length}
            >
              {templateBusy ? 'Saving…' : 'Save starter template'}
            </VibeButton>
          </div>
        </form>
      </Modal>
    )}
  </div>;
}
