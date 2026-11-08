// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MessagesButton } from '../../src/app/features/chat-calls/components/MessagesButton';

const state = vi.hoisted(() => ({ conversations: [{ unread: true }, { unread: false }] }));
vi.mock('../../src/app/features/chat-calls/components/MessagesContext', () => ({ useMessages: () => state }));

afterEach(cleanup);

it('shows an unread dot and opens the workspace with a single action', () => {
  const onOpen = vi.fn();
  const view = render(<MessagesButton active={false} onOpen={onOpen} />);
  const button = screen.getByRole('button', { name: 'Open messages, 1 unread conversation' });
  expect(button.querySelector('.messages-unread-dot')).not.toBeNull();
  fireEvent.click(button);
  expect(onOpen).toHaveBeenCalledOnce();
  state.conversations = [{ unread: false }];
  view.rerender(<MessagesButton active onOpen={onOpen} />);
  expect(screen.getByRole('button', { name: 'Open messages' }).querySelector('.messages-unread-dot')).toBeNull();
});
