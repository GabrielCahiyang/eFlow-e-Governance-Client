import type { WorkflowGuide, WorkflowKind, WorkflowStep } from "./types";

// Guided copy follows proposal-import controllers, collaboration review/publication,
// subtask/task review services, governance closeout, and project lifecycle checks.
// This catalog is educational content; it does not grant permissions or perform work.
const preparation: WorkflowStep[] = [
  {
    id: "create", title: "Create a proposal", stage: "prepare", icon: "proposal",
    actor: "Department Head / Assistant Head", location: "Plans & Projects → Create work plan",
    description: "Start with a proposal PDF or build a work plan manually. Both methods save a draft that you can review before publishing.",
    actions: ["Upload a PDF for AI-assisted preparation, or enter the proposal title and details yourself.", "For PDFs, follow the processing messages, then check the extracted information."],
    outcome: "A saved proposal draft, ready to organize.",
    preview: { title: "Proposal draft", status: "Draft", rows: [{ label: "Start from", value: "PDF or manual entry", tone: "info" }, { label: "Work plan", value: "Saved for review", tone: "ready" }, { label: "Employee assignments", value: "Proposed only", tone: "pending" }] },
  },
  {
    id: "organize", title: "Build the work plan", stage: "prepare", icon: "plan",
    actor: "Owning department", location: "Draft → Work plan",
    description: "Review the proposal’s programs, projects, activities, and tasks. AI suggestions still need a person to check them.",
    actions: ["Correct titles, task descriptions, required skills, and the department responsible for each task.", "Set estimated task days and deadlines. Workload uses working days, eight hours per day, and deadline urgency."],
    outcome: "A clear plan with task responsibilities and a realistic schedule.",
    preview: { title: "Work plan structure", status: "Being prepared", rows: [{ label: "Proposal", value: "Programs → Projects", tone: "info" }, { label: "Project", value: "Activities → Tasks", tone: "info" }, { label: "Each task", value: "Department · task days · deadline", tone: "ready" }] },
  },
];

const departments: WorkflowStep = {
  id: "departments", title: "Choose participating offices", stage: "prepare", icon: "departments",
  actor: "Lead department", location: "Draft → Collaboration",
  description: "Choose which departments will contribute work and which boards or committees need to review the proposal.",
  actions: ["Keep the owning department as the lead. Add required participants and any required review offices.", "Set staffing access and approval rules. Observers can follow the plan without being required to approve it."],
  outcome: "Each office has a clear role in the proposal.",
  preview: { title: "Participating offices", status: "Roles set", rows: [{ label: "Lead department", value: "Owns and publishes the plan", tone: "ready" }, { label: "Participating departments", value: "Contribute and approve participation", tone: "info" }, { label: "Review office / observer", value: "Review when required / follow only", tone: "info" }] },
};

function staffing(interdepartmental: boolean): WorkflowStep {
  return {
    id: "staffing", title: "Plan the team and budget", stage: "prepare", icon: "team",
    actor: interdepartmental ? "Lead and participating departments" : "Owning department",
    location: "Draft → Collaboration / Work plan / Budget",
    description: interdepartmental
      ? "Departments review proposed staff from their allowed staffing pools. These are planning assignments until publication."
      : "Choose staff from the department’s allowed staffing pool. These are planning assignments until publication.",
    actions: ["Choose a task leader and supporting members. Check skills and workload before confirming the team.", "If the proposal needs funding, review its budget allocations and resolve any budget checks shown by the system."],
    outcome: "The proposed team, responsibilities, and funding are ready for review.",
    preview: { title: "Team and resources", status: "Proposed", rows: [{ label: "Task leader", value: "Accountable for the task", tone: "info" }, { label: "Supporting members", value: "Help complete the work", tone: "info" }, { label: "Budget", value: "Review when funding applies", tone: "pending" }] },
  };
}

const participation: WorkflowStep = {
  id: "participation", title: "Request department approvals", stage: "approve", icon: "approval",
  actor: "Lead department → authorized office approvers", location: "Draft → Collaboration / Review & Governance",
  description: "The lead sends approval requests for the saved plan. Each required office reviews the responsibilities, team, and scope before approving its participation.",
  actions: ["Use the department approval table to see who has approved and who still needs to respond.", "Approvers can approve, request updates with a reason, or decline. Required review offices follow their configured approval rules."],
  outcome: "The current plan has the required approvals and no unresolved update requests.",
  returnPath: "Updates needed? Correct the draft, save the changes, and resend approval requests. Material changes require approval of the updated plan before publication.",
  preview: { title: "Department approval table", status: "Under review", rows: [{ label: "Lead department", value: "Owns the proposal", tone: "info" }, { label: "Participating office A", value: "Participation approved", tone: "ready" }, { label: "Participating office B", value: "Waiting for approval", tone: "pending" }] },
};

