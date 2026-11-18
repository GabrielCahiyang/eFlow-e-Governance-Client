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

type FinancialNotificationFields = {
  type?: string;
  title: string;
  message: string;
  financialRecordType?: string;
};

const TITLE_REWRITES: Array<[RegExp, string]> = [
  [/^Petty cash approved and scheduled$/i, 'Fund cash approved and scheduled'],
  [/^Petty cash approved$/i, 'Fund cash approved'],
  [/^Petty cash declined$/i, 'Fund cash declined'],
  [/^Petty cash released$/i, 'Fund cash released'],
  [/^Petty[- ]cash request awaiting approval$/i, 'Fund cash request awaiting Project Lead approval'],
  [/^Petty cash awaiting department approval$/i, 'Fund cash awaiting Project Lead approval'],
  [/^Endorsed petty cash needs approval$/i, 'Endorsed fund cash needs Project Lead approval'],
  [/^Petty cash needs your endorsement$/i, 'Fund cash needs your endorsement'],
  [/^Petty[- ]cash request needs changes$/i, 'Fund cash request needs changes'],
  [/^Corrected petty[- ]cash request ready$/i, 'Corrected fund cash request ready'],
  [/^Petty[- ]cash receipts ready for review$/i, 'Fund cash receipts ready for review'],
  [/^Petty[- ]cash liquidation is overdue$/i, 'Fund cash liquidation is overdue'],
];

function replacePettyCashTerm(text: string): string {
  return text.replace(/\bpetty[- ]cash\b/gi, (match) =>
    match[0] === match[0].toUpperCase() ? 'Fund cash' : 'fund cash',
  );
}

/** Normalize task-funded cash notifications at read time without altering
 * separate office petty cash notices or mutating historical database rows. */
export function normalizeFinancialNotification<T extends FinancialNotificationFields>(notification: T): T {
  const isTaskFundingNotice =
    notification.type?.startsWith('petty_cash_') || notification.type?.startsWith('budget_');
  const isSeparateOfficePettyCash =
    notification.financialRecordType === 'office_petty_cash' ||
    notification.financialRecordType === 'office_petty_cash_staffing' ||
    notification.type === 'petty_cash_settlement_blocked';

  if (!isTaskFundingNotice || isSeparateOfficePettyCash) {
    return notification;
  }

  let nextTitle = notification.title;
  const matchedTitle = TITLE_REWRITES.find(([pattern]) => pattern.test(nextTitle));
  if (matchedTitle) {
    nextTitle = matchedTitle[1];
  } else {
    nextTitle = replacePettyCashTerm(nextTitle)
      .replace(/\bdepartment approval\b/gi, 'Project Lead approval')
      .replace(/\bTeam Leader\b/g, 'Task Lead');
  }

  let nextMessage = notification.message
    .replace(
      /Your request was approved\.\s*Cash releases were scheduled under the department daily cap\.?/i,
      'Your fund cash request was approved and scheduled for Accounting release.',
    )
    .replace(/\bdepartment daily cap\b/gi, 'Accounting release schedule')
    .replace(/\bdepartment approval\b/gi, 'Project Lead approval')
    .replace(/\bTeam Leader\b/g, 'Task Lead');
  nextMessage = replacePettyCashTerm(nextMessage);

  if (nextTitle === notification.title && nextMessage === notification.message) {
    return notification;
  }

  return {
    ...notification,
    title: nextTitle,
    message: nextMessage,
  };
}
