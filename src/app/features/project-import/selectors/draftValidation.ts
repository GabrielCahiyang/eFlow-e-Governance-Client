import type { ProjectImportDraft } from '../types';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('AI returned an invalid project draft. Regenerate it.');
  return value as Record<string, unknown>;
}
function string(value: unknown, limit = 10000): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > limit) throw new Error('AI returned an invalid text field. Regenerate it.');
  return value.trim();
}
function array(value: unknown, limit: number): unknown[] {
  if (!Array.isArray(value) || value.length > limit) throw new Error('AI returned an invalid or oversized list. Regenerate it.');
  return value;
}
const compact = (text: string) => text.replace(/\s+/g, ' ').trim().toLocaleLowerCase();

/** Build an allowlisted draft; model IDs, assignments, budgets and statuses never become mutations. */
export function parseProjectImportDraft(raw: string, source: string): ProjectImportDraft {
  const root = object(JSON.parse(raw));
  if (root.schemaVersion !== 1) throw new Error('The AI service needs the Phase 5 workspace update.');
  const p = object(root.project);
  const offices = array(root.offices, 100).map(value => {
    const o = object(value), name = string(o.name, 200), evidence = string(o.evidence, 2000);
    if (!name || !evidence || !compact(source).includes(compact(evidence)) || !compact(evidence).includes(compact(name))) throw new Error('An Office has no verified source evidence. Regenerate the draft.');
    return { key: string(o.key, 80), name, evidence, officeId: string(o.officeId, 80), confirmed: false };
  });
  const draft: ProjectImportDraft = {
    schemaVersion: 1, project: { title: string(p.title, 300), description: string(p.description), objectives: string(p.objectives), startDate: string(p.startDate, 10), targetDate: string(p.targetDate, 10) },
    offices, warnings: array(root.warnings ?? [], 1000).map(v => string(v, 2000)), pipeline: root.pipeline ? object(root.pipeline) : undefined,
    groups: array(root.groups, 30).map(value => {
      const g = object(value), color = string(g.color, 20);
      return { key: string(g.key, 80), title: string(g.title, 120), color: /^#[\da-f]{6}$/i.test(color) ? color : '#579bfc', existingGroupId: string(g.existingGroupId, 80),
        tasks: array(g.tasks, 100).map(value => {
          const t = object(value);
          if (typeof t.estimatedHours !== 'number' || !Number.isFinite(t.estimatedHours)) throw new Error('Invalid suggested estimated hours.');
          if (!['low', 'medium', 'high'].includes(String(t.priority))) throw new Error('Invalid suggested priority.');
          const quote = string(t.sourceQuote, 2000);
          return { key: string(t.key, 80), title: string(t.title, 300), description: string(t.description), priority: t.priority as 'low' | 'medium' | 'high',
            estimatedHours: t.estimatedHours, startDate: string(t.startDate, 10), dueDate: string(t.dueDate, 10), officeKey: string(t.officeKey, 80),
            dependencies: array(t.dependencies, 100).map(v => string(v, 80)), sourceQuote: quote && compact(source).includes(compact(quote)) ? quote : '', included: true,
            advisory: t.advisory ? object(t.advisory) : undefined,
            subitems: array(t.subitems, 30).map(value => { const s = object(value); if(s.parentSubtaskId||s.parent_subtask_id||s.children||s.subitems)throw new Error("Nested imports require a hierarchy format; parent links cannot be flattened."); return { title: string(s.title, 300), dueDate: string(s.dueDate, 10) }; }),
          };
        }),
      };
    }),
  };
  validateProjectImportDraft(draft, false);
  return draft;
}

function date(value: string) {
  if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error('Use valid dates in the draft.');
}
export function validateProjectImportDraft(draft: ProjectImportDraft, confirmation = true, applyProjectDetails = false): void {
  const tasks = draft.groups.flatMap(g => g.tasks.filter(t => t.included));
  if (!tasks.length || tasks.length > 100) throw new Error('Select between 1 and 100 tasks to import.');
  if (!draft.groups.length || draft.groups.length > 30) throw new Error('Use between 1 and 30 groups.');
  if (new Set(draft.offices.map(o => o.key)).size !== draft.offices.length || draft.offices.some(o => !o.key)) throw new Error('Office references must be unique.');
  if (confirmation && draft.offices.some(o => !o.confirmed)) throw new Error('Confirm or remove every proposed Office responsibility first.');
  if (applyProjectDetails) {
    if (!draft.project.title.trim()) throw new Error('Enter a project name.');
    date(draft.project.startDate); date(draft.project.targetDate);
    if (draft.project.startDate && draft.project.targetDate && draft.project.startDate > draft.project.targetDate) throw new Error('Project start must precede its target date.');
  }
  const map = new Map(tasks.map(t => [t.key, t]));
  if (map.size !== tasks.length || tasks.some(t => !t.key)) throw new Error('Task references must be unique.');
  for (const group of draft.groups) {
    if (!group.title.trim() || group.title.length > 120) throw new Error('Enter a group name (up to 120 characters).');
    for (const t of group.tasks.filter(t => t.included)) {
      if (!t.title.trim() || t.title.length > 300 || t.description.length > 10000) throw new Error('Enter task names and descriptions within their limits.');
      if (!Number.isFinite(t.estimatedHours) || t.estimatedHours < 0 || t.estimatedHours > 100000) throw new Error('Estimated hours must be between 0 and 100000.');
      date(t.startDate); date(t.dueDate);
      if (t.startDate && t.dueDate && t.startDate > t.dueDate) throw new Error(`Start date follows due date: ${t.title}`);
      if (t.officeKey && !draft.offices.some(o => o.key === t.officeKey)) throw new Error('Choose a proposed Office responsibility.');
      for (const s of t.subitems) {
        if (Object.keys(s).some(key=>["parentSubtaskId","parent_subtask_id","children","subitems"].includes(key)))throw new Error("Nested imports require a hierarchy format; parent links cannot be flattened.");
        if (!s.title.trim() || s.title.length > 300) throw new Error('Enter each subitem name.'); date(s.dueDate);
        if (s.dueDate && t.dueDate && s.dueDate > t.dueDate) throw new Error('Subitem due dates cannot be later than their task due date.');
      }
    }
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (key: string) => {
    if (visiting.has(key)) throw new Error('Dependencies cannot form a cycle.');
    if (visited.has(key)) return;
    visiting.add(key);
    for (const dep of map.get(key)!.dependencies) {
      if (!map.has(dep)) throw new Error('A dependency points to an omitted task. Restore it or remove the dependency.');
      visit(dep);
    }
    visiting.delete(key); visited.add(key);
  };
  for (const key of map.keys()) visit(key);
}

export function reviewedImportPayload(draft: ProjectImportDraft, sourceName: string, applyProjectDetails: boolean) {
  validateProjectImportDraft(draft, true, applyProjectDetails);
  return { schemaVersion: 1, project: draft.project, applyProjectDetails, sourceName, offices: draft.offices, pipeline: draft.pipeline,
    groups: draft.groups.map(g => ({ ...g, tasks: g.tasks.filter(t => t.included).map(({ included: _included, ...task }) => task) })).filter(g => g.tasks.length),
  };
}
