// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const requestNavigationMock = vi.fn((fn: () => void) => {
  fn();
  return Promise.resolve(true);
});
const pushNavigationHistoryMock = vi.fn();

vi.mock('../../src/app/shared/navigationGuard', () => ({
  requestNavigation: (fn: () => void) => requestNavigationMock(fn),
}));

vi.mock('../../src/app/shared/navigationHistory', () => ({
  pushNavigationHistory: (href: string) => pushNavigationHistoryMock(href),
}));

import { ProjectChatLink, TaskChatLink } from '../../src/app/features/chat-calls';

describe('ProjectChatLink', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/projects?page=Projects&project=proj-1&view=timeline&workspace=org-9');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders Open project chat as a Vibe button and navigates to project chat with returnView and workspace', () => {
    render(<ProjectChatLink projectId="proj-1" />);

    const button = screen.getByRole('button', { name: 'Open project chat' });
    expect(button.tagName).toBe('BUTTON');
    expect(button.classList.contains('messages-task-link')).toBe(false);
    expect(screen.queryByRole('link', { name: 'Open project chat' })).toBeNull();

    fireEvent.click(button);

    expect(requestNavigationMock).toHaveBeenCalledTimes(1);
    expect(pushNavigationHistoryMock).toHaveBeenCalledWith(
      '/messages?page=Messages&chatProject=proj-1&returnView=timeline&workspace=org-9',
    );
  });

  it('keeps TaskChatLink intact for task detail panels', () => {
    render(<TaskChatLink taskId="task-7" />);
    const link = screen.getByRole('link', { name: 'Open task chat' });
    expect(link.getAttribute('href')).toContain('chatTask=task-7');
  });
});
