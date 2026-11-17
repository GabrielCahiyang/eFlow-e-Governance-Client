import { describe, expect, it } from 'vitest';
import { financialWriteFeedback } from '../../src/app/features/budget/financialReceipts';
import { buildShellNavigation, searchNavigation } from '../../src/app/features/navigation/presentationNavigation';

describe('readability follow-up', () => {
  const context = { submitted: true, action: 'Your journal entry', record: 'the journal' };

  it('distinguishes a recorded posting from a failed refresh', () => {
    expect(financialWriteFeedback(new Error('Connection lost'), { ...context, outcome: 'saved' }))
      .toBe('Your journal entry was saved. We couldn’t refresh the journal. Reload the records before continuing.');
  });

  it('requires verification after an unconfirmed write and preserves useful rejection reasons', () => {
    expect(financialWriteFeedback(new Error('Connection lost'), { ...context, outcome: 'uncertain' }))
      .toContain('Check the journal before submitting again.');
    expect(financialWriteFeedback(new Error('Debit and credit must balance.'), context))
      .toBe('Your journal entry was not saved. Debit and credit must balance.');
    expect(financialWriteFeedback(new Error('Connection lost'), { ...context, submitted: false }))
      .toContain('was not submitted');
  });

  it('finds the renamed page using either wording while navigating to the existing key', () => {
    const items = buildShellNavigation({ role: 'member', can: () => true, hasLeadingWork: true });
    const result = { section: 'personal_work', page: 'Leading', title: 'Work I lead' };
    expect(searchNavigation('Work I lead', items, [])).toEqual([expect.objectContaining(result)]);
    expect(searchNavigation('Leading', items, [])).toContainEqual(expect.objectContaining(result));
  });
});
