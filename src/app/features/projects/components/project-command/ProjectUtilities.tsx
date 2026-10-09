import { useRef, useState } from 'react';
import { MoreHorizontal, Share2, Star } from 'lucide-react';
import { ActionMenu, WorkspaceTooltip, type WorkspaceAction } from '../../../../components/ui/workspace';
import { Button } from '../../../../components/ui/button';
import { FeatureDialog } from '../../../../components/ui/FeatureDialog';
import {ProjectAccessPanel} from '../../../project-access';
import { requestNavigation } from '../../../../shared/navigationGuard';
import { useNavigationFavorites } from '../../../../shared/navigationPreferences';
import type { Project } from '../../services/types';
import { ProjectSettingsDialog } from './ProjectSettingsDialog';
import { useProjectCompletionAvailability } from '../../hooks/useProjectCompletionAvailability';

export interface ProjectLifecycleActions { complete?: () => void; archive?: () => void; restore?: () => void; delete?: () => void; }
export function ProjectUtilities({ project, canManage, lifecycle, userId, contextId, authorizedProjectIds, view, onOpenOffices }: {
  project: Project; canManage: boolean; lifecycle: ProjectLifecycleActions; userId: string; contextId: string; authorizedProjectIds: string[]; view: string; onOpenOffices: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false), [shareOpen, setShareOpen] = useState(false),[copyNotice,setCopyNotice]=useState('');
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const completion = useProjectCompletionAvailability(project, canManage && Boolean(lifecycle.complete), `${userId}:${contextId}`);
  const openLifecycle = (action: () => void) => requestAnimationFrame(() => {
    // Let the menu close before the existing dialog captures its focus-return target.
    if (!menuTrigger.current) return;
    menuTrigger.current.focus(); action();
  });
  const { favorites, toggle } = useNavigationFavorites(userId, contextId, authorizedProjectIds);
  const favorite = favorites.has(project.id);
  const actions: WorkspaceAction[] = [{ id: 'settings', label: 'Project settings', onSelect: () => { void requestNavigation(() => setSettingsOpen(true)); } }];
  actions.push({id:'offices',label:'Project Offices',onSelect:onOpenOffices});
  if (lifecycle.complete && !['completed','archived'].includes(project.status)) {
    actions.push({ id: 'requirements', label: 'View completion requirements', onSelect: () => openLifecycle(lifecycle.complete!) });
    actions.push({ id: 'complete', label: 'Mark project complete', disabled: !completion.enabled, disabledReason: completion.reason, onSelect: () => {if(completion.enabled)openLifecycle(lifecycle.complete!);} });
  }
  if (lifecycle.archive && project.status !== 'archived') actions.push({ id: 'archive', label: 'Archive project', disabled: project.status !== 'completed', disabledReason: 'Complete this project before archiving it.', onSelect: () => openLifecycle(lifecycle.archive!) });
  if (lifecycle.restore && project.status === 'archived') actions.push({ id: 'restore', label: 'Restore project', onSelect: () => openLifecycle(lifecycle.restore!) });
  if (lifecycle.delete) actions.push({ id: 'delete', label: 'Delete project', onSelect: () => openLifecycle(lifecycle.delete!) });
  return <div className="eflow-project-identity__utilities">
    {userId && <WorkspaceTooltip content="Personal favorite on this device"><Button variant="ghost" size="icon" aria-label={favorite ? 'Remove project from favorites' : 'Add project to favorites'} aria-pressed={favorite} onClick={() => toggle(project.id)}><Star size={18} fill={favorite ? 'currentColor' : 'none'} /></Button></WorkspaceTooltip>}
    <Button variant="outline" onClick={() => { setShareOpen(true); }}><Share2 size={16} />Invite / share</Button>
    <ActionMenu tooltip="Project actions" trigger={<Button ref={menuTrigger} variant="outline" size="icon" aria-label="Project actions"><MoreHorizontal size={20} /></Button>} actions={actions} />
    {settingsOpen && <ProjectSettingsDialog project={project} canManage={canManage} onClose={() => { setSettingsOpen(false); requestAnimationFrame(() => menuTrigger.current?.focus()); }} />}
    {shareOpen && <FeatureDialog title="Share project" onClose={() => void requestNavigation(() => setShareOpen(false))} contentClassName="eflow-project-share">
      <ProjectAccessPanel project={project.id}/>
      <p>Ordinary navigation links require existing access and grant no permissions.</p><label>Project navigation link<input readOnly value={new URL(`/projects?page=Projects&project=${encodeURIComponent(project.id)}&view=${encodeURIComponent(view)}`,window.location.origin).href}/></label><Button onClick={()=>{const url=new URL(`/projects?page=Projects&project=${encodeURIComponent(project.id)}&view=${encodeURIComponent(view)}`,window.location.origin).href;void navigator.clipboard.writeText(url).then(()=>setCopyNotice('Navigation link copied.')).catch(()=>setCopyNotice('Select and copy the navigation link.'));}}>Copy navigation link</Button>{copyNotice&&<p role="status">{copyNotice}</p>}
    </FeatureDialog>}
  </div>;
}
