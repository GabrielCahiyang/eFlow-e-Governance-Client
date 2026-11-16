/** Only the known obsolete cross-item date guards get the upgrade explanation. */
export function prerequisiteLinkingError(message:string):string {
 const normalized=message.trim().replace(/[.!]+$/,'').toLowerCase();
 if(normalized==='the subtask starts before a prerequisite is due. adjust the schedule first'
  ||normalized==='task start date is earlier than a prerequisite due date. adjust the schedule first')
  return 'Prerequisite linking needs a backend update. Contact your Office Head. Your selection has not been saved.';
 return message;
}
