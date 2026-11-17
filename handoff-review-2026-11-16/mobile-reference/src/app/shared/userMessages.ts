import { matchDomainErrorMessage } from "./domainErrorMessages";

/** Public feedback only. Never interpolate a transport, database or provider error. */
export class PublicMessageError extends Error {}
export const feedback = {
  invalidCredentials: "Email or password is incorrect.",
  load: "We couldn't load this information. Please try again.",
  action:
    "We couldn't confirm your changes. Refresh this page and check before trying again.",
  connection:
    "Connection unavailable. Try again when the service is reachable.",
  timeout: "Request timed out. Please try again.",
  access:
    "You don't have access to do this. Refresh the page or contact your Office Head.",
  changed: "This item has changed. Refresh the page before continuing.",
  session: "Please sign in again to continue.",
  unavailable:
    "This information isn't available right now. Please try again later.",
  saved:
    "Your changes were saved, but this page couldn't update. Refresh to see them. Don't submit them again.",
} as const;
export type FeedbackContext = "load" | "action";
const known = new Map<string, string>([
  [
    "Allow camera access",
    "Allow camera access in device settings, or choose a file instead.",
  ],
  [
    "Upload interrupted",
    "The upload stopped before it finished. Check and resume your submission.",
  ],
  [
    "This subtask is outside the linked project context.",
    "This subtask doesn't belong to the selected project. Return to Projects to open it.",
  ],
  [
    "Settlement blocked. An independent Accounting Officer is required. Receipt endorsement or review approval does not settle the advance or grant journal-posting permission. Resolve the appointment through the authorized Office workflow.",
    "An independent Accounting Officer must be assigned before this advance can be settled. Review approval alone does not complete settlement. Contact your Office Head.",
  ],
  [
    "Work access or revision changed. Reopen this subtask and review the current work.",
    feedback.changed,
  ],
  ["The submission outcome could not be confirmed.", feedback.action],
  [
    "Choose a start date within the parent schedule, or reschedule the parent first",
    "Choose a start date within the parent schedule, or reschedule the parent first.",
  ],
  [
    "This financial action was already saved. Refresh the current record.",
    "This action was already saved. Refresh to see the latest record.",
  ],
  [
    "This action has no confirmed response. Check the current record before repeating the write.",
    feedback.action,
  ],
  [
    "Another financial action in this record has no confirmed response. Verify it before changing the request terms.",
    feedback.action,
  ],
  [
    "Announcement access is unavailable. The service must be restored before notices can load.",
    "Announcements aren't available right now. Please try again later.",
  ],
  [
    "Current independent review access is required.",
    "This review is no longer available to you. Refresh to check your assignments.",
  ],
  [
    "Settle all outstanding task cash before approval.",
    "Outstanding task cash must be settled before approval.",
  ],
]);
const validations = [
  "Enter a completion note.",
  "Enter a work note.",
  "Describe what is blocking the work.",
  "Explain what needs to change.",
  "Enter the reason for your decision.",
  "A work note is required.",
  "Record a reason for this decision.",
  "A review note or required correction is required.",
  "Explain what needs to be purchased.",
  "Needed-by date is required.",
  "Choose funding sources and positive amounts.",
  "Choose each funding source once.",
  "Actual spending cannot exceed released cash.",
  "Record the cash-return receipt number and date.",
  "Attach a receipt image or PDF for every row.",
  "Use 3,000 characters or fewer.",
  "Allow camera access in device settings, or choose a file instead.",
  "The selected file is empty, too large, or changed. Verify the original file.",
  "Each file needs a name of up to 255 characters.",
  "Choose a JPEG, PNG or WebP image.",
  "Choose a supported image, PDF, Word or Excel file.",
  "Enter your password.",
  "Use a password with 12 to 128 characters.",
  "Passwords must match.",
  "Switch accounts to accept this invitation.",
  "Enter your full name (2–160 characters).",
  "Title is required.",
  "Task name is required.",
  "Progress must be a whole number from 0 to 99.",
  "Choose a review decision and enter a reason for requested changes.",
  "Enter a work note of up to 3000 characters.",
  "Choose up to ten unique evidence files.",
  "Enter a purpose or reference and a valid date.",
  "Enter an amount within the available office balance.",
  "Enter a valid email.",
  "Choose an access end date.",
  "Email is required.",
  "Office name is required.",
  "Refresh the prerequisite tasks before saving.",
  "This message cannot be deleted.",
  "A reason is required to adjust a locked budget.",
  "Enter a project title.",
  "Enter a project title and description.",
  "Enter the project scope.",
  "Choose each account only once.",
  "Choose an account and enter a positive amount.",
  "Enter a reason for the funding.",
  "Add funding or choose No funding required.",
  "Project name is required.",
  "Reason for deletion is required.",
  "Refresh to verify current funding access.",
  "Choose each annual account once.",
  "Declared spending cannot exceed released cash.",
  "Enter the cash-return receipt number and date.",
  "Enter a reason before saving.",
  "Enter an amount within the unused balance.",
  "Choose accounts from the same fiscal year.",
];
for (const message of validations) known.set(message, message);
// Exact server reasons map to reviewed copy. Database details and hints stay private.
const workReasons: Record<string, string> = {
  "start work is available on the planned start date": "Start work is available on the planned start date.",
  "only the appointed subtask lead can start this subtask": "Only the appointed Subtask Lead can start this subtask.",
  "the parent task must be in progress before starting this subtask": "The Task Lead must start the parent Task first.",
  "complete earlier subtasks before starting this subtask": "Complete earlier ordered subtasks before starting this subtask. Cancelled work does not count as completed.",
  "choose task dates within the project schedule": "Choose Task dates within the project schedule.",
  "start the parent subtask first": "The parent Subtask must start before this Subtask can start.",
  "choose a due date between the subtask start and the parent deadline": "Choose a due date between the subtask start and the parent deadline.",
  "start or resume the task before posting progress": "The Task Lead must start or resume work before progress can be posted.",
  "start or resume the task before submitting completion": "The Task Lead must start or resume work before completion can be submitted.",
  "start the task before posting progress or submitting completion": "The Task Lead must start work before progress or completion can be submitted.",
  "only a task in to do can be started": "This task is no longer in To do. Refresh to check its current status.",
  "project is on hold": "This project is on hold. Work can continue once the project is resumed.",
  "this subtask has not started": "This subtask hasn't started yet. Wait until the parent task is underway and the planned start date has arrived.",
  "parent is unavailable in this work tree": "The parent subtask is no longer available. Reopen the task and choose a current parent.",
  "a started subtask retains its planned start date": "The planned start date can't change once the subtask has started.",
  "keep a planned start date for scheduled work": "This subtask already has a planned start date. Choose a date to continue.",
  "only the appointed task lead can start this task": "Only the appointed Task Lead can start this task.",
  "only the appointed project lead may allocate project funding": "Only the appointed Project Lead can allocate project funding.",
  "only the project lead or appointed head may allocate project funding": "Only the Project Lead or appointed Head can allocate this funding.",
  "only the appointed task lead may allocate approved funding to this subtask": "Only the appointed Task Lead can allocate approved funding to this subtask.",
  "only the current task lead can manage this subtask budget": "Only the current Task Lead can change this subtask budget.",
  "resolve the open cash request before changing this subtask budget": "Resolve the open cash request before changing this subtask budget.",
  "finished work can only return unused funding": "Finished work can only return unused funding.",
  "this subtask has no unused funding to return": "This subtask has no unused funding to return.",
  "this subtask has cash history on its original funding account": "This subtask has cash history. Keep its original funding account.",
  "this task has no approved proposal budget": "This task needs an approved budget before you can allocate funding to a subtask.",
  "this budget change was already submitted with different details": "A budget change was already submitted with different details. Refresh to see the current budget.",
  "allocation request terms changed": "This allocation was already submitted with different details. Refresh to see the current allocation.",
  "review request terms changed": "This review was already submitted with different details. Refresh to see the current decision.",
  "contributor changes must be submitted for lead review": "Submit your changes to the Lead for review.",
  "submit this subtask for the appointed task lead to review": "Submit this subtask to the appointed Task Lead for review.",
  "submit this work for the appointed lead to review": "Submit this work to the appointed Lead for review.",
  "no eligible lead can review this submission": "No eligible Lead is assigned to review this submission. Contact your Office Head.",
  "independent lead review required": "This submission needs a decision from an independent Lead.",
  "current assigned review required": "Only the currently assigned reviewer can make this decision.",
  "review access or work state changed": "The work or reviewer assignment changed. Refresh before making a decision.",
  "work changed after submission. return it for a current update": "The work changed after submission. Return it for an updated submission.",
  "choose the returned submission for this work": "Choose the returned submission for this work before resubmitting.",
  "current office workspace access required": "Switch to an Office workspace you have access to before continuing.",
  "current branch access required": "You need access to this subtask. Refresh the task or contact the Task Lead.",
  "current work scope required": "Reopen the work from its current project or workspace.",
  "current work access is required": "Reopen the work and check your current assignment before trying again.",
  "current task participation is required": "You need a current assignment on this task to make this change.",
  "current discussion access is required": "You need access to this discussion to post. Refresh the task to check your access.",
  "current project management access is required": "Only someone with current project management access can make this change.",
  "only the office head can authorize project funding": "Only the Office Head can authorize project funding.",
  "current office budget is required": "An approved Office budget is needed before you can authorize this funding.",
  "work changed. review the latest details before saving your draft": "The work changed. Review the latest details before saving your draft.",
  "the original subtask is unavailable": "The original subtask is no longer available. Refresh the task to see the current work.",
  "confirm the current work impact first": "Review and confirm the affected work before saving.",
  "evidence could not be verified": "The evidence couldn't be verified. Check that the files uploaded before submitting.",
  "evidence does not belong to this work request": "Attach the evidence to this submission before saving.",
  "a subitem with this name already exists here. use a different name": "A subtask with this name already exists here. Use a different name.",
  "choose today or a future start date": "Choose today or a future start date.",
  "choose today or a future due date": "Choose today or a future due date.",
  "enter a valid due date": "Enter a valid due date.",
  "enter a valid date": "Enter a valid date.",
  "due date cannot be before the start date": "Due date cannot be before the start date.",
  "closed project structure is read-only": "This project is closed and its tasks cannot be changed.",
  "choose a group from this project": "Choose a group from this project.",
  "enter a task title (up to 300 characters)": "Enter a task title (up to 300 characters).",
  "complete project details, dates, project lead and funding setup before adding tasks, subtasks or people": "Complete project details, dates, Project Lead, and funding setup before adding tasks, subtasks, or people.",
  "only the responsible office head can add project work": "Only the responsible Office Head can add project work.",
  "task request id was reused with different details": "This task request could not be matched to the saved details. Refresh and verify before trying again.",
  "request identity required": "Refresh the form and try saving again.",
  "create new unstarted work in the private project": "New tasks in a planning project must start in To do.",
  "complete project setup and choose open work before allocating funding": "Complete project setup and choose an open task before allocating funding.",
  "choose project funding sources, amounts and a reason": "Choose a funding account, a positive amount, and a reason.",
  "finish the pending allocation review before adding accounts": "Finish the pending allocation review before adding accounts.",
  "this task uses legacy funding. keep its existing funding separate": "This task uses legacy funding. Keep its existing funding separate.",
  "choose a project funding source and a positive amount in cents": "Choose a funding account and enter a positive amount.",
  "this task already uses that account. use another account": "This task already uses that account. Choose another account.",
  "use sources from the same fiscal year for one task allocation": "Use funding accounts from the same fiscal year.",
  "project funding is no longer available": "Selected project funding is no longer available.",
  "set the task start and due dates before allocating funding": "Set the task start and due dates before allocating funding.",
  "choose each project source once": "Choose each project funding account only once.",
  "funding requires a locked annual budget": "Lock the Office Budget for this fiscal year before allocating funding.",
  "task funding must belong to its project and selected source": "Task funding must belong to this project and selected funding account.",
  "task allocation exceeds remaining project source funding": "The requested amount exceeds the remaining balance on this project funding account.",
  "release request terms changed": "This return request changed. Refresh and check your task funding before trying again.",
  "choose an approved task source, positive amount and release reason": "Choose an approved task account, a positive amount, and a return reason.",
  "this subtask already has a cap. use the existing cap adjustment": "This subtask already has a budget cap. Adjust or return the existing cap instead.",
  "task allocation is unavailable": "Task funding allocation is unavailable.",
  "enter a reason for this budget change": "Enter a reason for this budget change.",
  "choose a funding account and enter an amount greater than zero, with up to two decimal places": "Choose a funding account and enter an amount greater than zero.",
  "this project is closed": "This project is closed.",
  "this allocation has already changed": "This subtask budget changed. Refresh before trying again.",
  "only a subtask in to do can be started": "Only a subtask in To do can be started.",
  "set a planned start date before starting this task": "Set a planned start date before starting this task.",
  "set a planned start date before starting this subtask": "Set a planned start date before starting this subtask.",
  "choose a subtask start date": "Choose a subtask start date.",
  "choose a subtask start date and due date": "Choose a subtask start date and due date.",
  "choose a subtask due date on or after its start date": "Choose a subtask due date on or after its start date.",
  "completion note is required": "Enter a completion note.",
  "this task is no longer open for submission": "This task is no longer open for submission.",
  "only the assignee or task lead may submit this work": "Only the assignee or Task Lead may submit this work.",
  "assign an eligible reviewer before submitting": "An eligible reviewer must be assigned before submitting.",
  "settle all task and subtask cash before approving this task": "Settle all task and subtask cash before approving this task.",
  "resume or reopen this task before posting progress": "Resume or reopen this task before posting progress.",
  "only the task lead can resume returned work": "Only the Task Lead can resume returned work.",
  "use direct completion to finish a subitem": "Use Mark complete to finish a subtask.",
  "subitems complete directly; review the parent task instead": "Use Mark complete to finish a subtask.",
  "subitems complete directly. use mark complete in the subitem; final approval belongs to the task": "Use Mark complete to finish a subtask.",
  "complete every child step first": "Complete every child subtask first.",
  "complete earlier ordered steps first": "Complete earlier ordered subtasks before completing this subtask.",
  "complete earlier ordered siblings first": "Complete earlier ordered subtasks first.",
  "this work is closed or already completed": "This work is closed or already completed.",
  "root task contributors are read-only for the task lead after the project becomes active": "Root task contributors cannot be changed by the Task Lead once the project is active.",
  "choose in progress or stuck": "Choose In progress or Stuck.",
  "a blocker reason is required": "Describe what is blocking the work.",
  "work update exceeds its text limit": "Work update exceeds the maximum text length.",
  "this subtask is not assigned to you": "This subtask is not assigned to you.",
  "explain what must be corrected": "Explain what must be corrected.",
  "only authorized accounting staff can settle this liquidation": "Only authorized Accounting Staff can settle this liquidation.",
  "you cannot settle your own liquidation": "You cannot settle your own liquidation.",
  "leader review and settlement must be performed by different people": "Leader review and settlement must be completed by different people.",
  "this liquidation is not awaiting accounting settlement": "This liquidation is no longer awaiting Accounting settlement.",
  "enter a reason and verify the current package": "Enter a reason and refresh the receipt package before trying again.",
  "only the authorized office head may approve this escalation": "Only the authorized Office Head may approve this escalation.",
  "the receipt package changed. review the current version": "The receipt package changed. Refresh and review the current version.",
  "send this package to the available independent reviewer": "Send this package to the available independent reviewer first.",
  "the head already approved this escalation": "The Office Head already approved this escalation.",
  "replenishment exceeds the available imprest capacity (outstanding advances cannot be replenished)": "Replenishment exceeds the available imprest capacity.",
  "this replenishment reference has already been recorded": "This replenishment reference has already been recorded.",
  "transaction date cannot be in the future": "Transaction date cannot be in the future.",
  "only the accounting officer can replenish petty cash": "Only Accounting Staff can replenish petty cash.",
  "you can only readjust the office budget when the office has no projects": "You can only readjust the Office Budget when the Office has no projects.",
  "this fiscal year is closed": "This fiscal year is closed.",
  "no account changes to save": "There are no account changes to save.",
  "project target date must be on or after its start date": "Target date must be on or after the start date.",
  "needed-by date cannot be earlier than today": "Needed-by date cannot be earlier than today.",
  "direct subtask check-off is disabled. open the subtask and submit evidence for independent review": "Direct subtask check-off is disabled. Open the subtask to complete or submit evidence.",
  "progress must be a whole number from 0 to 99. completion requires approval": "Progress must be 0 to 99. Completion requires approval.",
};
const internal =
  /https?:\/\/|(?:[a-z\d-]+\.)+(?:com|co|net|org|io|dev)(?:\b|\/)|\b(?:supabase|cloudflare|postgres|postgrest|PGRST\w*|RLS|RPC|SQL|JWT|schema|migration|gateway|endpoint|stack trace|payload|service.role|capabilities?|lease|revision|request ID|server|backend|native build)\b|(?:[A-Z]:\\)|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}/i;

