import { describe, expect, it } from 'vitest';
import { parseProjectImportDraft, reviewedImportPayload, validateProjectImportDraft } from '../../src/app/features/project-import/selectors/draftValidation';

const source = 'Planning Office prepares the assessment. Coordinate the outreach program and gather supporting data.';
const fixture = () => ({ schemaVersion: 1, project: { title: 'Outreach', description: '', objectives: '', startDate: '', targetDate: '' }, offices: [{ key: 'planning', name: 'Planning Office', evidence: 'Planning Office prepares the assessment.', officeId: '', confirmed: true }], groups: [{ key: 'g1', title: 'Preparation', color: '#579bfc', existingGroupId: '', tasks: [
  { key: 'a', title: 'Assess needs', description: 'Produce a needs report.', priority: 'high', estimatedHours: 16, startDate: '', dueDate: '', officeKey: 'planning', dependencies: [], sourceQuote: 'Planning Office prepares the assessment.', subitems: [{ title: 'Gather data', dueDate: '' }], assigned_to: 'model-invented', status: 'completed', budget_impact: 99999 },
  { key: 'b', title: 'Prepare materials', description: 'Use assessment results.', priority: 'medium', estimatedHours: 8, startDate: '', dueDate: '', officeKey: '', dependencies: ['a'], sourceQuote: '', subitems: [] },
] }], warnings: [] });

describe('Phase 5 reviewed workspace import', () => {
  it('preserves hierarchy and descriptions while dropping model authority fields', () => {
    const draft = parseProjectImportDraft(JSON.stringify(fixture()), source);
    expect(draft.groups[0].tasks[0].subitems[0].title).toBe('Gather data');
    expect(draft.groups[0].tasks[0]).not.toHaveProperty('assigned_to');
    expect(draft.groups[0].tasks[0]).not.toHaveProperty('status');
    expect(draft.offices[0].confirmed).toBe(false);
    expect(() => reviewedImportPayload(draft, 'plan.md', false)).toThrow('Confirm');
    draft.offices[0].confirmed = true;
    expect(reviewedImportPayload(draft, 'plan.md', false).groups[0].tasks[0]).not.toHaveProperty('included');
  });
  it('requires real source evidence for Offices', () => {
    const raw = fixture(); raw.offices[0].evidence = 'Invented finance Office';
    expect(() => parseProjectImportDraft(JSON.stringify(raw), source)).toThrow('evidence');
  });
  it('rejects unknown references, cycles, and omitted predecessor tasks', () => {
    const draft = parseProjectImportDraft(JSON.stringify(fixture()), source);
    draft.groups[0].tasks[0].dependencies = ['b'];
    expect(() => validateProjectImportDraft(draft, false)).toThrow('cycle');
    draft.groups[0].tasks[0].dependencies = []; draft.groups[0].tasks[0].included = false;
    expect(() => validateProjectImportDraft(draft, false)).toThrow('omitted');
  });
  it('rejects invalid calendar dates and negative effort before import', () => {
    const draft = parseProjectImportDraft(JSON.stringify(fixture()), source);
    draft.groups[0].tasks[0].dueDate = '2026-02-30';
    expect(() => validateProjectImportDraft(draft, false)).toThrow('dates');
    draft.groups[0].tasks[0].dueDate = ''; draft.groups[0].tasks[0].estimatedHours = -1;
    expect(() => validateProjectImportDraft(draft, false)).toThrow('Estimated hours');
  });
  it('allows reviewing project metadata without silently applying it', () => {
    const draft = parseProjectImportDraft(JSON.stringify(fixture()), source); draft.offices[0].confirmed = true;
    expect(reviewedImportPayload(draft, 'plan.md', false).applyProjectDetails).toBe(false);
    draft.project.startDate = '2026-11-01'; draft.project.targetDate = '2026-10-01';
    expect(() => reviewedImportPayload(draft, 'plan.md', true)).toThrow('Project start');
  });
  it('rejects older title-only results and malformed lists', () => {
    expect(() => parseProjectImportDraft('{"tasks":[]}', source)).toThrow('Phase 5');
    const raw = fixture(); raw.groups[0].tasks[0].subitems = 'invalid' as never;
    expect(() => parseProjectImportDraft(JSON.stringify(raw), source)).toThrow('list');
  });
});
