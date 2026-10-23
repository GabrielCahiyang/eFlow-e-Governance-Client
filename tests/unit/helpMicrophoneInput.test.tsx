// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MicrophoneInput } from '../../src/app/features/help-assistant/components/MicrophoneInput';

afterEach(cleanup);
const props = { devices: [], deviceId: '', onChange: vi.fn(), active: true, signal: { level: .2, receiving: true, label: 'QA mic', warning: '', speaking: false, ending: false } };
describe('local microphone status versus server processing', () => {
  it('uses the speech threshold instead of labeling low background noise as speech', () => {
    const view = render(<MicrophoneInput {...props} stage="listening"/>);
    expect(screen.getByText('Waiting for speech')).toBeTruthy();
    view.rerender(<MicrophoneInput {...props} signal={{ ...props.signal, speaking: true }} stage="listening"/>);
    expect(screen.getByText('Hearing speech')).toBeTruthy();
    view.rerender(<MicrophoneInput {...props} signal={{ ...props.signal, ending: true }} stage="listening"/>);
    expect(screen.getByText('Finishing your turn…')).toBeTruthy();
  });
  it('immediately zeros the meter and shows transcription even before ASR returns', () => {
    const view = render(<MicrophoneInput {...props} stage="transcribing" signal={{ ...props.signal, speaking: true, warning: 'No audible input detected' }}/>);
    expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getByText('Understanding your words')).toBeTruthy();
    expect(screen.queryByText('Waiting for speech')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    view.rerender(<MicrophoneInput {...props} active={false} stage="speaking"/>);
    expect(screen.getByText('Speaking')).toBeTruthy();
    expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('0');
  });
});
