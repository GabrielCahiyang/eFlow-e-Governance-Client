// @vitest-environment jsdom
import {render,screen,cleanup,waitFor} from '@testing-library/react';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {FeatureDialog} from '../../src/app/components/ui/FeatureDialog';
afterEach(()=>{cleanup();document.querySelectorAll('[data-focus-source]').forEach(node=>node.remove());});
const opener=()=>{const button=document.createElement('button');button.dataset.focusSource='true';document.body.appendChild(button);button.focus();return button;};
describe('Phase 12 nested dialog return focus',()=>{
 it('captures the opener before a child search field autofocuses',async()=>{
  const source=opener();const view=render(<FeatureDialog title="Team" onClose={vi.fn()}><input aria-label="Member search" autoFocus/></FeatureDialog>);
  await waitFor(()=>expect(document.activeElement).toBe(screen.getByLabelText('Member search')));view.unmount();await waitFor(()=>expect(document.activeElement).toBe(source));
 });
 it('captures a fresh opener on each reopening of an already mounted dialog',async()=>{
  const view=render(<FeatureDialog open={false} title="Team" onClose={vi.fn()}><input aria-label="Member search" autoFocus/></FeatureDialog>);
  const first=opener();view.rerender(<FeatureDialog open title="Team" onClose={vi.fn()}><input aria-label="Member search" autoFocus/></FeatureDialog>);
  view.rerender(<FeatureDialog open={false} title="Team" onClose={vi.fn()}><input aria-label="Member search" autoFocus/></FeatureDialog>);await waitFor(()=>expect(document.activeElement).toBe(first));
  const second=opener();view.rerender(<FeatureDialog open title="Team" onClose={vi.fn()}><input aria-label="Member search" autoFocus/></FeatureDialog>);view.unmount();await waitFor(()=>expect(document.activeElement).toBe(second));
 });
});