export function isConnectionFailure(error: unknown) {
  const item = error as {
    name?: string;
    message?: string;
    status?: number;
  } | null;
  if (item?.status) return false;
  return /^(?:TypeError: )?(?:Network request failed|Failed to fetch|fetch failed|The device is offline)\.?$|UnknownHostException|unable to resolve host|\b(?:ENOTFOUND|ECONNREFUSED)\b|NetworkError when attempting to fetch/i.test(
    item?.message || "",
  );
}
export function userErrorMessage(
  error: unknown,
  context: FeedbackContext = "load",
): string {
  const item = error as {
    message?: unknown;
    name?: string;
    status?: number;
    code?: string;
  } | null;
  const text =
    typeof error === "string"
      ? error
      : typeof item?.message === "string"
        ? item.message
        : "";
  if (known.has(text)) return known.get(text)!;
  const reason = text.trim().replace(/\.$/, "").toLowerCase();
  if (Object.hasOwn(workReasons, reason)) return workReasons[reason];
  const available = /^Only ((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?) is available to protect on this budget line\.?$/i.exec(text);
  if (available) return `Only ₱${available[1]} is available on this budget line. Enter a smaller amount or choose another account.`;
  if (/self.review|self.approv|own (?:submission|work)/i.test(text))
    return "Someone else must review your work. Contact your Office Head if a reviewer needs to be assigned.";
  if (
    /^Choose up to (?:[1-9]|10) files\.$/.test(text) ||
    /^Each file must be (?:[1-9]|[12][0-9]) MB or smaller\.$/.test(text) ||
    /^Choose (?:a PDF|an image) (?:up to|smaller than) (?:10|20) MB\.$/.test(text)
  )
    return text;
  if (/camera.*(?:access|permission)|(?:access|permission).*camera/i.test(text))
    return "Allow camera access in device settings, or choose a file instead.";
  if (item?.name === "AccountSignInError") {
    if (item.status === 401 || item.status === 423)
      return feedback.invalidCredentials;
    if (item.status === 403)
      return "Please confirm your email or contact your Office support team for help signing in.";
    if (item.status === 429)
      return "Please wait a moment before trying to sign in again.";
  }
  if (/account is inactive/i.test(text))
    return "This account is inactive. Contact your Office support team for help.";
  const fyMismatch = text.match(
    /^Selected FY (\d{4}) funding does not overlap this task timeline\.?$/i,
  );
  if (fyMismatch)
    return `Selected FY ${fyMismatch[1]} funding does not overlap this task's start and due dates.`;
  const sourceAvail = text.match(
    /^Project source has ₱?([0-9.,]+) available; allocation requests ₱?([0-9.,]+)\.?$/i,
  );
  if (sourceAvail)
    return `The selected project account has ₱${sourceAvail[1]} available; allocation requests ₱${sourceAvail[2]}.`;
  const unusedRelease = text.match(
    /^Only ₱?([0-9.,]+) is unused; cash obligations and subtask allocations remain protected\.?$/i,
  );
  if (unusedRelease)
    return `Only ₱${unusedRelease[1]} is unused; cash obligations and subtask allocations remain protected.`;
  const startAfter = text.match(
    /^You can start this (task|subtask) on or after (\d{4}-\d{2}-\d{2})\.?$/i,
  );
  if (startAfter)
    return `You can start this ${startAfter[1].toLowerCase()} on or after ${startAfter[2]}.`;
  const subtaskBound = text.match(
    /^Subtask dates cannot be (before|after) (\d{4}-\d{2}-\d{2})\.?$/i,
  );
  if (subtaskBound)
    return `Subtask dates cannot be ${subtaskBound[1].toLowerCase()} ${subtaskBound[2]}.`;
  const rescheduleChild = text.match(
    /^Reschedule subtask "([^"]+)" before changing this timeline\.?$/i,
  );
  if (rescheduleChild)
    return `Ask the appointed Task Lead to reschedule “${rescheduleChild[1]}” first.`;
  const stepOrder = text.match(
    /^Complete Step \d+: "([^"]+)" before starting this subtask\.?$/i,
  );
  if (stepOrder)
    return `Complete "${stepOrder[1]}" before starting this subtask.`;
  const unfinishedChild = text.match(
    /^Complete (?:and review )?every (?:child step|descendant) first: resolve (?:descendant )?"([^"]+)"/i,
  );
  if (unfinishedChild)
    return `Complete and review "${unfinishedChild[1]}" first.`;
  const unavailableProject = text.match(
    /^Project work is unavailable while the project is ([a-z _-]+)\.?$/i,
  );
  if (unavailableProject)
    return `Project work is unavailable while the project is ${unavailableProject[1]}.`;
  const domainMessage = matchDomainErrorMessage(text, (s) => internal.test(s));
  if (domainMessage) return domainMessage;
  if (/^Resolve pending funding requests in Project settings .* Project budget before deleting this project\.?$/i.test(text))
    return "Resolve pending funding requests in Project settings before deleting this project.";
  if (item?.code === "22007" && /invalid input syntax for type date/i.test(text))
    return "Enter a valid date.";
  if (/mime type .* is not supported|unsupported (?:file|media|mime) type/i.test(text))
    return "This file type isn't supported. Choose a JPEG, PNG, PDF, or supported document.";
  if (
    item?.status === 413 ||
    /exceeded the maximum allowed size|payload too large|file too large/i.test(text)
  )
    return "The selected file is too large. Choose a smaller file and try again.";
  if (/bucket not found|the resource was not found/i.test(text))
    return "File upload storage is unavailable right now. Please try again later.";
  if (error instanceof PublicMessageError && !internal.test(text)) return text;
  if (
    item?.status === 401 ||
    item?.code === "PGRST301" ||
    /sign in again|session (?:changed|expired)/i.test(text)
  )
    return feedback.session;
  if (item?.code === "40001" || /revision changed|stale|version changed|item.*changed|no longer editable/i.test(text))
    return feedback.changed;
  if (
    item?.status === 403 ||
    item?.code === "42501" ||
    /permission denied|not authorized|access denied|row-level security policy/i.test(text)
  )
    return feedback.access;
  if (item?.status === 404 || item?.code === "PGRST116")
    return feedback.unavailable;
  if (
    item?.status === 408 ||
    item?.code === "57014" ||
    /TimeoutError/.test(item?.name || "") ||
    (!item?.status && /\b(?:statement timeout|timed? out)\b/i.test(text))
  )
    return context === "action"
      ? "The request timed out. Check whether your changes were saved before trying again."
      : feedback.timeout;
  if (isConnectionFailure(error))
    return context === "action"
      ? "The connection was lost. Reconnect and check whether your changes were saved before trying again."
      : feedback.connection;
  // Literal copy supplied by native screens is reviewed separately. All Error /
  // provider objects fail closed to static copy, even if they contain a message.
  if (
    typeof error === "string" &&
    text &&
    text.length <= 400 &&
    !internal.test(text)
  )
    return text;
  return feedback[context];
}

