import { expect, it, vi } from 'vitest';

const chat = vi.hoisted(() => vi.fn());
vi.mock('../../src/app/features/ai', () => ({
  requestAiChat: chat,
  readAiText: (response: string) => response,
}));

import { generateProjectTaskGroups, projectSetupTaskPayload } from '../../src/app/features/project-setup/services/projectTaskDraft';

it('uses all three project fields and previews AI subtasks without writing project data', async () => {
  const project = {
    title: 'Customer service seminar',
    description: 'Train the service desk team',
    scope: 'Include registration, a workshop, and an evaluation',
  };
  chat.mockResolvedValueOnce(JSON.stringify({
    groups: [{ title: 'Evaluation', tasks: [{ title: 'Review feedback', subtasks: ['Summarize responses'], budget: 100 }] }],
  }));

  const groups = await generateProjectTaskGroups(project);
  expect(JSON.parse(chat.mock.lastCall![0].messages[1].content)).toEqual(project);
  const review = projectSetupTaskPayload(groups, 'ai');
  expect(review).toMatchObject({ setupSource: 'ai', applyProjectDetails: false, offices: [] });
  expect(review.groups[0].tasks[0].subitems).toEqual([{ title: 'Summarize responses', dueDate: '' }]);
  expect(review.groups[0].tasks[0]).not.toHaveProperty('budget');
});

it('rejects a duplicate subtask before publishing the draft', () => {
  expect(() => projectSetupTaskPayload([
    { title: 'Planning', tasks: [{ title: 'Set the agenda', subtasks: ['Plan topics', ' plan TOPICS '] }] },
  ], 'template')).toThrow(/already|same/i);
});
