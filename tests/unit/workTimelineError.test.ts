import {expect,it} from 'vitest';
import {workTimelineError} from '../../src/app/shared/workTimelineError';
it('directs a Task editor to the appointed Lead with the recorded child name',()=>{
 expect(workTimelineError('Reschedule subtask "Create the meeting sign-in sheet" before changing this timeline.')).toBe('Ask the appointed Task Lead to reschedule “Create the meeting sign-in sheet” first.');
});
it('preserves unrelated schedule and authority denials',()=>{
 for(const message of ['Task dates must stay within the project timeline.','Current access denied'])expect(workTimelineError(message)).toBe(message);
});