function publication(interdepartmental: boolean): WorkflowStep {
  return {
    id: "publish", title: "Publish the work plan", stage: "approve", icon: "publish",
    actor: interdepartmental ? "Lead department" : "Owning department",
    location: interdepartmental ? "Draft → Publish proposal" : "Draft → Publish department proposal",
    description: interdepartmental
      ? "Once the approval and readiness checks pass, the lead department confirms publication. Other departments’ approvals do not publish the plan automatically."
      : "The owning department checks the plan and confirms publication. A department-only proposal does not need another department’s participation approval.",
    actions: ["Resolve the remaining plan or budget checks and review the publication confirmation.", "Publish the approved plan to create operational projects, tasks, and employee assignments."],
    outcome: "Projects and tasks are active; the proposed team becomes the operational team.",
    preview: { title: "Publication", status: "Ready to publish", rows: [{ label: "Participation approvals", value: interdepartmental ? "Required offices approved" : "Other departments not required", tone: "ready" }, { label: "Plan checks", value: "Ready", tone: "ready" }, { label: "After confirmation", value: "Active projects and assigned tasks", tone: "info" }] },
  };
}

const delivery: WorkflowStep[] = [
  {
    id: "progress", title: "Carry out the assigned work", stage: "work", icon: "progress",
    actor: "Task leaders and assigned members", location: "Tasks / Plans & Projects → Project tasks",
    description: "Staff work on the published tasks. Leaders coordinate the team while members record progress and report problems.",
    actions: ["Start assigned tasks and organize subtasks when the work needs smaller responsibilities.", "Update progress, add work notes or attachments, and report blockers and the next action."],
    outcome: "The department can see the work performed, deadlines, and remaining blockers.",
    preview: { title: "Active task board", status: "In progress", rows: [{ label: "Assigned team", value: "Leader and supporting members", tone: "ready" }, { label: "Progress", value: "Work updates and evidence", tone: "info" }, { label: "Blockers", value: "Visible to the team", tone: "pending" }] },
  },
  {
    id: "subtasks", title: "Review completed subtasks", stage: "work", icon: "evidence",
    actor: "Subtask assignee → assigned subtask reviewer", location: "Task → Subtasks / Reviews",
    condition: "When the task has subtasks",
    description: "Finishing a subtask is different from having it approved. Subtask assignees submit their results for review first.",
    actions: ["Submit a completion note and at least one evidence file for each subtask.", "The assigned reviewer, usually the task leader, checks the work. Every subtask must be approved before its parent task can be submitted."],
    outcome: "All subtasks are approved and the parent task is ready for review.",
    returnPath: "If the reviewer requests updates, correct the work and resubmit the subtask with the required evidence.",
    preview: { title: "Subtask evidence review", status: "For review", rows: [{ label: "Completion note", value: "Required", tone: "info" }, { label: "Evidence file", value: "Required", tone: "info" }, { label: "Parent task", value: "Waits for every subtask approval", tone: "pending" }] },
  },
  {
    id: "funding", title: "Settle any project funds", stage: "work", icon: "funding",
    actor: "Cash recipient, task leader, and authorized budget / accounting reviewers", location: "Task → Funding / Reviews → Budget / Accounting → Settlement",
    condition: "When the work uses project funds",
    description: "Cash requests and settlement run alongside the work. Task and subtask cash must be resolved before the parent task can receive final approval.",
    actions: ["Follow cash-request approval and release steps, then submit receipts and return any unused cash.", "Complete leader endorsement and settlement by an authorized department or accounting reviewer. Late receipt packages require Department Head approval.", "Resolve every open cash request linked to the task or its subtasks, then proceed to final task review."],
    outcome: "There are no unresolved cash requests blocking final task approval or project completion.",
    returnPath: "If receipts or amounts need corrections, update the settlement package and send it for review again.",
    preview: { title: "Funding and settlement", status: "Settlement checks", rows: [{ label: "Cash request", value: "Reviewed → Released", tone: "info" }, { label: "Receipts and unused cash", value: "Submitted for review", tone: "info" }, { label: "Cash clearance", value: "Required for final task approval", tone: "pending" }] },
  },
  {
    id: "task-review", title: "Submit and approve the task", stage: "work", icon: "approval",
    actor: "Task leader / assignee → authorized task reviewer", location: "Task → Submit for review / Reviews → Project Tasks",
    description: "Submit the completed task with a completion note and supporting evidence. The reviewer checks the result and cash clearance before marking it completed.",
    actions: ["Confirm that every subtask is approved, then submit the task to its review queue.", "The reviewer follows the task’s configured route. Leadership work uses the organization’s leadership review rules; board or committee review applies only when configured."],
    outcome: "Approved tasks are marked completed and remain in the project record.",
    returnPath: "Updates needed? Read the reviewer’s feedback, correct the task, and submit it again. Unresolved task or subtask cash also blocks approval. A progress value of 100% does not replace reviewer approval.",
    preview: { title: "Task review", status: "Awaiting reviewer", rows: [{ label: "Subtasks", value: "All approved, if present", tone: "ready" }, { label: "Submission", value: "Completion note and evidence", tone: "info" }, { label: "Reviewer decision", value: "Approve or request updates", tone: "pending" }] },
  },
];

