// @vitest-environment jsdom
import { useRef, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceHelpMenu } from '../../src/app/features/guided-tours/components/WorkspaceHelpMenu';

const tours = vi.hoisted(() => ({ isTourActive: false, startPageTour: vi.fn(), startSystemTour: vi.fn() }));
vi.mock('../../src/app/features/guided-tours/components/GuidedTourProvider', () => ({ useGuidedTour: () => tours }));

function Fixture({ role = 'member' }: { role?: string }) {
  const [open, setOpen] = useState(false);
  const source = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={source} onClick={() => { source.current?.focus(); setOpen(true); }}>Rail Help</button>
      <WorkspaceHelpMenu role={role} open={open} onOpenChange={setOpen} returnFocusTarget={source.current} />
    </>
  );
}
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  tours.isTourActive = false;
});

describe('P6 shared Help action', () => {
  for (const role of ['head', 'member', 'accounting_staff', 'admin']) {
    it(`${role} sees only Guide for this page and Tour of eFlow`, async () => {
      render(<Fixture role={role} />);
      fireEvent.click(screen.getByRole('button', { name: 'Rail Help' }));
      expect(await screen.findByRole('menuitem', { name: 'Guide for this page' })).toBeTruthy();
      expect(screen.getByRole('menuitem', { name: 'Tour of eFlow' })).toBeTruthy();
      expect(screen.queryByRole('menuitem', { name: 'Getting started' })).toBeNull();
      expect(screen.queryByRole('menuitem', { name: 'Talk to eFlow AI' })).toBeNull();
    });
  }

  it('page and system choices invoke their existing providers once after closing', async () => {
    render(<Fixture />);
    const source = screen.getByRole('button', { name: 'Rail Help' });
    fireEvent.click(source);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Guide for this page' }));
    await waitFor(() => expect(tours.startPageTour).toHaveBeenCalledOnce());
    expect(document.activeElement).toBe(source);
    fireEvent.click(source);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Tour of eFlow' }));
    await waitFor(() => expect(tours.startSystemTour).toHaveBeenCalledOnce());
  });

  it('Escape closes the menu and restores the actual opener', async () => {
    render(<Fixture />);
    const source = screen.getByRole('button', { name: 'Rail Help' });
    fireEvent.click(source);
    fireEvent.keyDown(await screen.findByRole('menuitem', { name: 'Guide for this page' }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(source);
  });

  it('an active tour disables all launches without another controller', async () => {
    tours.isTourActive = true;
    render(<Fixture />);
    fireEvent.click(screen.getByRole('button', { name: 'Rail Help' }));
    const items = await screen.findAllByRole('menuitem');
    expect(items).toHaveLength(2);
    for (const item of items) expect(item.getAttribute('aria-disabled')).toBe('true');
    expect(tours.startPageTour).not.toHaveBeenCalled();
    expect(tours.startSystemTour).not.toHaveBeenCalled();
  });
});
