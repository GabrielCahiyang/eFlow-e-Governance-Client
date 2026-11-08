import { MessageCircle } from 'lucide-react';
import { requestNavigation } from '../../../shared/navigationGuard';
import { pushNavigationHistory } from '../../../shared/navigationHistory';

export function TaskChatLink({ taskId }: { taskId: string }) {
  return <WorkChatLink parameter="chatTask" id={taskId}>Open task chat</WorkChatLink>;
}

export function ProjectChatLink({ projectId }: { projectId: string }) {
  return <WorkChatLink parameter="chatProject" id={projectId}>Open project chat</WorkChatLink>;
}

function WorkChatLink({ parameter, id, children }: { parameter: 'chatTask' | 'chatProject'; id: string; children: string }) {
  const params = new URLSearchParams({ page: 'Messages', [parameter]: id });
  const workspace = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('workspace');
  if (workspace) params.set('workspace', workspace);
  const href = '/messages?' + params.toString();
  return <a className="messages-task-link" href={href} onClick={event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    void requestNavigation(() => pushNavigationHistory(href));
  }}><MessageCircle size={16} aria-hidden="true" /> {children}</a>;
}
