/** Present old generated work percentages as updates without changing audit rows
 * or stripping percentages someone actually wrote in their note. */
export function normalizeWorkUpdateNotification<T extends {title:string;message:string;statusFrom?:string;statusTo?:string}>(notification:T):T {
  if (!/^(Subtask|Task) progress updated$/i.test(notification.title)) return notification;
  const numericStatus = (value?:string) => value && /^\d{1,3}%$/.test(value) ? undefined : value;
  return {...notification,
    title:notification.title.replace(/progress updated/i,'work updated'),
    message:notification.message.replace(/(\bupdated\s+["“].*?["”])\s+to\s+\d{1,3}%\./i,'$1.'),
    statusFrom:numericStatus(notification.statusFrom),statusTo:numericStatus(notification.statusTo),
  };
}
