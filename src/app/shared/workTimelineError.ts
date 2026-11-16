export function workTimelineError(message:string):string {
 const match=message.match(/^Reschedule subtask ["“](.+)["”] before changing this timeline\.?$/i);
 return match?`Ask the appointed Task Lead to reschedule “${match[1]}” first.`:message;
}
