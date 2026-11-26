import { readableUiError } from '../../../../shared/userFacingError';
import type { ProjectCommandTab } from './types';
import { Button as VibeButton } from '@vibe/core';
import { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal, Star } from 'lucide-react';
import { ActionBlockerGroup, type ActionBlockerItem } from '../../../../components/ui/action-blockers';
import { ActionMenu, WorkspaceTooltip, type WorkspaceAction } from '../../../../components/ui/workspace';
import { BoundedTextInput } from '../../../../components/ui/BoundedInput';
import { Button } from '../../../../components/ui/button';
import { FeedbackState } from '../../../../components/ui/FeedbackState';
import { Modal } from '../../../../components/ui/Modal';
import { useToast } from '../../../../components/ui/Toast';
import { INPUT_LIMITS, textLengthError } from '../../../../shared/inputLimits';
import {ProjectSetupDialog} from './ProjectSetupDialog';
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
export function ProjectUtilities({ setupReady=true, project, canManage, lifecycle, userId, contextId, authorizedProjectIds, view: _view, tasks = [], subtasks = [], onOpenOffices, onOpenSettings, onResolveView }: {
  setupReady?:boolean;project: Project; canManage: boolean; lifecycle: ProjectLifecycleActions; userId: string; contextId: string; authorizedProjectIds: string[]; view: string; tasks?: Task[]; subtasks?: Subtask[]; onOpenOffices: () => void; onOpenSettings: () => void; onResolveView: (view:ProjectCommandTab) => void;
}) {
  const { toast } = useToast();
  const [setupOpen,setSetupOpen]=useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateNameTouched, setTemplateNameTouched] = useState(false);
  const [templateGroups, setTemplateGroups] = useState<ProjectTaskGroup[]>([]);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateError, setTemplateError] = useState('');
  const templateNameId = useId();
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const visibleTasks = tasks.filter(task => !task.archivedAt);
  const canSaveTemplate = canManage && setupReady && visibleTasks.length > 0;
  const templateNameError = textLengthError(templateName, 'Template name', {
    required: true,
    max: INPUT_LIMITS.GROUP_TITLE,
  });
  const visibleTemplateNameError = templateNameTouched ? templateNameError : '';
  const saveTemplateDisabled = templateBusy || Boolean(templateNameError) || !templateGroups.length;
  const saveTemplateTip = templateBusy
    ? ''
    : templateNameError
      ? templateNameError
      : !templateGroups.length
        ? 'No project tasks are available to save in this starter template.'
        : '';

  useEffect(() => {
    if (!saveTemplateOpen) return;
    let live = true;
    setTemplateBusy(true);
    setTemplateError('');
    setTemplateNameTouched(false);
    setTemplateName(`${project.title} starter`.slice(0, INPUT_LIMITS.GROUP_TITLE));
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
        if (live) setTemplateError(readableUiError(reason, "Could not load project task groups.", 'read'));
      })
      .finally(() => {
        if (live) setTemplateBusy(false);
      });
    return () => {
      live = false;
    };
  }, [saveTemplateOpen, project.id, project.title]);
  const isNonHeadProjectLead = Boolean(!canManage && userId && project.projectLeadId === userId);
  const completion = useProjectCompletionAvailability(project, (canManage || isNonHeadProjectLead) && Boolean(lifecycle.complete), `${userId}:${contextId}`);
  const openLifecycle = (action: () => void) => requestAnimationFrame(() => {
    // Let the menu close before the existing dialog captures its focus-return target.
    if (!menuTrigger.current) return;
    menuTrigger.current.focus(); action();
  });
  const { favorites, toggle } = useNavigationFavorites(userId, contextId, authorizedProjectIds);
  const favorite = favorites.has(project.id);
  const actions: WorkspaceAction[] = [{ id: 'settings', label: 'Project settings', onSelect: onOpenSettings }];
  if (canSaveTemplate) {
    actions.push({
      id: 'save-starter-template',
      label: 'Save as starter template',
      onSelect: () => openLifecycle(() => setSaveTemplateOpen(true)),
    });
  }
  if (lifecycle.complete && !['completed','archived'].includes(project.status)) {
    if (isNonHeadProjectLead) {
      actions.push({
        id: 'request-completion-review',
        label: project.completionReviewStatus === 'requested' ? 'View completion review request' : 'Request completion review',
        onSelect: () => openLifecycle(lifecycle.complete!),
      });
    } else {
      actions.push({ id: 'requirements', label: 'View completion requirements', onSelect: () => openLifecycle(lifecycle.complete!) });
      actions.push({
        id: 'complete',
        label: project.completionReviewStatus === 'requested' ? 'Review & mark project complete' : 'Mark project complete',
        disabled: !completion.enabled,
        disabledReason: completion.reason,
        onSelect: () => {if(completion.enabled)openLifecycle(lifecycle.complete!);},
      });
    }
  }
  if (lifecycle.archive && project.status !== 'archived') actions.push({ id: 'archive', label: 'Archive project', disabled: project.status !== 'completed', disabledReason: 'Complete this project before archiving it.', onSelect: () => openLifecycle(lifecycle.archive!) });
  if (lifecycle.restore && project.status === 'archived') actions.push({ id: 'restore', label: 'Restore project', onSelect: () => openLifecycle(lifecycle.restore!) });
  if (project.publicationState==='draft'&&lifecycle.delete) actions.push({ id: 'delete', label: 'Discard project draft', onSelect: () => openLifecycle(lifecycle.delete!) });
  return <div className="eflow-project-identity__utilities">
    {userId && <WorkspaceTooltip content="Personal favorite on this device"><Button variant="ghost" size="icon" aria-label={favorite ? 'Remove project from favorites' : 'Add project to favorites'} aria-pressed={favorite} onClick={() => toggle(project.id)}><Star size={18} fill={favorite ? 'currentColor' : 'none'} /></Button></WorkspaceTooltip>}
    <ProjectPublicationAction projectId={project.id} title={project.title} status={project.status} officeId={project.orgId}/>
    {(canManage || isNonHeadProjectLead) && lifecycle.complete && !['completed','archived'].includes(project.status) && (
      <Button variant="outline" onClick={() => { void requestNavigation(lifecycle.complete!); }}>
        {isNonHeadProjectLead
          ? project.completionReviewStatus === 'requested'
            ? 'Completion review requested'
            : 'Request completion review'
          : project.completionReviewStatus === 'requested'
            ? 'Review completion request'
            : 'Completion requirements'}
      </Button>
    )}
    {(canManage||isNonHeadProjectLead)&&['planning','on_hold'].includes(project.status)&&(() => {
      const activationBlockers: ActionBlockerItem[] = [];
      if (project.status === 'planning' && project.projectApprovalStatus === 'pending_head') {
        activationBlockers.push({
          id: 'proj-head-approval',
          category: 'head_approval',
          title: 'Waiting for Office Head approval',
          detail: 'This non-Head project proposal must be approved by the Office Head before it can move to Waiting for activation.',
          waitingOn: 'Office Head',
          statusLabel: 'Pending Head',
        });
      }
      if (project.status === 'planning' && project.fundingApprovalStatus === 'pending_head') {
        activationBlockers.push({
          id: 'proj-fund-head',
          category: 'head_approval',
          title: 'Waiting for Office Head funding endorsement',
          detail: 'Step 1 of 2: Submitted project funding requires Office Head endorsement before moving to Financial Officer (Accounting) certification.',
          waitingOn: 'Office Head',
          statusLabel: 'Step 1/2 · Pending Head',
        });
        activationBlockers.push({
          id: 'proj-fund-acct',
          category: 'accounting_approval',
          title: 'Waiting for Financial Officer (Accounting) certification',
          detail: 'Step 2 of 2: Independent Financial Officer (Accounting) must certify fund availability before funds are reserved and the project can be activated.',
          waitingOn: 'Financial Officer (Accounting)',
          statusLabel: 'Step 2/2 · Queued',
        });
      } else if (project.status === 'planning' && project.fundingApprovalStatus === 'pending_accounting') {
        activationBlockers.push({
          id: 'proj-fund-acct-only',
          category: 'accounting_approval',
          title: 'Waiting for Financial Officer (Accounting) certification',
          detail: 'Office Head endorsement is complete. Independent Financial Officer (Accounting) must certify fund availability before activation.',
          waitingOn: 'Financial Officer (Accounting)',
          statusLabel: 'Step 2/2 · Pending Financial Officer',
        });
      }
      return (
        <ActionBlockerGroup
          actionLabel="Project activation"
          blockers={activationBlockers}
        >
          <Button variant="outline" onClick={()=>void requestNavigation(()=>setSetupOpen(value=>!value))} aria-expanded={setupOpen}>Setup & activation</Button>
        </ActionBlockerGroup>
      );
    })()}
    <ActionMenu tooltip="Project actions" trigger={<Button ref={menuTrigger} variant="outline" size="icon" aria-label="Project actions"><MoreHorizontal size={20} /></Button>} actions={actions} />
    {setupOpen&&['planning','on_hold'].includes(project.status)&&<ProjectSetupDialog project={project} canManage={canManage||isNonHeadProjectLead} onClose={()=>setSetupOpen(false)} onOpenSettings={onOpenSettings} onOpenOffices={onOpenOffices} onResolve={onResolveView}/>}
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
          noValidate
          onSubmit={event => {
            event.preventDefault();
            setTemplateNameTouched(true);
            if (templateBusy || !templateGroups.length || templateNameError) return;
            setTemplateBusy(true);
            setTemplateError('');
            void saveProjectTaskTemplate(templateName, templateGroups)
              .then(saved => {
                toast(`Starter template “${saved.name}” saved.`, 'success');
                setSaveTemplateOpen(false);
              })
              .catch(reason => {
                setTemplateError(readableUiError(reason, "Could not save starter template.", 'write'));
              })
              .finally(() => setTemplateBusy(false));
          }}
        >
          {templateError && (
            <FeedbackState tone="error" title="Could not save starter template">
              {templateError}
            </FeedbackState>
          )}
          <div className="grid gap-1.5">
            <label htmlFor={templateNameId} className="text-sm font-medium text-neutral-800">
              Template name <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
            </label>
            <BoundedTextInput
              id={templateNameId}
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-normal"
              maxLength={INPUT_LIMITS.GROUP_TITLE}
              disabled={templateBusy}
              aria-required="true"
              value={templateName}
              error={visibleTemplateNameError || undefined}
              onChange={event => {
                setTemplateName(event.target.value);
                if (!templateNameTouched) setTemplateNameTouched(true);
              }}
              onBlur={() => setTemplateNameTouched(true)}
            />
          </div>
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
            <ActionBlockerGroup
              actionLabel="Save starter template"
              blockers={saveTemplateDisabled ? saveTemplateTip : []}
              busy={templateBusy}
              size="sm"
            >
              <VibeButton
                type="submit"
                kind="primary"
                size="small"
                disabled={saveTemplateDisabled}
              >
                {templateBusy ? 'Saving…' : 'Save starter template'}
              </VibeButton>
            </ActionBlockerGroup>
          </div>
        </form>
      </Modal>
    )}
  </div>;
}
