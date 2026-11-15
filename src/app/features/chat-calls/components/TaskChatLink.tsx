import { Button } from '@vibe/core';
import { MessageCircle } from 'lucide-react';
import { requestNavigation } from '../../../shared/navigationGuard';
import { pushNavigationHistory } from '../../../shared/navigationHistory';

function buildWorkChatHref(parameter: 'chatTask' | 'chatProject', id: string): string {
  const params = new URLSearchParams({ page: 'Messages', [parameter]: id });
  if (parameter === 'chatProject' && typeof window !== 'undefined') {
    params.set('returnView', new URLSearchParams(window.location.search).get('view') || 'tasks');
  }
  const workspace = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('workspace');
  if (workspace) params.set('workspace', workspace);
  return '/messages?' + params.toString();
}

export function TaskChatLink({ taskId }: { taskId: string }) {
  return <WorkChatLink parameter="chatTask" id={taskId}>Open task chat</WorkChatLink>;
}

export function ProjectChatLink({ projectId }: { projectId: string }) {
  const href = buildWorkChatHref('chatProject', projectId);
  return (
    <Button
      kind="secondary"
      size="small"
      leftIcon={({ className }) => (
        <MessageCircle size={15} className={className} aria-hidden="true" />
      )}
      onClick={() => {
        void requestNavigation(() => pushNavigationHistory(href));
      }}
    >
      Open project chat
    </Button>
  );
}

function WorkChatLink({ parameter, id, children }: { parameter: 'chatTask' | 'chatProject'; id: string; children: string }) {
  const href = buildWorkChatHref(parameter, id);
  return (
    <a
      className="messages-task-link"
      href={href}
      onClick={event => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
        event.preventDefault();
        void requestNavigation(() => pushNavigationHistory(href));
      }}
    >
      <MessageCircle size={16} aria-hidden="true" /> {children}
    </a>
  );
}
