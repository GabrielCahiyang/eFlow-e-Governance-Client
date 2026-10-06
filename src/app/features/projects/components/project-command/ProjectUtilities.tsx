import { useRef, useState } from 'react';
import { MoreHorizontal, Share2, Star } from 'lucide-react';
import { ActionMenu, type WorkspaceAction } from '../../../../components/ui/workspace';
import { Button } from '../../../../components/ui/button';
import { FeatureDialog } from '../../../../components/ui/FeatureDialog';
import { FormField, TextInput } from '../../../../components/ui/FormField';
import { FeedbackState } from '../../../../components/ui/FeedbackState';
import { requestNavigation } from '../../../../shared/navigationGuard';
import { useNavigationFavorites } from '../../../../shared/navigationPreferences';
import type { Project } from '../../services/types';
import { ProjectSettingsDialog } from './ProjectSettingsDialog';

export interface ProjectLifecycleActions { complete?: () => void; archive?: () => void; restore?: () => void; delete?: () => void; }
export function ProjectUtilities({ project, canManage, lifecycle, userId, contextId, authorizedProjectIds, view, onOpenOffices }: {
  project: Project; canManage: boolean; lifecycle: ProjectLifecycleActions; userId: string; contextId: string; authorizedProjectIds: string[]; view: string; onOpenOffices: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false), [shareOpen, setShareOpen] = useState(false), [copyNotice, setCopyNotice] = useState('');
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const openLifecycle = (action: () => void) => requestAnimationFrame(() => {
    // Let the menu close before the existing dialog captures its focus-return target.
    if (!menuTrigger.current) return;
    menuTrigger.current.focus(); action();
  });
  const { favorites, toggle } = useNavigationFavorites(userId, contextId, authorizedProjectIds);
  const favorite = favorites.has(project.id);
  const actions: WorkspaceAction[] = [{ id: 'settings', label: 'Project settings', onSelect: () => { void requestNavigation(() => setSettingsOpen(true)); } }];
  if (lifecycle.complete && !['completed','archived'].includes(project.status)) actions.push({ id: 'complete', label: 'Mark project complete', onSelect: () => openLifecycle(lifecycle.complete!) });
  if (lifecycle.archive && project.status !== 'archived') actions.push({ id: 'archive', label: 'Archive project', disabled: project.status !== 'completed', disabledReason: 'Complete this project before archiving it.', onSelect: () => openLifecycle(lifecycle.archive!) });
  if (lifecycle.restore && project.status === 'archived') actions.push({ id: 'restore', label: 'Restore project', onSelect: () => openLifecycle(lifecycle.restore!) });
  if (lifecycle.delete) actions.push({ id: 'delete', label: 'Delete project', onSelect: () => openLifecycle(lifecycle.delete!) });
  const link = new URL('/projects', window.location.origin); link.searchParams.set('page', 'Projects'); link.searchParams.set('project', project.id); link.searchParams.set('view', view);
  return <div className="eflow-project-identity__utilities">
    {userId && <Button variant="ghost" size="icon" aria-label={favorite ? 'Remove project from favorites' : 'Add project to favorites'} aria-pressed={favorite} title="Personal favorite on this device" onClick={() => toggle(project.id)}><Star size={18} fill={favorite ? 'currentColor' : 'none'} /></Button>}
    <Button variant="outline" onClick={() => { setCopyNotice(''); setShareOpen(true); }}><Share2 size={16} />Invite / share</Button>
    <ActionMenu trigger={<Button ref={menuTrigger} variant="outline" size="icon" aria-label="Project actions"><MoreHorizontal size={20} /></Button>} actions={actions} />
    {settingsOpen && <ProjectSettingsDialog project={project} canManage={canManage} onClose={() => { setSettingsOpen(false); requestAnimationFrame(() => menuTrigger.current?.focus()); }} />}
    {shareOpen && <FeatureDialog title="Share project" onClose={() => setShareOpen(false)} contentClassName="eflow-project-share">
      <h2>Share project</h2><p>This link opens the current project view. Recipients still need existing project access; copying it does not invite anyone or grant permissions.</p>
      <FormField label="Project link"><TextInput readOnly value={link.href} onFocus={event => event.target.select()} /></FormField>
      <Button onClick={() => { void (async () => { try { await navigator.clipboard.writeText(link.href); setCopyNotice('Project link copied.'); } catch { setCopyNotice('Select the link above and copy it with your keyboard.'); } })(); }}>Copy link</Button>
      {copyNotice && <FeedbackState title={copyNotice} />}
      <Button variant="outline" onClick={() => { setShareOpen(false); onOpenOffices(); }}>Open Project Offices</Button>
      <p>Manage participation and permitted invitations in Project Offices.</p>
    </FeatureDialog>}
  </div>;
}
