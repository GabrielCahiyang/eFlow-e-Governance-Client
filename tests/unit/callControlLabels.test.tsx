// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ActiveCall } from '../../src/app/services/callService';
import { CallModal } from '../../src/app/components/ui/CallModal';

const media = vi.hoisted(() => {
  const audio = { enabled: true, stop: vi.fn() };
  const video = { enabled: true, stop: vi.fn() };
  return { audio, video, hangup: vi.fn(), start: vi.fn(), stream: { getAudioTracks: () => [audio], getVideoTracks: () => [video], getTracks: () => [audio, video] } };
});
vi.mock('../../src/app/services/callService', () => ({
  getLocalMedia: vi.fn(async () => media.stream), answerCall: vi.fn(), endCall: vi.fn(),
  WebRTCSession: class { start = media.start; hangup = media.hangup; },
}));
afterEach(cleanup);

describe('call control action names', () => {
  it('names the next action and preserves microphone, camera and hangup handlers', async () => {
    render(<CallModal call={{ id: 'call', callType: 'video', calleeName: 'Jordan' } as ActiveCall} isCaller onClose={() => undefined} />);
    await waitFor(() => expect(media.start).toHaveBeenCalledWith(media.stream));
    const mute = screen.getByRole('button', { name: 'Mute microphone' });
    fireEvent.click(mute);
    expect(screen.getByRole('button', { name: 'Unmute microphone' })).toBeTruthy();
    expect(media.audio.enabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Unmute microphone' }));
    expect(media.audio.enabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Turn camera off' }));
    expect(screen.getByRole('button', { name: 'Turn camera on' })).toBeTruthy();
    expect(media.video.enabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'End call' }));
    expect(media.hangup).toHaveBeenCalledTimes(1);
  });
});
