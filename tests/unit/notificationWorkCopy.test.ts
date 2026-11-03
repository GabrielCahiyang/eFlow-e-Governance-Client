import {expect,it} from 'vitest';
import {normalizeWorkUpdateNotification} from '../../src/app/shared/notificationWorkCopy';
it('removes generated progress percentages while preserving the member update',()=>{
 const result=normalizeWorkUpdateNotification({title:'Subtask progress updated',message:'Chris updated "Book venue" to 0%. Called the venue · Next: Confirm booking',statusTo:'0%',reason:'Asked for a 50% deposit'});
 expect(result).toMatchObject({title:'Subtask work updated',message:'Chris updated "Book venue". Called the venue · Next: Confirm booking',statusTo:undefined,reason:'Asked for a 50% deposit'});
});
it('does not change unrelated financial messages or current work statuses',()=>{
 const cash={title:'Petty cash released',message:'Released 50% of the request',statusTo:'released'};
 expect(normalizeWorkUpdateNotification(cash)).toBe(cash);
 const current={title:'Subtask completed',message:'Chris completed "Book venue".',statusTo:'completed'};
 expect(normalizeWorkUpdateNotification(current)).toBe(current);
});
