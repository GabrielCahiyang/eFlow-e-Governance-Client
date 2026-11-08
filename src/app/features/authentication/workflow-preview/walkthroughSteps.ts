import type { WorkflowChapter, WorkflowKind } from "./types";

export interface PreviewTourStep {
  id: string;
  chapter: WorkflowChapter;
  title: string;
  description: string;
  actor: string;
  path: string;
}

const scene = (id: string, chapter: WorkflowChapter, title: string, description: string, actor: string, path: string): PreviewTourStep =>
  ({ id, chapter, title, description, actor, path });

const setup = [
  scene("office-budget", "Project setup", "Prepare the Office Budget",
    "The Head sets the annual amount for the Supplies account and saves and locks the budget. Accounting confirms availability for any scheduled releases.",
    "Head", "Workspaces / Office Budget"),
  scene("create-project", "Project setup", "Set up the project",
    "Open All projects and choose Create project. Define the title, description, scope, project lead, and dates before adding tasks or people.",
    "Head", "Workspaces / Projects"),
  scene("project-funding", "Project setup", "Reserve the project budget",
    "Authorize ₱40,000 from the Office Budget’s Supplies account. The office has ₱60,000 available after that. Tasks draw from the funds already reserved for the project.",
    "Head", "Projects / Project setup / Funding"),
  scene("save-project", "Project setup", "Review and finish setup",
    "Check the project details, lead, schedule, and funding. Finish setup to open the main table and start adding work.",
    "Head", "Projects / Project setup / Review"),
  scene("add-task", "Project setup", "Add a task in the main table",
    "Use New task to create the work. Keep the task dates within the project timeline and set prerequisites when it depends on other tasks.",
    "Head", "Projects / Community Services Seminar / Main table"),
];

const outsideOffice = [
  scene("add-office", "Project team", "Add an outside office to this project",
    "In the project’s Offices tab, choose Add named Office. The office entry belongs to this project. Saving the name gives nobody access yet.",
    "Lead Office Head", "Projects / Community Services Seminar / Offices"),
  scene("invite-person", "Project team", "Invite the person who will do the work",
    "Choose Invite people on the office row. Select Office employee or Office representative / Head. Either can join assigned work. This invitation grants access to this project only.",
    "Lead Office Head", "Projects / Offices / Community Training Center"),
  scene("accept-invite", "Project team", "Accept the private invitation",
    "The invitee opens the private link and fills in their details. New users choose a password. Project access ends at completion or archive.",
    "Invited employee", "Invitation email / Accept invitation"),
  scene("assign-guest", "Project team", "Assign the guest to project work",
    "Once the invitation shows Joined, use Choose people on the task to assign the employee. Their permanent account role and home office stay the same.",
    "Lead Office Head", "Projects / Main table / Choose people"),
];

const officeTeam = scene("office-team", "Project team", "Add the project’s team",
  "After setup, open Add people and select office colleagues. In the main table, use Choose people to set the task lead and contributors.",
  "Head", "Projects / Community Services Seminar / Add people");

const delivery = [
  scene("allocate-task", "Deliver work", "Allocate the task budget",
    "Allocate ₱10,000 to the task from the project’s Supplies funds. This leaves ₱30,000 unallocated in the project and creates no second charge to the Office Budget.",
    "Head", "Projects / Main table / Budget"),
  scene("activate", "Deliver work", "Activate the project",
    "In Setup & activation, confirm the plan reviews and resolve anything marked Needs attention. Activate once the checks are ready.",
    "Head", "Projects / Setup & activation"),
  scene("subtasks", "Deliver work", "Assign subtasks and record the work",
    "The task lead assigns subtasks. Team members post updates and evidence. The subtask lead or task lead can mark the step complete directly.",
    "Task lead", "My Work / Leading / Work"),
  scene("request-cash", "Settle cash", "Request cash from the task allocation",
    "Request ₱4,000 for registration kits using the task’s funded account. Follow the request’s approval route in Reviews → Budget. Office petty cash is a separate fund.",
    "Task lead", "Task details / Overview / Funding"),
  scene("authorize", "Settle cash", "Review the cash request",
    "Open the request in Reviews → Budget. Check the purpose, funding source, and amount before authorizing it for Accounting to release.",
    "Authorized reviewer", "Inbox / Reviews / Budget"),
  scene("release", "Settle cash", "Release and acknowledge the cash",
    "Accounting records the voucher and cash handover. The recipient acknowledges receipt using the voucher number provided by the releasing officer.",
    "Accounting Officer → Cash recipient", "Accounting / Voucher & Cash Releases"),
  scene("receipts", "Settle cash", "Submit receipts and return the change",
    "Enter the ₱3,500 actual cost from the receipts and return the unused ₱500. Submit the package with proof of spending and the cash return.",
    "Cash recipient", "Task details / Funding activity / Upload receipts"),
  scene("settlement", "Settle cash", "Settle and post the liquidation",
    "Accounting verifies ₱3,500 in receipts and ₱500 returned, then uses Settle & post to clear the advance. If no independent officer is available, an eligible Head can use Approve & post settlement in Reviews → Budget.",
    "Accounting Officer", "Accounting / Settlements"),
  scene("task-review", "Close project", "Submit and approve the parent task",
    "The task lead submits the finished work and evidence. The project lead reviews it in Reviews → Project Tasks. Work led by the project lead routes to the Head.",
    "Project lead", "Inbox / Reviews / Project Tasks"),
  scene("return-funding", "Close project", "Return unused project funding",
    "Return the task’s unused ₱6,500 to the project. The Head releases it together with the project’s ₱30,000 unallocated balance back to the Office Budget before completion.",
    "Head", "Projects / Budget Overview / Manage project funding"),
  scene("complete", "Close project", "Complete the project",
    "Choose Mark project complete. Confirm once all required work is approved, cash is settled, and unused funding has been returned.",
    "Head", "Projects / Community Services Seminar"),
  scene("archived", "Close project", "Archive and retain the record",
    "Archive the completed project to move it out of active work. The archived record retains its task evidence, financial history, and decisions.",
    "Head", "Projects / Archived projects"),
];

export const WORKFLOW_WALKTHROUGHS: Record<WorkflowKind, PreviewTourStep[]> = {
  department: [...setup, officeTeam, ...delivery],
  interdepartmental: [...setup, ...outsideOffice, ...delivery],
};
