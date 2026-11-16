import {expect,it} from 'vitest';
import {prerequisiteLinkingError} from '../../src/app/shared/prerequisiteLinkingError';
import {workRpcFailure} from '../../src/app/features/nested-work/services/workRequestOutcome';
it.each(['The subtask starts before a prerequisite is due. Adjust the schedule first.', 'Task start date is earlier than a prerequisite due date. Adjust the schedule first.'])('explains the pending date correction without claiming a save: %s',message=>{
 expect(prerequisiteLinkingError(message)).toContain('Your selection has not been saved');
 expect(workRpcFailure({code:'23514',message}).kind).toBe('confirmed_failure');
});
it('preserves own-schedule and authorization denials and unknown outcomes',()=>{
 for(const message of ['Task dates must stay within the project timeline.','Current access denied','Start date, prerequisites and structure cannot change after work has started.'])expect(prerequisiteLinkingError(message)).toBe(message);
 expect(workRpcFailure({message:'Connection lost'}).kind).toBe('unknown_result');
});
