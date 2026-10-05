// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { decompose } = vi.hoisted(() => ({ decompose: vi.fn() }));
vi.mock('../../src/app/features/proposal-import', () => ({ decomposeProposal: decompose }));
import { AiTaskDraftDialog } from '../../src/app/features/project-table/components/AiTaskDraftDialog';
afterEach(cleanup);
beforeEach(() => { decompose.mockReset(); });
describe('Reviewed project AI suggestions', () => {
  it('passes generated titles to human review without creating or assigning work', async () => {
    decompose.mockResolvedValue({ programs: [{ projects: [{ activities: [{ tasks: [{ title: 'Prepare assessment' }, { title: 'Review findings' }] }] }] }] });
    const onReview = vi.fn(), onClose = vi.fn();
    render(createElement(AiTaskDraftDialog, { open: true, onClose, projectTitle: 'Outreach', onReview }));
    fireEvent.change(screen.getByLabelText('Project brief'), { target: { value: 'Assess the community needs and review findings.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate suggestions' }));
    await waitFor(() => expect(onReview).toHaveBeenCalledWith('Prepare assessment\nReview findings'));
    expect(onClose).toHaveBeenCalledOnce();
    expect(decompose).toHaveBeenCalledWith('Assess the community needs and review findings.', 'Outreach');
  });
  it('retains the brief after AI failure and supplies no fabricated suggestions', async () => {
    decompose.mockRejectedValue(new Error('AI service unavailable'));
    const onReview = vi.fn();
    render(createElement(AiTaskDraftDialog, { open: true, onClose: vi.fn(), projectTitle: 'Outreach', onReview }));
    fireEvent.change(screen.getByLabelText('Project brief'), { target: { value: 'Prepare outreach work' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate suggestions' }));
    expect((await screen.findByRole('alert')).textContent).toContain('AI service unavailable');
    expect(onReview).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Project brief') as HTMLTextAreaElement).value).toBe('Prepare outreach work');
  });
});