const uncertainResultPattern =
  /\b(?:couldn't confirm|could not confirm|could not be confirmed|not confirmed|no confirmed response|couldn't verify|could not verify|could not be verified|could not be loaded|could not refresh|could not respond|uncertain|verify this (?:liquidation|request|saved request)|saved request before|before repeating|already saved|don't submit them again|check whether your changes|check before (?:trying again|retrying)|check the current record|check its status|check and resume|upload stopped|was interrupted|acceptance is already in progress|activation is already in progress|please try again shortly|(?:was|is|returned an) incomplete|timed? out|connection (?:was lost|unavailable))\b/i;

/**
 * True only when the failure is a clean client/validation/guard rejection whose
 * server transaction did not commit (never true for timeouts, offline drops,
 * 5xx errors, or uncertain receipt warnings).
 */
export function isDeterministicRejection(error: unknown): boolean {
  if (!error) return false;
  const item =
    typeof error === "object"
      ? (error as {
          message?: unknown;
          code?: unknown;
          status?: unknown;
          name?: unknown;
        })
      : undefined;
  const text =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : typeof item?.message === "string"
          ? item.message
          : "";
  const status = typeof item?.status === "number" ? item.status : undefined;
  const code = typeof item?.code === "string" ? item.code : "";
  const name = typeof item?.name === "string" ? item.name : "";

  if (
    status === 408 ||
    code === "57014" ||
    (status !== undefined && status >= 500) ||
    /TimeoutError/.test(name) ||
    (!status && /\b(?:statement timeout|timed? out)\b/i.test(text)) ||
    isConnectionFailure(error)
  ) {
    return false;
  }

  const mapped = userErrorMessage(error, "action");
  if (
    mapped === feedback.load ||
    mapped === feedback.timeout ||
    mapped === feedback.connection ||
    mapped === feedback.saved
  ) {
    return false;
  }
  if (
    (mapped !== feedback.action && uncertainResultPattern.test(mapped)) ||
    uncertainResultPattern.test(text)
  ) {
    return false;
  }
  if (error instanceof PublicMessageError) return true;
  if (mapped !== feedback.action) return true;
  if (
    (status !== undefined && [400, 401, 403, 404, 409, 422].includes(status)) ||
    /^(?:22|23|42501|40001|P000[1-4]|PGRST116|PGRST301)/.test(code)
  ) {
    return true;
  }
  return false;
}
