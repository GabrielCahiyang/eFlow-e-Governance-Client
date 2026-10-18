import {integerError} from '../../../shared/numericValidation';
import type {TaskTemplateInput} from '../types';
export const MAX_RECURRENCE_INTERVAL=365;
export const RECURRING_TEXT_LIMITS={title:200,description:20000,criteria:100,criterion:1000} as const;
export function recurringTemplateError(input:TaskTemplateInput,now=Date.now()){
 const interval=integerError(input.recurrenceRule?.interval,'Repeat interval',1,MAX_RECURRENCE_INTERVAL);if(interval)return interval;
 if(!['daily','weekly','monthly'].includes(input.recurrenceRule?.frequency))return 'Choose a valid repeat frequency.';
 if(!input.title.trim())return 'Template title is required.';
 if(input.title.length>RECURRING_TEXT_LIMITS.title)return 'Template title can have up to 200 characters.';
 if(input.description.length>RECURRING_TEXT_LIMITS.description)return 'Description can have up to 20,000 characters.';
 if(input.acceptanceCriteria.length>RECURRING_TEXT_LIMITS.criteria||input.acceptanceCriteria.some(item=>!item.trim()||item.length>RECURRING_TEXT_LIMITS.criterion))return 'Use up to 100 criteria, each with 1–1,000 characters.';
 if(!Number.isFinite(input.nextRunAt)||input.nextRunAt<=now)return 'Choose a first run in the future (Philippine time).';
 if(input.assigneeId&&input.assigneeId===input.reviewerId)return 'The task owner cannot also review the recurring task.';
 return '';
}
