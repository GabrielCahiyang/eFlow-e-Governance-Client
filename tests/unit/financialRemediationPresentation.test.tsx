// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { formatManilaDate, formatManilaInstant } from '../../src/app/shared/calendarDisplay';
import { ReadinessCheckList } from '../../src/app/features/project-readiness/components/ReadinessCheckList';
import { financialPosition } from '../../src/app/features/budget/selectors/financialPosition';
import { CompletionBlockersList } from '../../src/app/features/projects/components/CompletionBlockersList';
import { independentReviewAllowsPosting, type IndependentReviewContext } from '../../src/app/features/budget/services/independentReviewService';
import type { DepartmentBudgetBundle, DepartmentBudgetSummary } from '../../src/app/features/budget/types';

afterEach(cleanup);
describe('Financial remediation display and review contracts', () => {
  it('states shared completion guidance once while keeping each task and link', () => {
    render(<CompletionBlockersList blockers={['One', 'Two'].map((title, index) => ({ kind: 'task', id: String(index), taskId: String(index), title, status: 'todo', detail: 'Submit evidence for review.' }))} busy={false} onOpenTask={() => {}} onOpenGovernance={() => {}} />);
    expect(screen.getAllByText('Submit evidence for review.')).toHaveLength(1);
    expect(screen.getAllByText('Not started')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Open task' })).toHaveLength(2);
  });
  it('groups completion work, finance and governance without losing blockers', () => {
    render(<CompletionBlockersList blockers={[
      { kind: 'task', id: 't', title: 'Finish delivery', status: 'in_progress', detail: 'Evidence required' },
      { kind: 'cash', id: 'c', title: 'Cash request', status: 'pending_department_settlement', detail: 'Old Head wording', amount: 500 },
      { kind: 'governance', id: 'g', title: 'Closeout', status: 'pending', detail: 'Approval required' },
    ]} busy={false} onOpenTask={() => {}} onOpenGovernance={() => {}} />);
    expect(screen.getByRole('region', { name: 'Work and evidence' }).textContent).toContain('Finish delivery');
    expect(screen.getByRole('region', { name: 'Finance' }).textContent).toContain('Financial Officer');
    expect(screen.getByRole('region', { name: 'Governance' }).textContent).toContain('Closeout');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
  it('formats date-only values and boundary instants using Manila, rejecting ambiguous timestamps', () => {
    expect(formatManilaDate('2026-10-22')).toMatch(/22/);
    expect(formatManilaDate('2026-10-21T16:30:00Z')).toBe(formatManilaDate('2026-10-22'));
    expect(formatManilaDate('2026-02-30')).toBe('Not set');
    expect(formatManilaDate('2026-10-21T16:30:00')).toBe('Not set');
    expect(formatManilaInstant('2026-10-21T16:30:00Z')).toMatch(/PHT$/);
  });
  it('shows actionable blockers first and retains confirmed checks under a counted disclosure', () => {
    render(<ReadinessCheckList checks={[{ key: 'dates', label: 'Dates', detail: 'Confirmed dates', ok: true }, { key: 'cash', label: 'Open cash', detail: 'Needs settlement', ok: false }]} actions={() => null} />);
    expect(screen.getByRole('region', { name: 'Readiness blockers' }).textContent).toContain('Open cash');
    const disclosure = screen.getByText('Confirmed checks (1)').closest('details')!;
    expect(disclosure.open).toBe(false);
    fireEvent.click(screen.getByText('Confirmed checks (1)'));
    expect(screen.getByText('Confirmed dates')).toBeTruthy();
  });
  it('keeps appropriation, commitment and cash separate after settlement and archive', () => {
    const summary = { approvedAmount: 10000, committedAmount: 3000, spentAmount: 400, availableAmount: 7000 } as DepartmentBudgetSummary;
    const data = { requests: [{ status: 'settled', releasedAmount: 500, actualSpent: 400, returnedAmount: 100 }] } as DepartmentBudgetBundle;
    expect(financialPosition(data, summary)).toEqual({ authority: 10000, committed: 3000, available: 7000, released: 500, spent: 400, returned: 100, unsettled: 0, unusedCommitment: 2600 });
  });
  it('only allows a current approved independent review and a different poster', () => {
    const context = { required: true, current: true, canSettle: true, review: { status: 'approved', reviewer_id: 'head' } } as IndependentReviewContext;
    expect(independentReviewAllowsPosting(context, 'accounting')).toBe(true);
    expect(independentReviewAllowsPosting(context, 'head')).toBe(false);
    expect(independentReviewAllowsPosting({ ...context, current: false }, 'accounting')).toBe(false);
    expect(independentReviewAllowsPosting({ ...context, review: null }, 'accounting')).toBe(false);
    expect(independentReviewAllowsPosting({ ...context, canSettle: false }, 'accounting')).toBe(false);
  });
});
