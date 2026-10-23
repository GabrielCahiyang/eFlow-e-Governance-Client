// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { JournalEntryPage } from '../../src/app/features/budget/components/JournalEntryPage';
import type { GeneralJournalEntry } from '../../src/app/features/budget/types';

const entry: GeneralJournalEntry = { id: 'journal', entryNumber: 1, fiscalBudgetId: 'fy', orgId: 'office', entryDate: '2026-10-22',
  referenceNumber: 'QA-JOURNAL', sourceType: 'liquidation', postedAt: Date.parse('2026-10-21T16:30:00Z'),
  memo: 'Receipt details. '.repeat(30) + 'Original final note.', lines: [
    { id: 'debit', lineNumber: 1, accountCode: '501', accountTitle: 'Supplies', debit: 500, credit: 0 },
    { id: 'credit', lineNumber: 2, accountCode: '105', accountTitle: 'Advance cleared', debit: 0, credit: 500 },
  ] };
afterEach(cleanup);
it('keeps the complete memo recoverable without filling the page, and resets on entry change', () => {
  const { rerender } = render(<JournalEntryPage entry={entry} onBack={vi.fn()} />);
  expect(screen.queryByText(/Original final note/)).toBeNull();
  const expand = screen.getByRole('button', { name: 'Read full memo' });
  expect(expand.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(expand);
  expect(screen.getByText(/Original final note/).textContent).toBe(entry.memo);
  fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
  expect(screen.queryByText(/Original final note/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Read full memo' }));
  rerender(<JournalEntryPage entry={{ ...entry, id: 'other', memo: entry.memo + ' Second entry.' }} onBack={vi.fn()} />);
  expect(screen.queryByText(/Second entry/)).toBeNull();
});
it('shows every line, full totals, balance state and the original back action', () => {
  const back = vi.fn();
  const { rerender } = render(<JournalEntryPage entry={entry} onBack={back} />);
  expect(screen.getByText('Balanced entry')).toBeTruthy();
  expect(screen.getByText('Advance cleared')).toBeTruthy();
  expect(screen.getByRole('table').querySelector('tfoot')?.textContent).toContain('₱500.00Credit₱500.00');
  fireEvent.click(screen.getByRole('button', { name: 'Back to journal' }));
  expect(back).toHaveBeenCalledOnce();
  rerender(<JournalEntryPage entry={{ ...entry, lines: [entry.lines[0]] }} onBack={back} />);
  expect(screen.queryByText('Balanced entry')).toBeNull();
  expect(screen.getByText('Balance needs review')).toBeTruthy();
});