function closeout(interdepartmental: boolean): WorkflowStep {
  return {
    id: "closeout", title: "Check the final proposal record", stage: "finish", icon: "approval",
    actor: interdepartmental ? "Lead department and required final reviewers" : "Owning department",
    location: "Proposal → Review & Governance / Project → Mark project complete",
    description: interdepartmental
      ? "Check the complete proposal record. If boards or committees were included as required review offices, request their final verification before completion."
      : "Check that the department’s work is complete and its records are ready. A department-only plan does not require external office approval.",
    actions: ["Confirm that active tasks are approved or properly cancelled, subtasks are approved, and open funds are settled.", interdepartmental ? "Required final reviewers approve the closeout and can record a resolution, meeting date, or correction. Without required review offices, prepare completion directly." : "Use the completion checks to see any outstanding work or funding, and resolve it before confirming completion."],
    outcome: "Final work, funding, and any required proposal verification are cleared.",
    returnPath: "Completion stays blocked while required work, funding, or final approvals remain unresolved. Correct the listed issues and check again.",
    preview: { title: "Final completion checks", status: "Verification", rows: [{ label: "Tasks and subtasks", value: "Reviewed and resolved", tone: "ready" }, { label: "Open funding", value: "Settled, if applicable", tone: "ready" }, { label: "Final office approval", value: interdepartmental ? "Required only for review offices" : "External approval not required", tone: "info" }] },
  };
}

const ending: WorkflowStep[] = [
  {
    id: "complete", title: "Mark the project completed", stage: "finish", icon: "complete",
    actor: "Owning department / authorized project manager", location: "Project → Mark project complete / Proposal → Final governance closeout",
    description: "Completion is a separate, confirmed action after the final checks pass. The proposal can also complete its linked projects together through proposal closeout.",
    actions: ["Review the completion checklist and clear any listed blockers.", "Confirm project completion, or mark the proposal completed when completing its linked projects together."],
    outcome: "The project or proposal is completed and ready to archive.",
    preview: { title: "Project completion", status: "Completed", rows: [{ label: "Work", value: "Resolved", tone: "ready" }, { label: "Funding and required approvals", value: "Cleared", tone: "ready" }, { label: "Archive", value: "Available after completion", tone: "info" }] },
  },
  {
    id: "archive", title: "Archive and retain the record", stage: "finish", icon: "archive",
    actor: "Owning department / authorized project manager", location: "Completed project → Archive / Proposal → Archive proposal delivery",
    description: "Archive completed work with a reason. The record remains available for reference, reporting, and audit.",
    actions: ["Confirm the archive action after completion; provide the reason requested by the system.", "Archiving the proposal archives its linked projects and tasks. Archived work leaves active workspaces while its evidence, decisions, and history are retained."],
    outcome: "The full process is complete, with a retained record of the work and approvals.",
    preview: { title: "Archived project record", status: "Archived", rows: [{ label: "Active workspace", value: "Work archived", tone: "ready" }, { label: "Evidence and decisions", value: "Retained", tone: "ready" }, { label: "History and reports", value: "Available for reference", tone: "ready" }] },
  },
];

function guide(kind: WorkflowKind): WorkflowGuide {
  const interdepartmental = kind === "interdepartmental";
  return {
    kind,
    title: interdepartmental ? "Interdepartmental flow" : "Within-department flow",
    summary: interdepartmental ? "One proposal, several offices working together." : "One department, from proposal to completed work.",
    scope: interdepartmental ? "Includes participating office approvals before publication." : "The owning department publishes directly after its plan checks pass.",
    steps: [...preparation, ...(interdepartmental ? [departments] : []), staffing(interdepartmental), ...(interdepartmental ? [participation] : []), publication(interdepartmental), ...delivery, closeout(interdepartmental), ...ending],
  };
}

export const WORKFLOW_GUIDES: Record<WorkflowKind, WorkflowGuide> = {
  interdepartmental: guide("interdepartmental"),
  department: guide("department"),
};

export const WORKFLOW_STAGE_LABELS = { prepare: "Prepare", approve: "Approve & publish", work: "Carry out & review", finish: "Complete & archive" };
