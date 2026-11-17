const exactMessages: Record<string, string> = {
  "the subtask starts before a prerequisite is due. adjust the schedule first":
    "Prerequisite linking needs a backend update. Contact your Office Head.",
  "start date, prerequisites and structure cannot change after work has started":
    "Start date, prerequisites and structure cannot change after work has started.",
  "only the supervising lead or authorized office head can reschedule this work":
    "Only the supervising Lead or authorized Office Head can reschedule this work.",
  "enter a reason for changing the due date":
    "Enter a reason for changing the due date.",
  "keep the schedule change reason within 1,000 characters":
    "Keep the schedule change reason within 1,000 characters.",
  "work details are read-only. refresh the work or use its existing review or reopen action":
    "Work details are read-only. Refresh the work or use its existing review or reopen action.",
  "work details are read-only during review or after completion":
    "Work details are read-only during review or after completion.",
  "started work and its history cannot be deleted":
    "Started work and its history cannot be deleted.",
  "complete every selected prerequisite before starting this subtask":
    "Complete every selected prerequisite before starting this subtask.",
  "this subtask is blocked until every selected prerequisite is completed":
    "Complete every selected prerequisite before updating or completing this subtask.",
  "add subtasks directly to their task":
    "This server currently supports creating subtasks directly under a task. Open the parent task to add one.",
  // Cash requests, releases, liquidation, budgets & accounting
  "a pcv cannot change fiscal budget":
    "A petty cash voucher cannot change the fiscal budget.",
  "a cancellation reason is required": "A cancellation reason is required.",
  "a completion note is required": "A completion note is required.",
  "a completion note is required before review":
    "A completion note is required before review.",
  "a deletion reason of at least 5 characters is required":
    "A deletion reason of at least 5 characters is required.",
  "a dependency points to an omitted task. restore it or remove the dependency":
    "A dependency points to an omitted task. Restore it or remove the dependency.",
  "a fiscal close reason is required": "A fiscal close reason is required.",
  "a funded account cannot be deleted, held below its commitments or converted into a parent":
    "A funded account cannot be deleted, held below its commitments, or converted into a parent.",
  "a journal entry needs at least two lines":
    "A journal entry needs at least two lines.",
  "a liquidation idempotency key is required":
    "Could not verify this liquidation submission. Refresh and try again.",
  "a new submission must be pending and undecided":
    "This submission has already been decided.",
  "a reason and authority reference are required for a locked budget adjustment":
    "A reason and authority reference are required for a locked budget adjustment.",
  "a reason is required after subtask work has started":
    "A reason is required after subtask work has started.",
  "a reason is required to remove a comment":
    "A reason is required to remove a comment.",
  "a reason is required to reopen": "A reason is required to reopen this work.",
  "a reason is required when declining":
    "A reason is required when declining.",
  "a recalculation reason is required":
    "A recalculation reason is required.",
  "a request idempotency key is required":
    "Could not verify this request. Refresh and try again.",
  "a routing reason, version and request identity are required":
    "Enter a routing reason and refresh before submitting.",
  "a schedule change is already pending":
    "A schedule change is already pending.",
  "a selected person is no longer available for this project":
    "A selected person is no longer available for this project.",
  "a selected subtask assignee is invalid":
    "Choose a valid project team member for this subtask.",
  "a separate accounting officer must settle this request":
    "A separate Accounting Officer must settle this request.",
  "a separate eligible accounting officer must settle this package":
    "A separate eligible Accounting Officer must settle this package.",
  "a signed-in recipient and update are required":
    "Sign in and enter an update before saving.",
  "a subitem has already started. move its task before deleting this group":
    "A subitem has already started. Move its task before deleting this group.",
  "a subtask due date is required": "A subtask due date is required.",
  "a subtask is already in progress or has review history and cannot be deleted or overridden":
    "This subtask is already in progress or has review history and cannot be deleted or replaced.",
  "a task cannot depend on itself or select a prerequisite twice":
    "A task cannot depend on itself or select the same prerequisite twice.",
  "a work operation is already pending":
    "A work update is already in progress. Refresh and check before trying again.",
  "accept or revoke the pending invitation before linking":
    "Accept or revoke the pending invitation before linking.",
  "acceptance is already in progress":
    "Acceptance is already in progress. Please wait.",
  "acceptance is in progress. please try again shortly":
    "Acceptance is already in progress. Please try again shortly.",
  "accepted recipient required": "Choose an accepted recipient.",
  "access end must be in the future": "Access end date must be in the future.",
  "access terms changed. reload members before renewal":
    "Access terms changed. Reload Members before renewing access.",
  "access terms changed. reload members before saving":
    "Access terms changed. Reload Members before saving.",
  "account ids must be unique": "Account IDs must be unique.",
  "accounting access denied":
    "Accounting access is required for this action.",
  "accounting must confirm availability before held money can be released. you can change release dates without reducing the pending total":
    "Accounting must confirm availability before held money can be released. You can change release dates without reducing the pending total.",
  "accounting officer release required":
    "An Accounting Officer must release this cash.",
  "accounting officer settlement required":
    "An Accounting Officer must settle this liquidation.",
  "accounting staff requires an operational office":
    "Accounting Staff must belong to an operational Office.",
  "acknowledge every released cash tranche before submitting receipts":
    "Acknowledge every released cash tranche before submitting receipts.",
  "activate the project before sending project invitations or sharing access":
    "Activate the project before sending invitations or sharing access.",
  "activation attempt expired. reopen your email link":
    "Activation attempt expired. Reopen your email link.",
  "activation is already in progress. please wait":
    "Activation is already in progress. Please wait.",
  "activation was interrupted": "Project activation was interrupted.",
  "active office membership required": "Active Office membership is required.",
  "active operational account required":
    "An active operational account is required.",
  "active subtask cap not found":
    "This subtask spending cap is no longer active.",
  "active verified operational identity required":
    "An active verified operational account is required.",
  "active work must be reopened or reassigned, not cleared":
    "Active work must be reopened or reassigned instead of cleared.",
  "activity completeness could not be verified":
    "Activity history could not be verified. Refresh and try again.",
  "activity page is incomplete. retry history":
    "Activity history is incomplete. Try loading again.",
  "actual spending cannot exceed the amount released":
    "Actual spending cannot exceed the amount released.",
  "actual spending cannot exceed the approved amount":
    "Actual spending cannot exceed the approved amount.",
  "actual spending must use finite nonnegative cents":
    "Enter a valid non-negative spending amount.",
  "add a liquidation note": "Add a liquidation note.",
  "add at least one annual budget line": "Add at least one annual budget line.",
  "add children before starting the parent":
    "Add at least one child step before starting this work.",
  "add subtasks directly to a project task":
    "Add subtasks directly to a project task.",
  "add up to 30 receipts, or return the entire unspent advance":
    "Add up to 30 receipts, or return the entire unspent advance.",
  "adjusted funding cannot be lower than active proposal commitments":
    "Adjusted funding cannot be lower than active commitments.",
  "admin task access is read-only. ask the responsible organization to make this change":
    "Admin task access is read-only. Ask the responsible Office to make this change.",
  "all scheduled cash must be released before liquidation":
    "All scheduled cash must be released before liquidation.",
  "allocate the parent task budget first":
    "Allocate the parent task budget first.",
  "allocate this task from its project budget; office budget must not be charged again":
    "Allocate this task from its project budget instead of charging the Office budget again.",
  "allocation request not found":
    "This budget allocation is no longer available.",
  "already a project member; do not replace independent access":
    "This person is already a project member with independent access.",
  "an active authenticated profile is required":
    "Your active profile is required. Sign in again.",
  "an active eflow profile is required to create a project":
    "An active eFlow profile is required to create a project.",
  "an active eflow profile is required to create a task":
    "An active eFlow profile is required to create a task.",
  "an ancestor lead or owner is required":
    "An independent parent Lead or owner is required.",
  "an earlier approval stage must finish first":
    "An earlier approval stage must finish first.",
  "an independent ancestor lead or owner is required":
    "An independent ancestor Lead or owner is required.",
  "an independent appointed head is required to review your petty cash request":
    "An independent appointed Head is required to review your petty cash request.",
  "announcement title is required": "Enter an announcement title.",
  "annual budget not found": "The annual budget could not be found.",
  "application settings could not be loaded. retry before editing":
    "Application settings could not be loaded. Refresh before editing.",
  "application settings response could not be verified":
    "Application settings could not be verified. Refresh and try again.",
  "apply the hierarchical deadline database migration, then try again":
    "This feature isn't available yet because a system deadline update is missing.",
  "apply the office budget migration, then refresh this page":
    "Office budgets aren't available yet because a budget service update is missing.",
  "apply the subtask evidence-review database migration, then try again":
    "Subtask evidence review isn't available yet because a review service update is missing.",
  "appoint a different project lead before removing this person from the project team":
    "Appoint a different Project Lead before removing this person from the project team.",
  "appoint an independent project reviewer before requesting cash":
    "Appoint an independent project reviewer before requesting cash.",
  "appoint the project lead first": "Appoint the Project Lead first.",
  "appointed independent reviewer required":
    "An appointed independent reviewer is required.",
  "archive this project before publishing it":
    "Archive this project before publishing it.",
  "archived tasks cannot be reassigned":
    "Archived tasks cannot be reassigned.",
  "archived tasks cannot change status":
    "Archived tasks cannot change status.",
  "archived tasks cannot receive progress":
    "Archived tasks cannot receive progress updates.",
  "assign a responsible office before submitting this task":
    "Assign a responsible Office before submitting this task.",
  "assign a reviewer who is not the submitter before submitting":
    "Assign a reviewer who is not the submitter before submitting.",
  "assign a valid head for every normal task currently awaiting review":
    "Assign an active Head for every task currently awaiting review.",
  "assign an active head for the responsible office before submitting":
    "Assign an active Head for the responsible Office before submitting.",
  "assign an owner before moving to to do":
    "Assign an owner before moving this task to To do.",
  "assigned descendant work could not be loaded":
    "Assigned child work could not be loaded. Refresh and try again.",
  "assigned independent reviews could not be verified":
    "Assigned reviews could not be verified. Refresh and try again.",
  "assignee is not an active profile":
    "The selected assignee does not have an active profile.",
  "assignee is outside your organization scope":
    "The selected assignee is outside your Office scope.",
  "at least one evidence file is required for subtask review":
    "Attach at least one evidence file for subtask review.",
  "at most 10 evidence files are allowed per submission":
    "Attach at most 10 evidence files per submission.",
  "attach a file for every receipt row":
    "Attach a file for every receipt row.",
  "attach at least one evidence file": "Attach at least one evidence file.",
  "attach at least one receipt": "Attach at least one receipt.",
  "attachment metadata is invalid":
    "The selected attachment metadata is invalid.",
  "auto assign is for tasks that have not started and have no lead. existing assignments are kept":
    "Auto assign is only for unstarted tasks without a Lead.",
  "backup reviewer must be an active profile":
    "The backup reviewer must have an active profile.",
  "backup reviewer must differ from assignee and primary reviewer":
    "Backup reviewer must be different from the assignee and primary reviewer.",
  "branch staffing denied; ancestors and siblings are protected":
    "You can manage staffing only within your own branch.",
  "budget access denied": "You don't have permission to access this budget.",
  "budget amounts cannot be negative": "Budget amounts cannot be negative.",
  "budget line amount must be a positive amount with at most two decimal places":
    "Budget line amount must be positive with at most two decimal places.",
  "budget lines must be an array": "Enter valid budget lines.",
  "budget quantity and unit cost must be positive, finite and within their limits, with up to two decimal places":
    "Budget quantity and unit cost must be positive numbers with up to two decimal places.",
  "budget sections must equal the annual appropriation. use the section adjustment action":
    "Budget sections must equal the annual appropriation. Use the section adjustment action.",
  "cannot delete organization with assigned users. reassign users first":
    "Cannot delete an Office with assigned users. Reassign them first.",
  "cannot delete organization with child offices. remove or reassign children first":
    "Cannot delete an Office with child Offices. Reassign them first.",
  "cap amount must be greater than zero":
    "Enter a cap amount greater than zero.",
  "cash must be fiscally approved before release; a schedule override cannot approve funding":
    "Cash must be approved before release.",
  "cash must be marked released before acknowledgement":
    "Cash must be marked released before acknowledgement.",
  "cash release not found": "This cash release is no longer available.",
  "cash request not found": "This cash request is no longer available.",
  "cash requests require funding and requester departments":
    "Both funding and requesting Offices are required for this cash request.",
  "changing a cross-organization task leader requires approval from that employee's organization":
    "Changing a cross-Office Task Lead requires approval from that member's Office.",
  "child deadline cannot exceed an ancestor deadline":
    "Child deadline cannot exceed its parent deadline.",
  "choose 1 to 100 valid funding lines":
    "Choose 1 to 100 valid funding lines.",
  "choose a bounded work scope": "Choose a valid work scope.",
  "choose a budget particular from this task allocation":
    "Choose a funding source from this task allocation.",
  "choose a custom status after creating the work":
    "Create the work first before choosing a custom status.",
  "choose a date for every scheduled release":
    "Choose a date for every scheduled release.",
  "choose a due time that has not passed":
    "Choose a due date that has not passed.",
  "choose a group in this project": "Choose a group in this project.",
  "choose a joined collaborating office":
    "Choose a joined collaborating Office.",
  "choose a jpeg, png, or webp image":
    "Choose a JPEG, PNG, or WebP image.",
  "choose a lead and include them among contributors":
    "Choose a Lead and include them among contributors.",
  "choose a lead and task team": "Choose a Task Lead and team.",
  "choose a node in this root": "Choose an item within this task.",
  "choose a project funding source, positive amount and release reason":
    "Choose a project funding source, enter a positive amount, and add a reason.",
  "choose a proposed collaborating office for unstarted work":
    "Choose a collaborating Office for unstarted work.",
  "choose a proposed office responsibility":
    "Choose an Office responsibility.",
  "choose a ready project file and task":
    "Choose an uploaded project file and a task.",
  "choose a released leaf funding account from this office and a locked fiscal year":
    "Choose a released budget account from this Office and fiscal year.",
  "choose a review decision and provide a reason":
    "Choose a review decision and provide a reason.",
  "choose a settlement decision": "Choose a settlement decision.",
  "choose a supported reaction": "Choose a supported reaction.",
  "choose a valid path in this root": "Choose a valid position in this task.",
  "choose a valid priority": "Choose a valid priority.",
  "choose a valid schedule start date": "Choose a valid schedule start date.",
  "choose accounts, positive amounts, an authority reference and a command key":
    "Choose accounts, enter positive amounts, and enter an authority reference.",
  "choose active lead for unfinished work":
    "Choose an active Lead for unfinished work.",
  "choose active selected people from this project and responsible office":
    "Choose active project members from the responsible Office.",
  "choose active verified own-office people":
    "Choose active verified members of your Office.",
  "choose an active account for every journal line":
    "Choose an active account for every journal line.",
  "choose an active collaborating office": "Choose an active collaborating Office.",
  "choose an active expense account from the journal catalog":
    "Choose an active expense account from the journal catalog.",
  "choose an active independent reviewer":
    "Choose an active independent reviewer.",
  "choose an active lowest-level account from the funding office and fiscal year":
    "Choose an active budget account from the funding Office and fiscal year.",
  "choose an active participating office": "Choose an active participating Office.",
  "choose an active person in your own department":
    "Choose an active member of your own Office.",
  "choose an active project lead from the implementing office":
    "Choose an active Project Lead from the implementing Office.",
  "choose an active project member as lead":
    "Choose an active project member as Lead.",
  "choose an active project member as reviewer":
    "Choose an active project member as reviewer.",
  "choose an active sponsoring office with an appointed head":
    "Choose an active sponsoring Office with an appointed Head.",
  "choose an active verified own-office identity":
    "Choose an active verified member of your Office.",
  "choose an annual budget account for every funded line":
    "Choose an annual budget account for every funded line.",
  "choose an approved task or subtask budget":
    "Choose an approved task or subtask budget.",
  "choose an approved task or subtask budget allocation":
    "Choose an approved task or subtask budget allocation.",
  "choose an available project office and invitation type":
    "Choose an available project Office and invitation type.",
  "choose an available status for this work":
    "Choose an available status for this work.",
  "choose an eligible selected root lead":
    "Choose an eligible Lead from selected members.",
  "choose an existing active parent account":
    "Choose an existing active parent account.",
  "choose an existing active parent section":
    "Choose an existing active parent section.",
  "choose an existing active verified account. external people require head-approved invitations":
    "Choose an active verified account. External people require Head-approved invitations.",
  "choose an independent appointed head or assistant head from this office":
    "Choose an independent appointed Head from this Office.",
  "choose an office": "Choose an Office.",
  "choose an office that is still in this project":
    "Choose an Office that is still in this project.",
  "choose an uploaded chat photo": "Choose an uploaded chat photo.",
  "choose cash or cheque release": "Choose Cash or Cheque release.",
  "choose each active account once from this office and fiscal year":
    "Choose each active account only once for this Office and fiscal year.",
  "choose each source once and positive amounts in cents":
    "Choose each funding source only once and enter positive amounts.",
  "choose editors from the selected project team":
    "Choose editors from the selected project team.",
  "choose eligible project people": "Choose eligible project members.",
  "choose existing, available prerequisites from this project":
    "Choose existing prerequisites from this project.",
  "choose funding sources, amounts and a reason":
    "Choose funding sources, enter amounts, and provide a reason.",
  "choose people who joined the responsible project office":
    "Choose members who belong to the responsible Office.",
  "choose selected project people": "Choose members from this project team.",
  "choose the office to remove": "Choose the Office to remove.",
  "choose valid engagement and access-end terms":
    "Choose valid engagement and access-end dates.",
  "choose valid permission and future access terms":
    "Choose valid permission and future access dates.",
  "choose valid work submission terms":
    "Complete all required submission details before submitting.",
  "choose your canonical office workspace":
    "Switch to your Office workspace to continue.",
  "closed or governed project identities are read-only":
    "Closed or governed project identities cannot be edited.",
  "closed or unresolved work is read-only":
    "Closed or blocked work cannot be edited.",
  "closed project details are read-only":
    "Closed project details cannot be edited.",
  "closed project setup is read-only": "Closed project setup cannot be edited.",
  "closed project work is read-only": "Closed project work cannot be edited.",
  "closed work is read-only": "Closed work cannot be edited.",
  "comment cannot be empty": "Enter a comment before posting.",
  "complete all task dependencies before submitting for review":
    "Complete all prerequisite tasks before submitting for review.",
  "complete and review every descendant before completing the root":
    "Complete and approve every child subitem before completing this task.",
  "complete and review every descendant first":
    "Complete and approve every child subitem first.",
  "complete every subitem before submitting the parent task":
    "Complete every subitem before submitting the parent task.",
  "complete the project before archiving it":
    "Complete the project before archiving it.",
  "completed or archived work is read-only":
    "Completed or archived work cannot be edited.",
  "completed or cancelled tasks cannot be cancelled":
    "Completed or cancelled tasks cannot be cancelled.",
  "completed responsibility is historical":
    "Completed work responsibility cannot be changed.",
  "completion attachment does not belong to this request":
    "One or more attachments don't belong to this submission.",
  "completion checks belong to another project":
    "Completion checks belong to another project.",
  "completion checks returned an invalid result":
    "Completion checks could not be verified. Refresh and try again.",
  "completion note must be 5,000 characters or fewer":
    "Completion note must be 5,000 characters or fewer.",
  "completion request terms changed":
    "Submission details changed. Review and submit again.",
  "computed budget line total exceeds its allowed amount":
    "Budget line total exceeds its allowed amount.",
  "confirm or remove every proposed office responsibility first":
    "Confirm or remove every proposed Office responsibility first.",
  "confirm releases on an active account in a locked budget":
    "Confirm releases on an active account in a locked budget.",
  "confirm the project title and enter a reason":
    "Confirm the project title and enter a reason.",
  "confirmed member removal cannot change work facts or unrelated staffing":
    "Member removal cannot change work details or unrelated staffing.",
  "confirmed member removal permits only its exact current staffing cleanup":
    "Membership changed. Refresh the impact preview and try again.",
  "confirmed releases must remain in the history":
    "Confirmed releases must remain in the history.",
  "conversation unavailable": "This conversation is no longer available.",
  "correct this multi-account request through its funding lines":
    "Correct this request using its individual funding lines.",
  "could not load the authorized project library":
    "Could not load the project library. Refresh and try again.",
  "could not verify complete report facts":
    "Could not verify complete report facts. Try again.",
  "could not verify subitem history":
    "Could not verify subitem history. Refresh and try again.",
  "could not verify the current task status":
    "Could not verify the current task status. Refresh and try again.",
  "could not verify the current work impact":
    "Could not verify the current work impact. Refresh and try again.",
  "could not verify the current work tree":
    "Could not verify the current work tree. Refresh and try again.",
  "could not verify the responsible office and project for this recommendation":
    "Could not verify the responsible Office and project.",
  "create the project in planning, then review readiness":
    "Create the project in Planning first, then review readiness.",
  "cross-organization staffing changes require approval from the employee's organization":
    "Cross-Office staffing changes require approval from the member's Office.",
  "current accounting and review authority required":
    "Current Accounting and review authority is required.",
  "current accounting release authority required":
    "Current Accounting release authority is required.",
  "current appointed office head required":
    "Only the current appointed Office Head can perform this action.",
  "current assigned worker required":
    "You must be currently assigned to this work.",
  "current authority changed during confirmation. review current work again":
    "Your access changed while confirming. Refresh and review the work again.",
  "current confirmed removal authority required":
    "You no longer have authority to confirm this member removal.",
  "current head or independent leadership approval is required before settlement":
    "Current Head or independent leadership approval is required before settlement.",
  "current independent accounting and review authority required":
    "Current independent Accounting and review authority is required.",
  "current independent head or assistant head approval is required before settlement":
    "Current independent Head approval is required before settlement.",
  "current independent review authority required":
    "Current independent review authority is required.",
  "current independent reviewer required":
    "An independent reviewer is required.",
  "current office head access required":
    "Current Office Head access is required.",
  "current own office head required":
    "Current own Office Head access is required.",
  "current owner or scoped lead and a designated sponsoring office are required":
    "A Lead and sponsoring Office are required.",
  "current private project access required":
    "Current access to this private project is required.",
  "current project access required": "Current project access is required.",
  "current project lead or head required":
    "Only the Project Lead or Office Head can do this.",
  "current project lead required": "Only the Project Lead can do this.",
  "current project planning authority required":
    "Current project planning authority is required.",
  "current removal authority required":
    "You no longer have authority to remove this member.",
  "current request uploader or active recipient required":
    "Only the requester or active recipient can view this.",
  "current responsible office head or personal workspace owner required":
    "Current responsible Office Head or workspace owner access is required.",
  "current review authority required": "Current review authority is required.",
  "current root lead or head required for flat planning":
    "Current Task Lead or Office Head access is required.",
  "current sharing authority required":
    "You no longer have authority to share access.",
  "current subitem lead or task lead authority required":
    "Only the Subitem Lead or Task Lead can do this.",
  "current task lead required": "Only the Task Lead can do this.",
  "current task or subitem lead required":
    "Only the Task Lead or Subitem Lead can do this.",
  "current task team access required": "Current task team access is required.",
  "current verified operational identity required":
    "An active verified operational account is required.",
  "current work access required": "Current access to this work is required.",
  "custom statuses are available for active project work":
    "Custom statuses are available only for active project work.",
  "daily release ceiling exceeded": "Daily cash release limit exceeded.",
  "daily release limit must be greater than zero":
    "Daily release limit must be greater than zero.",
  "deactivated or non-operational identity requires admin resolution":
    "This deactivated account requires Admin resolution.",
  "delegation history could not be verified":
    "Delegation history could not be verified.",
  "delete the reviewed subtree through the nested work action":
    "Delete reviewed work through the subitem removal action.",
  "deletion reason is required": "Enter a reason for deleting.",
  "dependencies cannot form a circular chain":
    "Dependencies cannot form a circular chain.",
  "dependencies cannot form a cycle": "Dependencies cannot form a cycle.",
  "dependencies must be other available tasks in this project":
    "Dependencies must be other available tasks in this project.",
  "describe what this cash will purchase":
    "Describe what this cash will purchase.",
  "destination branch denied or cycle":
    "This work cannot be moved into itself or a child item.",
  "destination must share the root": "Items can only be moved within the same task.",
  "detailed sections get their subtotal from their children":
    "Detailed sections get their subtotal from their children.",
  "direct subtask check-off is disabled. open the subtask and submit evidence for independent review":
    "Direct check-off is disabled. Open the subtask and submit evidence for independent review.",
  "draft access denied": "You don't have access to this draft.",
  "draft work access denied": "You don't have access to this draft work.",
  "duplicate receipt": "Duplicate receipt found. Remove the duplicate entry.",
  "each criterion must contain 1 to 1,000 characters":
    "Each criterion must be 1 to 1,000 characters.",
  "each item needs quantity, unit, particulars, purpose and a positive line amount":
    "Each item needs quantity, unit, particulars, purpose, and a positive amount.",
  "each journal line must contain either a debit or a credit":
    "Each journal line must contain either a debit or a credit.",
  "each office selects its own project personnel":
    "Each Office selects its own project personnel.",
  "each receipt must be greater than zero and at most php 5,000":
    "Each receipt must be greater than zero and at most PHP 5,000.",
  "each receipt needs one unique evidence path and valid purchased items":
    "Each receipt needs its own uploaded file and valid purchased items.",
  "each reordered subtask must belong to the same parent task":
    "All reordered subtasks must belong to the same parent task.",
  "each scheduled release needs a unique id":
    "Each scheduled release needs a valid entry.",
  "edit descendant dates before shortening this deadline":
    "Shorten or adjust child subitem due dates before moving this deadline earlier.",
  "editing access for this project is required":
    "Editing access for this project is required.",
  "effort must be between 0 and 10000":
    "Estimated hours must be between 0 and 10,000.",
  "effort must be between 0 and 100000 hours":
    "Estimated hours must be between 0 and 100,000.",
  "enter a clear reason for this cross-organization grant":
    "Enter a clear reason for this cross-Office access grant.",
  "enter a group name (up to 120 characters)":
    "Enter a group name (up to 120 characters).",
  "enter a positive amount and purchase purpose":
    "Enter a positive amount and purchase purpose.",
  "enter a positive amount and purpose": "Enter a positive amount and purpose.",
  "enter a positive amount and reason": "Enter a positive amount and reason.",
  "enter a positive amount in cents": "Enter a positive amount.",
  "enter a positive amount in cents and a quarter from q1 to q4":
    "Enter a positive amount and select a quarter.",
  "enter a positive release amount in pesos and cents":
    "Enter a positive release amount.",
  "enter a project name": "Enter a project name.",
  "enter a project name up to 200 characters":
    "Enter a project name up to 200 characters.",
  "enter a project title up to 200 characters; description and scope may each contain up to 12000 characters":
    "Enter a project title up to 200 characters and keep description and scope within 12,000 characters.",
  "enter a purchase purpose and request key":
    "Describe what this cash will purchase.",
  "enter a purpose, decision reason or transaction reference":
    "Enter a purpose, decision reason, or transaction reference.",
  "enter a q4 target from 0 to 100 percent":
    "Enter a Q4 target from 0 to 100 percent.",
  "enter a reason (3–1,000 characters)":
    "Enter a reason between 3 and 1,000 characters.",
  "enter a subitem title": "Enter a subitem title.",
  "enter a title": "Enter a title.",
  "enter a valid adjusted amount and reason":
    "Enter a valid adjusted amount and reason.",
  "enter a valid amount": "Enter a valid amount.",
  "enter a valid due date and time": "Enter a valid due date.",
  "enter a valid email address": "Enter a valid email address.",
  "enter an office name within 200 characters":
    "Enter an Office name within 200 characters.",
  "enter each subitem name": "Enter a name for each subitem.",
  "enter positive amounts in cents": "Enter positive amounts.",
  "enter receipt vendor, number and valid date":
    "Enter receipt vendor, number, and valid date.",
  "enter task names and descriptions within their limits":
    "Keep task names and descriptions within their character limits.",
  "enter the cheque number before release":
    "Enter the cheque number before releasing.",
  "enter the official refund receipt number and return date for unused cash":
    "Enter the official refund receipt number and return date for unused cash.",
  "enter the release reference or note":
    "Enter the release reference or note.",
  "estimated hours must be between 0 and 10000":
    "Estimated hours must be between 0 and 10,000.",
  "every budget amount must be greater than zero. fill in or remove zero-amount rows before locking":
    "Every budget amount must be greater than zero. Fill in or remove zero-amount rows before locking.",
  "every budget line needs an expense class, category, particular, and fund source":
    "Every budget line needs an expense class, category, particular, and fund source.",
  "every project member must be an active eflow user":
    "Every project member must be an active eFlow user.",
  "every project milestone must be included once":
    "Every project milestone must be included once.",
  "every reordered subtask must belong to the same parent task":
    "All reordered subtasks must belong to the same parent task.",
  "every subtask must be approved before the parent task can be submitted":
    "Every subtask must be approved before the parent task can be submitted.",
  "every supplied subtask must belong to the same parent task":
    "Every subtask must belong to the same parent task.",
  "evidence file is missing or was not uploaded by you":
    "This evidence file is missing or was not uploaded by you.",
  "evidence filename is required": "An evidence filename is required.",
  "evidence is already finalized or claimed for cleanup; upload a new file":
    "This upload can no longer be attached. Upload a new file.",
  "evidence must be attached by its submitter in the submission transaction":
    "Evidence files must be uploaded by the person submitting the work.",
  "evidence must be nonempty and no larger than 50 mib":
    "Each evidence file must be non-empty and 50 MB or smaller.",
  "evidence path does not belong to this task and attempt":
    "This evidence upload doesn't match the current task submission. Upload again.",
  "evidence subtask mismatch":
    "This evidence upload doesn't belong to this subtask.",
  "evidence, budget and cash history prohibit subtree deletion":
    "This item has evidence, budget, or cash history and cannot be deleted.",
  "evidence, progress, budget and cash history prevent deletion":
    "This work has progress, evidence, budget, or cash history and cannot be deleted.",
  "execution mode cannot change after subtask work has started":
    "Execution rule cannot change after subtask work has started.",
  "expiration date cannot be in the past or before publication":
    "Expiration date cannot be in the past.",
  "explain every receipt above the configured threshold":
    "Add a justification for every receipt above the threshold.",
  "explain the schedule override in 10 to 1000 characters":
    "Explain the schedule override in 10 to 1,000 characters.",
  "explain the schedule override in at least 10 characters":
    "Explain the schedule override in at least 10 characters.",
  "explain what the employee must change":
    "Explain what needs to be changed.",
  "explain what the petty cash will be used for":
    "Explain what the petty cash will be used for.",
  "explain why the cap is being removed":
    "Explain why this subtask cap is being removed.",
  "explain why this subtask needs a protected cap":
    "Explain why this subtask needs a protected spending cap.",
  "explicitly renew ended access terms in members before selecting that person":
    "Renew ended access terms in Members before selecting this person.",
  "external editing membership requires r8 sponsoring head approval":
    "External editing membership requires sponsoring Head approval.",
  "external personal shares require the designated sponsoring head":
    "External personal shares require the designated sponsoring Head.",
  "failed to assign subtask": "Could not assign this subtask.",
  "feedback is required when requesting changes":
    "Feedback is required when requesting changes.",
  "feedback required": "Enter feedback before sending back for changes.",
  "file history actor required":
    "Sign in again to view or update file history.",
  "file removal denied": "You don't have permission to remove this file.",
  "file unavailable": "This file is no longer available.",
  "finalized evidence cannot be deleted":
    "Finalized evidence cannot be deleted.",
  "financial audit ledger entries are append-only":
    "Financial audit ledger entries cannot be altered.",
  "finish project details and funding setup before activation":
    "Finish project details and funding setup before activation.",
  "finish work and required independent reviews before closeout":
    "Finish all work and required independent reviews before closeout.",
  "fiscal budget not found": "Fiscal budget not found.",
  "funded task and task leader required":
    "A funded task with a Task Lead is required.",
  "funded task not found": "The funded task was not found.",
  "funded tasks need source cost lines": "Funded tasks need source cost lines.",
  "funding breakdown does not match the request payload":
    "Funding breakdown does not match the total requested.",
  "funding lines must equal the final cash request amount":
    "Funding lines must equal the cash request amount.",
  "funding request terms changed":
    "Funding request terms changed. Refresh and review before deciding.",
  "getting started could not be loaded. please try again later":
    "Getting Started could not be loaded. Try again later.",
  "give a reason for declining funding": "Give a reason for declining funding.",
  "give every account a valid id and name":
    "Give every account a valid ID and name.",
  "give every section a valid id and name":
    "Give every section a valid ID and name.",
  "group chat unavailable": "This group chat is no longer available.",
  "group not available": "This group is no longer available.",
  "guest renewal requires a new sponsoring head-approved invitation":
    "Guest renewal requires a new sponsoring Head-approved invitation.",
  "head and assistant head must be different people":
    "Head and Assistant Head must be different people.",
  "head may invite only member or accounting staff":
    "A Head can invite only Member or Accounting Staff accounts.",
  "heads create office work. admin manages accounts":
    "Office Heads create Office work.",
  "history access or source records changed. refresh history":
    "History records changed. Refresh and check again.",
  "history snapshot changed. refresh history":
    "History snapshot changed. Refresh history.",
  "history snapshot expired or changed. refresh history":
    "History snapshot changed. Refresh history.",
  "import receipt was not confirmed. resume this saved import to check it safely":
    "Import receipt was not confirmed. Check the saved import before retrying.",
  "include the appointed lead in contributors":
    "Include the appointed Lead among contributors.",
  "include the root lead in contributors":
    "Include the Task Lead among contributors.",
  "independent appointed head review required":
    "An independent appointed Head review is required.",
  "independent approval is already recorded; verify settlement readiness":
    "Independent approval is already recorded. Refresh settlement readiness.",
  "independent financial approval required":
    "Independent financial approval is required.",
  "independent receipt endorsement required before settlement":
    "Independent receipt endorsement is required before settlement.",
  "independent review access denied":
    "Independent review access denied.",
  "independent review could not be verified. refresh before deciding":
    "Independent review could not be verified. Refresh before deciding.",
  "independent review routing denied":
    "Independent review routing is unavailable.",
  "independent reviewer cannot review own work":
    "An independent reviewer cannot review their own work.",
  "insufficient released office budget":
    "Insufficient released Office budget.",
  "invalid activity date": "Enter a valid activity date.",
  "invalid assigned review scope. refresh your inbox":
    "Review scope changed. Refresh your Inbox.",
  "invalid assignment task reference": "Select a valid task.",
  "invalid batch size": "Choose a valid number of items.",
  "invalid budget estimate": "Enter a valid budget estimate.",
  "invalid completion details": "Complete all required completion details.",
  "invalid current-reviewer response":
    "Could not verify the current reviewer. Refresh and try again.",
  "invalid decision": "Choose a valid decision.",
  "invalid dependency list": "Choose valid prerequisite tasks.",
  "invalid expiry": "Choose a valid expiration date.",
  "invalid final request total": "The total requested amount is invalid.",
  "invalid fiscal year": "Choose a valid fiscal year.",
  "invalid fiscal year or section version":
    "Budget year or version changed. Refresh and try again.",
  "invalid historical work context received":
    "Work history context changed. Refresh and try again.",
  "invalid history event received":
    "Work history changed. Refresh and try again.",
  "invalid invitation": "This invitation is invalid.",
  "invalid invitation details": "Check the invitation details.",
  "invalid invitation fields": "Check the invitation details.",
  "invalid invitation: office already linked or accepted":
    "This Office is already linked or accepted.",
  "invalid invitation: closed or governed project":
    "Invitations cannot be sent for a closed project.",
  "invalid invitation: use the linked office participation":
    "Use the linked Office participation for this invitation.",
  "invalid member selection": "Select valid members.",
  "invalid members response":
    "Could not load project members. Refresh and try again.",
  "invalid membership terms": "Choose valid membership terms.",
  "invalid message type": "Choose a supported message type.",
  "invalid new message": "Enter a valid message.",
  "invalid personal project response":
    "Could not load this project. Refresh and try again.",
  "invalid priority": "Choose a valid priority.",
  "invalid project access response":
    "Could not verify project access. Refresh and try again.",
  "invalid project date": "Enter valid project dates.",
  "invalid project draft creation request":
    "Complete required project details before creating.",
  "invalid project priority": "Choose a valid project priority.",
  "invalid project status": "Choose a valid project status.",
  "invalid project task draft": "Complete required task details.",
  "invalid project title": "Enter a valid project title.",
  "invalid release status": "Choose a valid release status.",
  "invalid removal impact. refresh before confirming":
    "Membership impact changed. Refresh before confirming.",
  "invalid request": "Check your entries and try again.",
  "invalid review decision": "Choose a valid review decision.",
  "invalid selection impact. reload before saving":
    "Selection impact changed. Reload before saving.",
  "invalid task changes": "Check your task changes before saving.",
  "invalid task priority": "Choose a valid task priority.",
  "invalid task title": "Enter a valid task title.",
  "invalid work command or payload":
    "Work action details changed. Refresh and try again.",
  "invalid workspace name or timezone":
    "Enter a valid workspace name and timezone.",
  "invalid workspace response":
    "Could not load workspaces. Refresh and try again.",
  "invalid workspace selection response":
    "Could not switch workspaces. Refresh and try again.",
  "invalid workspace timezone": "Choose a valid timezone.",
  "invitation already pending": "An invitation is already pending.",
  "invitation already pending. resend or revoke it":
    "An invitation is already pending. Resend or revoke it.",
  "invitation cannot be sent with your current authority. review its saved status":
    "Invitation cannot be sent with your current authority. Review its saved status.",
  "invitation expired, revoked or authority changed":
    "This invitation expired, was revoked, or authority changed.",
  "invitation expired, revoked or unavailable":
    "This invitation has expired, been revoked, or is no longer available.",
  "invitation expired, revoked, or invalid":
    "This invitation has expired, been revoked, or is invalid.",
  "invitation limit reached. please try again later":
    "Invitation limit reached. Try again later.",
  "invitation limit reached. please try later":
    "Invitation limit reached. Try again later.",
  "invitation request limit; please wait before requesting more":
    "Invitation limit reached. Please wait before requesting more.",
  "invitation resend limit or invalid lifetime":
    "Resend limit reached or invalid invitation expiry.",
  "inviter no longer leads this office":
    "The inviter no longer leads this Office.",
  "inviter no longer leads this office. request a new invitation":
    "The inviter no longer leads this Office. Request a new invitation.",
  "issuer authority changed. request a fresh authorized share offer":
    "Issuer authority changed. Request a fresh share offer.",
  "issuer identity is no longer eligible. request fresh approval":
    "Issuer identity is no longer eligible. Request fresh approval.",
  "item totals must equal each receipt total":
    "Purchased item totals must equal each receipt total.",
  "journal amounts must be finite nonnegative amounts with at most two decimal places":
    "Journal amounts must be non-negative numbers with up to two decimal places.",
  "journal debits and credits must balance":
    "Journal debits and credits must balance.",
  "journal debits and credits must balance exactly":
    "Journal debits and credits must balance exactly.",
  "keep accounts with pending or confirmed releases in the budget":
    "Keep accounts with pending or confirmed releases in the budget.",
  "keep the default project group": "Keep the default project group.",
  "keep the existing task contributors": "Keep the existing task contributors.",
  "late liquidation requires independent office head authorization before accounting settlement":
    "Late liquidation requires independent Office Head authorization before accounting settlement.",
  "lead appointed, but the task could not refresh. close and reload; do not appoint again":
    "Lead appointed, but the task could not refresh. Close and reload instead of submitting again.",
  "leader review and department settlement must be performed by different people":
    "Leader review and department settlement must be performed by different people.",
  "link the office and obtain its head confirmation first":
    "Link the Office and obtain its Head confirmation first.",
  "linked office identity cannot be renamed":
    "A linked Office cannot be renamed.",
  "linked office identity cannot be replaced":
    "A linked Office cannot be replaced.",
  "liquidation due days must be between 1 and 90":
    "Liquidation due days must be between 1 and 90.",
  "liquidation key belongs to a different refund reference; submit a correction version":
    "Your liquidation details changed after the previous attempt. Start a fresh submission to retry.",
  "liquidation key belongs to different receipt items":
    "Your liquidation receipt items changed after the previous attempt. Start a fresh submission to retry.",
  "liquidation key belongs to different submitted amounts, notes or receipts; submit a correction version":
    "Your liquidation details changed after the previous attempt. Start a fresh submission to retry.",
  "liquidation not found": "This liquidation could not be found.",
  "liquidation unavailable": "This liquidation is no longer available.",
  "list purchased items for every expense receipt":
    "List purchased items for every expense receipt.",
  "lock this fiscal year budget first": "Lock this fiscal year budget first.",
  "manage this account in user management → project guests and enter a reason":
    "Manage this account in Project guests and enter a reason.",
  "mandatory office head ownership needs an appointed replacement before removal":
    "Office Head ownership needs an appointed replacement before removal.",
  "map every purchased-item source to an active journal expense account before settlement":
    "Map every purchased-item source to an active journal expense account before settlement.",
  "maximum subitem depth is 8": "Maximum subitem depth is 8 levels.",
  "member removal changed protected work facts":
    "Work facts changed during member removal. Refresh and check again.",
  "members must belong to the lead office or have its approved guest membership. other offices select their own personnel":
    "Members must belong to the Lead Office or have approved guest membership.",
  "membership or assignments changed. refresh selection impact":
    "Membership or assignments changed. Refresh selection impact.",
  "membership or assignments changed. refresh the impact preview before confirming":
    "Membership or assignments changed. Refresh the impact preview before confirming.",
  "message is required": "Enter a message.",
  "message unavailable": "This message is no longer available.",
  "milestone title is required": "Enter a milestone title.",
  "missing access receipt. retry the same operation":
    "Confirmation was not received. Retry the same operation.",
  "missing grant receipt. keep this draft and retry":
    "Confirmation was not received. Keep this draft and retry.",
  "missing membership receipt. retry the same request before editing":
    "Confirmation was not received. Retry the same request before editing.",
  "missing removal receipt. retry this request":
    "Confirmation was not received. Retry this request.",
  "missing saved member receipt. reload members before trying again":
    "Confirmation was not received. Reload Members before trying again.",
  "missing selection receipt. retry the original request":
    "Confirmation was not received. Retry the original request.",
  "move archived tasks out of this group before deleting it":
    "Move archived tasks out of this group before deleting it.",
  "move the tasks before deleting this group":
    "Move all tasks out of this group before deleting it.",
  "needed-by date cannot be earlier than today":
    "Needed-by date cannot be earlier than today.",
  "needs reassignment: appoint an active selected task lead before execution":
    "Appoint an active selected Task Lead before starting work.",
  "nested delegation requires a project root":
    "Nested subitems require a parent project task.",
  "nested work access denied": "You don't have access to this subitem.",
  "new project dates cannot be in the past":
    "New project dates cannot be in the past.",
  "no eligible team leader or task reviewer is available":
    "No eligible Team Leader or reviewer is available.",
  "no file receipt was returned. retry this operation":
    "File upload was not confirmed. Retry this operation.",
  "no independent project reviewer is available for this cash request":
    "No independent project reviewer is available for this cash request.",
  "no independent reviewer is available. appoint a project lead or an independent head before submitting":
    "No independent reviewer is available. Appoint a Project Lead or independent Head before submitting.",
  "no profile changes were provided": "No profile changes were provided.",
  "no review submission exists": "No review submission was found.",
  "not allowed to archive this task": "You're not allowed to archive this task.",
  "not allowed to assign this task": "You're not allowed to assign this task.",
  "not allowed to cancel this task": "You're not allowed to cancel this task.",
  "not allowed to delete this task": "You're not allowed to delete this task.",
  "not allowed to request changes": "You're not allowed to request changes.",
  "not authenticated": "Your session expired. Sign in again.",
  "observer and other office access is read-only":
    "Observer and other Office access is read-only.",
  "office already joined or awaits its head":
    "This Office has already joined or awaits its Head's confirmation.",
  "office budget has insufficient available funding":
    "Office budget has insufficient available funding.",
  "office financial scope could not be verified. retry budget facts":
    "Office financial scope could not be verified. Refresh budget details.",
  "office handover requires an unstarted, unassigned task without staffed or started subitems":
    "Office handover requires an unstarted, unassigned task without staffed or started subitems.",
  "office handover requires unstarted, unassigned work":
    "Office handover requires unstarted, unassigned work.",
  "office handover requires unstarted, unassigned work without staffed or started subitems":
    "Office handover requires unstarted, unassigned work without staffed or started subitems.",
  "office identity belongs to another project":
    "This Office identity belongs to another project.",
  "office invitation access denied":
    "You don't have permission for this Office invitation.",
  "office invitations must be accepted before assignment":
    "The Office invitation must be accepted before assigning work.",
  "office leadership accepts only a head":
    "Office leadership accepts only an appointed Head.",
  "office not found or inactive": "This Office was not found or is inactive.",
  "office references must be unique": "Office references must be unique.",
  "office task access required": "Office task access is required.",
  "only a current lead may add work below their branch":
    "Only a current Lead can add subitems under their branch.",
  "only a current subitem lead or task lead may complete this step; finish earlier and child steps first":
    "Only the Subitem Lead or Task Lead can complete this step after finishing earlier and child steps.",
  "only a head, member, or admin may permanently delete a project":
    "Only a Head or authorized project owner can permanently delete a project.",
  "only a locked annual budget can be adjusted":
    "Only a locked annual budget can be adjusted.",
  "only a locked annual budget can be closed":
    "Only a locked annual budget can be closed.",
  "only a manager may assign work": "Only an authorized Lead or Head can assign work.",
  "only a manager may reopen a completed task":
    "Only an authorized Lead or Head can reopen completed work.",
  "only a pending or awaiting-head office invitation can be withdrawn":
    "Only a pending Office invitation can be withdrawn.",
  "only a reviewer may decide a review":
    "Only the assigned reviewer can decide this review.",
  "only a task lead may edit or reassign a subtask":
    "Only the Task Lead can edit or reassign a subtask.",
  "only a task lead may edit, reassign, or change the execution rule of a subtask":
    "Only the Task Lead can edit, reassign, or change a subtask's execution rule.",
  "only a task participant may post progress":
    "Only an assigned participant can post progress.",
  "only a task participant may start work":
    "Only an assigned participant can start work.",
  "only accounting can confirm a release. confirmed releases cannot be edited":
    "Only Accounting can confirm a release. Confirmed releases cannot be edited.",
  "only accounting can record release confirmation":
    "Only Accounting can record release confirmation.",
  "only an active head for this project can check deletion":
    "Only an active Head for this project can check deletion.",
  "only an active head may permanently delete a project":
    "Only an active Head may permanently delete a project.",
  "only an authorized office head can edit project planning":
    "Only an authorized Office Head can edit project planning.",
  "only an authorized project manager can complete or archive this project":
    "Only an authorized project lead or Head can complete or archive this project.",
  "only an authorized requester correction can change cash request details":
    "Only the requester can correct this cash request.",
  "only approved, funded requests can be released":
    "Only approved, funded requests can be released.",
  "only authorized accounting staff can record a cash release":
    "Only authorized Accounting Staff can record a cash release.",
  "only authorized accounting staff can record a release":
    "Only authorized Accounting Staff can record a release.",
  "only department accounting staff, the head, or assistant head can settle this liquidation":
    "Only Accounting Staff or the Office Head can settle this liquidation.",
  "only in-progress work can be submitted":
    "Only in-progress work can be submitted for review.",
  "only its responsible head or personal owner transfers the root":
    "Only the responsible Head or owner can transfer the Task Lead.",
  "only joined, non-observer offices can select project members":
    "Only joined, non-observer Offices can select project members.",
  "only the active cash recipient can submit purchased items":
    "Only the active cash recipient can submit purchased items.",
  "only the active cash recipient can submit this liquidation":
    "Only the active cash recipient can submit this liquidation.",
  "only the appointed active office head may invite":
    "Only the appointed Office Head may send invitations.",
  "only the appointed head can add setup tasks":
    "Only the appointed Head can add setup tasks.",
  "only the appointed head can approve project completion":
    "Only the appointed Head can approve project completion.",
  "only the appointed head can change editing access for this project team":
    "Only the appointed Head can change editing access for this project team.",
  "only the appointed head can publish this project":
    "Only the appointed Head can publish this project.",
  "only the appointed head can save project setup":
    "Only the appointed Head can save project setup.",
  "only the appointed head may authorize funding for an open project":
    "Only the appointed Head may authorize funding for an open project.",
  "only the appointed head may authorize project setup":
    "Only the appointed Head may authorize project setup.",
  "only the appointed head may finish setup":
    "Only the appointed Head may finish project setup.",
  "only the appointed head may release unused project funding":
    "Only the appointed Head may release unused project funding.",
  "only the appointed head of the lead office can edit this project":
    "Only the appointed Head of the Lead Office can edit this project.",
  "only the appointed lead office head can invite offices":
    "Only the appointed Lead Office Head can invite Offices.",
  "only the appointed lead office head can manage office identities":
    "Only the appointed Lead Office Head can manage Office identities.",
  "only the appointed lead office head or personal workspace owner can share an open project":
    "Only the Lead Office Head or workspace owner can share this project.",
  "only the appointed office head can confirm this collaboration":
    "Only the appointed Office Head can confirm this collaboration.",
  "only the appointed office head can create a planning project":
    "Only the appointed Office Head can create a Planning project.",
  "only the appointed office head can create a project draft":
    "Only the appointed Office Head can create a project draft.",
  "only the appointed office head can select a private project team":
    "Only the appointed Office Head can select a private project team.",
  "only the appointed office head can select its own project members":
    "Only the appointed Office Head can select project members.",
  "only the appointed responsible head transfers the root lead; contributors use the narrow operation":
    "Only the responsible Head transfers the Task Lead.",
  "only the assigned department head can adjust the annual budget":
    "Only the assigned Office Head can adjust the annual budget.",
  "only the assigned department head can close the fiscal year":
    "Only the assigned Office Head can close the fiscal year.",
  "only the assigned department head can create the annual budget":
    "Only the assigned Office Head can create the annual budget.",
  "only the assigned head can prepare or adjust budget sections":
    "Only the assigned Head can prepare or adjust budget sections.",
  "only the assigned independent reviewer may decide this package":
    "Only the assigned independent reviewer can decide this package.",
  "only the assigned reviewer may decide this submission":
    "Only the assigned reviewer can decide this submission.",
  "only the assigned team leader can endorse this request":
    "Only the assigned Team Leader can endorse this request.",
  "only the assigned team leader can review this liquidation":
    "Only the assigned Team Leader can review this liquidation.",
  "only the assigned team leader may review this subtask":
    "Only the assigned Team Leader can review this subtask.",
  "only the assignee may resume rework": "Only the assignee can resume rework.",
  "only the assignee may start work": "Only the assignee can start work.",
  "only the assignee may submit for review":
    "Only the assignee can submit work for review.",
  "only the cash recipient can acknowledge this release":
    "Only the cash recipient can acknowledge this release.",
  "only the cash recipient can submit purchased items":
    "Only the cash recipient can submit purchased items.",
  "only the cash recipient can submit this liquidation":
    "Only the cash recipient can submit this liquidation.",
  "only the chat lead can edit this group": "Only the chat lead can edit this group.",
  "only the current appointed head of this office can select project members":
    "Only the current appointed Head of this Office can select project members.",
  "only the current appointed sponsoring head can decide":
    "Only the current sponsoring Head can decide this invitation.",
  "only the current independent project reviewer may decide this task":
    "Only the current independent project reviewer can decide this task.",
  "only the department accounting staff, head, or assistant head can record a release":
    "Only Accounting Staff or the Office Head can record a release.",
  "only the department head can lock this budget":
    "Only the Office Head can lock this budget.",
  "only the department head can manage department accounting access":
    "Only the Office Head can manage accounting access.",
  "only the designated reviewer may decide a review":
    "Only the designated reviewer can decide a review.",
  "only the effective task leader may submit the parent task":
    "Only the current Task Lead can submit the parent task.",
  "only the head can manage department accounting access":
    "Only the Office Head can manage accounting access.",
  "only the head or assistant head can allocate a task budget":
    "Only the Office Head can allocate a task budget.",
  "only the head or assistant head can decide this allocation":
    "Only the Office Head can decide this allocation.",
  "only the head or assistant head can decide this request":
    "Only the Office Head can decide this request.",
  "only the head or assistant head can record a cash release":
    "Only the Office Head can record a cash release.",
  "only the head or assistant head can settle this liquidation":
    "Only the Office Head can settle this liquidation.",
  "only the head or assistant head can verify this liquidation":
    "Only the Office Head can verify this liquidation.",
  "only the lead head can activate this project":
    "Only the Lead Head can activate this project.",
  "only the lead head can restore this project":
    "Only the Lead Head can restore this project.",
  "only the lead office head can organize shared project groups":
    "Only the Lead Office Head can organize project groups.",
  "only the lead office head can set responsibility":
    "Only the Lead Office Head can set responsibility.",
  "only the lead office head can withdraw an office invitation":
    "Only the Lead Office Head can withdraw an Office invitation.",
  "only the notified office head who reviewed the receipts may approve this escalation":
    "Only the Office Head who reviewed the receipts can approve this.",
  "only the office accounting officer can confirm availability":
    "Only the Office Accounting Officer can confirm availability.",
  "only the office head can order project work":
    "Only the Office Head can reorder project work.",
  "only the office head can prepare or readjust this budget":
    "Only the Office Head can prepare or adjust this budget.",
  "only the office head may authorize late liquidation":
    "Only the Office Head may authorize late liquidation.",
  "only the original submitter can retry this liquidation":
    "Only the original submitter can retry this liquidation.",
  "only the owning office head can activate this project":
    "Only the owning Office Head can activate this project.",
  "only the owning office head can publish":
    "Only the owning Office Head can publish this project.",
  "only the project head can delete groups":
    "Only the Project Head can delete groups.",
  "only the recipient can submit receipts for released cash":
    "Only the recipient can submit receipts for released cash.",
  "only the requester can attach purchase evidence":
    "Only the requester can attach purchase evidence.",
  "only the requester can cancel unreleased cash":
    "Only the requester can cancel unreleased cash.",
  "only the requester can correct this request":
    "Only the requester can correct this cash request.",
  "only the requester can submit this liquidation":
    "Only the requester can submit this liquidation.",
  "only the requester or a fiscal approver can cancel this request":
    "Only the requester or an approver can cancel this request.",
  "only the responsible office head can auto assign work":
    "Only the responsible Office Head can auto-assign work.",
  "only the responsible office head can change this task schedule":
    "Only the responsible Office Head can change this task schedule.",
  "only the responsible office head can choose its employees":
    "Only the responsible Office Head can select members.",
  "only the responsible office head can create work":
    "Only the responsible Office Head can create work.",
  "only the responsible office head can edit project structure":
    "Only the responsible Office Head can edit project structure.",
  "only the responsible office head can fund this work":
    "Only the responsible Office Head can fund this work.",
  "only the responsible office head can import project work":
    "Only the responsible Office Head can import project work.",
  "only the task lead or an authorized manager can reorder subtasks":
    "Only the Task Lead or Head can reorder subtasks.",
  "only the task lead or an authorized manager may change a subtask deadline":
    "Only the Task Lead or Head may change a subtask deadline.",
  "only the task leader can distribute task funding to a subtask":
    "Only the Task Lead can distribute task funding to a subtask.",
  "only the task leader can propose a subtask budget":
    "Only the Task Lead can allocate a subtask budget.",
  "only the task leader can remove a subtask cap":
    "Only the Task Lead can remove a subtask cap.",
  "only the task leader can set a subtask cap":
    "Only the Task Lead can set a subtask cap.",
  "only the task leader can submit a task-level request":
    "Only the Task Lead can submit a task-level cash request.",
  "only the task leader or an assigned contributor can request cash for this subtask":
    "Only the Task Lead or an assigned contributor can request cash for this subtask.",
  "only the task leader or an assigned subtask contributor can request against this allocation":
    "Only the Task Lead or an assigned contributor can request cash against this allocation.",
  "only the task team can change the status of work in progress":
    "Only the task team can change the status of work in progress.",
  "only the uploader may clean up this file":
    "Only the uploader can remove this file.",
  "open project and current own head required":
    "Open project and current Office Head access are required.",
  "open project and current responsible authority required":
    "Open project and current responsible Head access are required.",
  "open the subtask and submit evidence for review; direct check-off is disabled":
    "Open the subtask and submit evidence for review; direct check-off is disabled.",
  "operational account required": "An operational account is required.",
  "order must contain every untouched sibling exactly once":
    "The work list changed. Refresh before reordering.",
  "organization not found or inactive":
    "This Office was not found or is inactive.",
  "orphan cleanup requires an upload at least 24 hours old":
    "This file cannot be cleaned up yet.",
  "own appointed head required": "Own appointed Office Head access is required.",
  "own appointed operational office head required":
    "Own appointed Office Head access is required.",
  "package changed; reroute the current version for review":
    "Liquidation details changed. Refresh and route the current version again.",
  "parent submission requires in-progress work and all subtasks approved":
    "Start the parent task and ensure all subtasks are approved before submitting.",
  "parent task not found": "Parent task not found.",
  "parent task was not found": "Parent task was not found.",
  "pcvs are assigned at authorization":
    "Voucher numbers are assigned upon approval.",
  "pending funding request and appointed head required":
    "A pending funding request and appointed Head access are required.",
  "pending subtask submission not found":
    "Pending subtask submission not found.",
  "per-receipt threshold must be greater than zero":
    "Per-receipt threshold must be greater than zero.",
  "personal descendant discovery unavailable":
    "Child items could not be verified right now. Refresh and try again.",
  "personal owner required": "Workspace owner access is required.",
  "personal project access denied": "You don't have access to this project.",
  "personal project is closed": "This personal project is closed.",
  "personal project unavailable": "This personal project is no longer available.",
  "personal workspace owner required": "Workspace owner access is required.",
  "petty cash request not found": "This cash request was not found.",
  "petty-cash limits are invalid": "Petty cash limits are invalid.",
  "petty-cash request not found": "This cash request was not found.",
  "planning changes require untouched work":
    "Planning changes can be made only while the work is unstarted.",
  "please wait 60 seconds before retrying":
    "Please wait 60 seconds before trying again.",
  "please wait before resending": "Please wait before resending.",
  "please wait before resending this invitation again":
    "Please wait before resending this invitation.",
  "please wait before resending. email limit reached":
    "Email resend limit reached. Please try again later.",
  "please wait before trying again": "Please wait before trying again.",
  "primary and backup reviewers must be different people":
    "Primary and backup reviewers must be different people.",
  "primary reviewer must be an active profile":
    "Primary reviewer must have an active profile.",
  "private projects must remain in planning until activation":
    "Private projects must stay in Planning until activation.",
  "private task planning access required":
    "Private task planning access is required.",
  "private work cannot move outside its draft project":
    "Private work cannot move outside its draft project.",
  "profile photos must be 2 mb or smaller":
    "Profile photos must be 2 MB or smaller.",
  "progress must be 0–99; submit at completion":
    "Enter progress from 0 to 99; use Mark complete at 100%.",
  "progress must be a whole number from 0 to 99. completion requires approval":
    "Enter progress from 0 to 99. Completion requires approval.",
  "progress must be a whole number from 0 to 99; completion requires approval":
    "Enter progress from 0 to 99; completion requires approval.",
  "progress must be between 0 and 100": "Progress must be between 0 and 100.",
  "progress requires its active authenticated author":
    "Sign in again before posting progress.",
  "progress text exceeds its limit": "Progress update exceeds its character limit.",
  "project access denied": "You don't have access to this project.",
  "project access required": "Project access is required.",
  "project changed elsewhere. reopen setup and review current details before saving":
    "Project details changed elsewhere. Reopen setup and review current details before saving.",
  "project completion checks did not return a valid result. retry before completing the project":
    "Project completion checks could not be verified. Retry before completing.",
  "project draft request id was reused with different details":
    "Project draft details changed. Review and save again.",
  "project edit access denied": "You don't have permission to edit this project.",
  "project file access denied": "You don't have access to this project file.",
  "project file write denied or work closed":
    "File upload isn't allowed for closed work or without write access.",
  "project identity is protected": "Project identity cannot be modified.",
  "project invitation access denied":
    "You don't have permission for this project invitation.",
  "project is closed or governed. reopen its current participation workflow":
    "Project is closed or governed. Reopen its participation workflow.",
  "project member identity is protected":
    "Project member identity cannot be changed directly.",
  "project membership changed. reload selection before saving":
    "Project membership changed. Reload Members before saving.",
  "project metadata is read-only for this account or lifecycle":
    "Project details are read-only right now.",
  "project name must contain 1 to 200 characters":
    "Project name must be 1 to 200 characters.",
  "project not found": "This project was not found.",
  "project office not found": "Project Office not found.",
  "project office people access denied":
    "You don't have permission to view Office members for this project.",
  "project readiness is incomplete": "Project readiness is incomplete.",
  "project records changed. discard this preview and prepare it again":
    "Project records changed. Prepare the preview again.",
  "project request conflict":
    "This project request conflicted with a recent change. Refresh and try again.",
  "project start must precede its target date":
    "Project start date must be before its target date.",
  "project start must precede target date":
    "Project start date must be before its target date.",
  "project team unavailable": "Project team is currently unavailable.",
  "project title is required": "Enter a project title.",
  "project unavailable or access removed":
    "This project is unavailable or your access was removed.",
  "project update denied or changed; refresh before saving":
    "Project details changed or access was removed. Refresh before saving.",
  "project updated elsewhere; review new values before saving":
    "Project updated elsewhere. Refresh and review values before saving.",
  "project work identity is protected": "Project work identity is protected.",
  "purchased item totals do not match declared spending":
    "Purchased item totals do not match declared spending.",
  "purchased item totals must equal declared spending exactly":
    "Purchased item totals must equal declared spending.",
  "purchased item totals must equal every receipt":
    "Purchased item totals must match every receipt.",
  "purchased item uses an unauthorized funding account":
    "A purchased item uses an unauthorized funding source.",
  "purchased items exceed their authorized funding source":
    "Purchased items exceed their authorized funding source.",
  "reactivate this project before completing it":
    "Reactivate this project before completing it.",
  "readiness review is unavailable": "Readiness review is unavailable.",
  "reassign active work before removing its project members":
    "Reassign active work before removing those project members.",
  "reassign unfinished descendant workers before removing a branch contributor":
    "Reassign unfinished child subitem workers before removing this contributor.",
  "reassign unfinished personal descendants before changing member access":
    "Reassign unfinished child subitems before changing access.",
  "receipt amounts must equal the declared amount spent":
    "Receipt totals must equal the declared spending amount.",
  "receipt amounts must use finite nonnegative cents":
    "Enter valid non-negative receipt amounts.",
  "receipt evidence could not be linked":
    "Could not link the receipt attachment. Upload the receipt again.",
  "receipt evidence must be an uploaded file owned by this recipient in this cash request":
    "Receipt files must be uploaded by the cash recipient for this cash request.",
  "receipt total exceeds released petty cash":
    "Receipt total exceeds the released petty cash.",
  "receipt totals must equal declared spending exactly":
    "Receipt totals must equal declared spending.",
  "receipts are not awaiting review": "Receipts are not awaiting review.",
  "receipts must be an array": "Enter valid receipts.",
  "recipient office or guest approval changed. request fresh approval":
    "Recipient access changed. Request fresh approval.",
  "recipient sponsoring approval changed. request fresh approval":
    "Sponsoring approval changed. Request fresh approval.",
  "reconcile task funding before removing this task":
    "Return or reconcile task funding before removing this task.",
  "record a decision reason": "Enter a decision reason.",
  "reference and memo are required": "Reference and memo are required.",
  "referenced evidence cannot be deleted":
    "Evidence already linked to a submission cannot be deleted.",
  "refresh project details before saving":
    "Refresh project details before saving.",
  "refresh the budget before saving": "Refresh the budget before saving.",
  "refresh the current liquidation before routing":
    "Refresh the liquidation before routing for review.",
  "release existing project funding before declaring no funding required":
    "Return existing project funding before marking No funding required.",
  "release not found": "This cash release was not found.",
  "released cash must be liquidated rather than cancelled":
    "Released cash must be liquidated rather than cancelled.",
  "remove this task from dependent tasks before deleting it":
    "Remove this task from dependent tasks before deleting it.",
  "reopen the submitted or approved dependent tasks first. this prerequisite cannot be reopened, cancelled or deleted while their approvals remain current":
    "Reopen dependent tasks that are under review or approved before modifying this prerequisite.",
  "repeat interval must be a whole number from 1 to 365 with a valid frequency":
    "Enter a repeat interval from 1 to 365 with a valid frequency.",
  "report facts are incomplete. retry the report":
    "Report data is incomplete. Try reloading the report.",
  "request access denied": "You don't have access to this request.",
  "request conflict": "Request conflicted with a recent update. Refresh and try again.",
  "request exceeds its protected subtask source cap":
    "Request exceeds this subtask's protected spending cap.",
  "request funding lines must belong to its authorized task funding":
    "Funding lines must belong to this task's authorized funding.",
  "request id reused": "Request reference was already used. Try again.",
  "request id was already used for different terms":
    "Request terms changed after submission started. Open a fresh form and retry.",
  "request identity already used":
    "Request reference already used. Refresh to check the result.",
  "request identity already used for different work":
    "Work details changed from the prior request. Start fresh and retry.",
  "request identity was used with a different decision":
    "Decision details changed. Refresh and check the current request.",
  "request identity was used with different review details":
    "Review details changed. Refresh and check the current request.",
  "request is no longer pending": "This request is no longer pending.",
  "request key belongs to a different purchase":
    "Cash request details changed after the previous attempt. Check existing requests or submit a new one.",
  "request terms conflict": "Request conflicted with recent changes. Refresh and try again.",
  "request unavailable": "This request is no longer available.",
  "requested amount must be greater than zero":
    "Requested amount must be greater than zero.",
  "required history scope unavailable":
    "Work history is unavailable for this scope.",
  "required independent review cannot be waived by staffing":
    "Required independent review cannot be waived by staffing changes.",
  "required reviewer is no longer active":
    "The required reviewer is no longer active.",
  "resend limit reached. revoke this invitation":
    "Resend limit reached. Revoke this invitation.",
  "resolution conflict: review the existing office participation first":
    "Review the existing Office participation before resolving.",
  "resolve dependent tasks before removing this task":
    "Remove dependent task links before removing this task.",
  "resolve pending funding requests in project settings -> project budget before deleting this project":
    "Resolve pending funding requests in Project settings before deleting this project.",
  "resolve pending task reviews before changing the project lead":
    "Resolve pending task reviews before changing the Project Lead.",
  "resolve proposed office identity before evidence or funding":
    "Confirm the Office invitation before attaching evidence or funding.",
  "resolve proposed office identity before progress or evidence":
    "Confirm the Office invitation before updating progress or evidence.",
  "resolve proposed office identity before staffing or execution":
    "Confirm the Office invitation before assigning work or starting.",
  "resolve proposed office identity before subitem staffing or execution":
    "Confirm the Office invitation before assigning subitems or starting.",
  "resolve proposed office responsibility and choose open work before funding":
    "Confirm the Office invitation and select open work before funding.",
  "resolve started or approved dependent tasks before reopening or deleting this prerequisite":
    "Resolve started or approved dependent tasks before reopening or deleting this prerequisite.",
  "resolve unfinished personal assignments before removal or viewer access":
    "Reassign unfinished work before removing this person or setting Viewer access.",
  "responsible head required": "Responsible Office Head access is required.",
  "responsible office must be a joined collaborator":
    "The responsible Office must join the project first.",
  "retry must use the same details": "Retry using the same request details.",
  "reviewed work must be reopened before reassignment":
    "Reopen reviewed work before reassigning it.",
  "revoke this invitation and create a new one. its original authority or retained details are no longer available":
    "Revoke this invitation and create a new one.",
  "root contributor operation denied":
    "You don't have permission to modify task contributors.",
  "root lead must remain; transfer uses its responsible head":
    "The Task Lead must remain in the team; use Lead transfer from the responsible Head.",
  "same root required; self-parent and cycles are forbidden":
    "Subitems must stay within the same parent task and cannot link in a loop.",
  "save and review project changes before activation":
    "Save and review project changes before activation.",
  "save complete project details and dates before authorizing funding":
    "Save complete project details and dates before authorizing funding.",
  "save editing access through add people":
    "Save editing access through Add People.",
  "save project changes before publishing":
    "Save project changes before publishing.",
  "save result is uncertain. retry the same request to verify it":
    "Save result is uncertain. Retry the same request to verify it.",
  "schedule change cancelled. your dates remain unchanged":
    "Schedule change cancelled. Your dates remain unchanged.",
  "schedule editing access changed. reopen this task":
    "Schedule editing access changed. Reopen this task.",
  "scheduled release not found": "Scheduled release not found.",
  "section belongs to another budget": "This section belongs to another budget.",
  "section ids must be unique": "Section IDs must be unique.",
  "sections must form a tree of at most six levels":
    "Sections can nest up to six levels.",
  "select a proposal budget line and fund source":
    "Select a budget line and funding source.",
  "select a proposal budget line before resubmitting this request":
    "Select a funding line before resubmitting this request.",
  "select a valid proposal budget line for this task":
    "Select a valid funding line for this task.",
  "select active members of your own office":
    "Select active members of your own Office.",
  "select active project members from the responsible office":
    "Select active project members from the responsible Office.",
  "select an active selected project member":
    "Select an active project member.",
  "select funding sources, amounts and an authorization reason":
    "Select funding sources, enter amounts, and provide a reason.",
  "select the project member first": "Select a project member first.",
  "select the proposal budget line and fund source from the task funding card":
    "Select the funding line and source from Task funding.",
  "separate late-liquidation authorization is required before settlement":
    "Separate late-liquidation authorization is required before settlement.",
  "set a due date before moving this task":
    "Set a due date before moving this task.",
  "set the task start and due dates before allocating quarterly funding":
    "Set the task start and due dates before allocating funding.",
  "settings changed since loading. reload before saving":
    "Settings changed since loading. Reload before saving.",
  "settle all released or reserved cash before approving this funded subtask":
    "Settle all released or pending cash before approving this funded subtask.",
  "settle or cancel every petty-cash request before closing this fiscal year":
    "Settle or cancel all petty cash requests before closing this fiscal year.",
  "settle this guest's open cash responsibility before deactivating the account":
    "Settle this guest's open cash responsibility before deactivating the account.",
  "share belongs to another recipient or is unavailable":
    "This share link belongs to another account or is unavailable.",
  "share expired, revoked or project access ended":
    "This share expired, was revoked, or project access ended.",
  "share redemption lifetime must be 1–30 days":
    "Share expiry must be between 1 and 30 days.",
  "shared project office and governance identities are protected":
    "Shared project Office identities are protected.",
  "sibling ordering denied": "You don't have permission to reorder these items.",
  "sign in again before assigning work":
    "Your session changed. Sign in again before assigning work.",
  "sign in and choose valid funding lines":
    "Sign in and choose valid funding lines.",
  "sign in before budget maintenance": "Sign in to manage budgets.",
  "sign in before deleting a group": "Sign in before deleting a group.",
  "sign in before recording a cash release":
    "Sign in before recording a cash release.",
  "sign in before recording a release": "Sign in before recording a release.",
  "sign in to authorize funding": "Sign in to authorize funding.",
  "sign in to edit project details": "Sign in to edit project details.",
  "sign in to verify the current work impact":
    "Sign in to verify the current work impact.",
  "sign in with the invited verified email":
    "Sign in with the invited verified email address.",
  "some work has already started. move those tasks before deleting this group":
    "Some work has already started. Move those tasks before deleting this group.",
  "source belongs to different work":
    "This funding source belongs to different work.",
  "spending exceeds this account authorization; obtain reauthorization first":
    "Spending exceeds this account authorization.",
  "stale approval or current authority unavailable":
    "Approval changed or is no longer valid. Refresh and try again.",
  "stale or unavailable request; request renewed approval":
    "This request is out of date. Request renewed approval.",
  "stale request": "This request changed. Refresh and check the latest state.",
  "start date must precede the due date":
    "Start date must be before the due date.",
  "started work and history cannot be deleted":
    "Started work and history cannot be deleted.",
  "storage has not recorded a valid evidence size":
    "The uploaded file could not be verified. Upload it again.",
  "stored file metadata conflict":
    "File details conflicted with an existing upload. Try again.",
  "stored journal debits and credits must balance exactly":
    "Journal debits and credits must balance exactly.",
  "subitem due dates cannot be later than their task due date":
    "Subitem due dates cannot be later than their parent task due date.",
  "subitem unavailable": "This subitem is no longer available.",
  "subitem unavailable. it was removed or is no longer accessible":
    "This subitem was removed or is no longer accessible.",
  "subitems complete directly; open the work action instead":
    "Use the direct work completion action for this subitem.",
  "submission attachments must be an array":
    "Attach valid evidence files before submitting.",
  "submission note is required": "Enter a submission note.",
  "submission requires its active authenticated submitter":
    "Sign in again before submitting work.",
  "submission snapshot does not match its validated evidence":
    "Uploaded evidence changed. Review attachments and submit again.",
  "submission snapshot must come from the current validated submission":
    "Evidence verification expired. Upload attachments again.",
  "subtask assignees must be active members directly assigned to this department":
    "Subtask assignees must be active members of this Office.",
  "subtask context changed. read current work again":
    "Subtask details changed. Reload the task before continuing.",
  "subtask deadlines are locked while the parent task is under review, completed, cancelled, or archived":
    "Subtask deadlines are locked while the parent task is under review or closed.",
  "subtask does not belong to this task":
    "This subtask does not belong to the selected task.",
  "subtask due date cannot be later than its parent task due date":
    "Subtask due date cannot be later than its parent task due date.",
  "subtask is not awaiting review": "This subtask is not awaiting review.",
  "subtask not found": "This subtask was not found.",
  "subtask order is locked while the parent task is under review, completed, cancelled, or archived":
    "Subtask order is locked while the parent task is under review or closed.",
  "subtask start time is managed by the lifecycle":
    "Subtask start date updates automatically when work starts.",
  "subtask submission requires at least one validated evidence file":
    "Attach at least one uploaded evidence file before submitting.",
  "subtasks are locked while work is under review or completed":
    "Subtasks are locked while work is under review or completed.",
  "task assignee must be an active eflow user":
    "The task assignee must be an active eFlow user.",
  "task changed; refresh before continuing":
    "This task changed. Refresh before continuing.",
  "task due date cannot be before its start date":
    "Task due date cannot be before its start date.",
  "task is not awaiting review": "This task is not awaiting review.",
  "task is not open for submission": "This task is not open for submission.",
  "task is outside your allowed scope": "This task is outside your Office scope.",
  "task leads may assign only within the task organization":
    "Task Leads can assign only members within the task's Office.",
  "task not available": "This task is no longer available.",
  "task not found": "This task was not found.",
  "task required": "Select a task.",
  "task responsibility changed; refresh before authorizing funding":
    "Task responsibility changed. Refresh before authorizing funding.",
  "task start date is earlier than a prerequisite due date. adjust the schedule first":
    "Prerequisite linking needs a backend update. Contact your Office Head.",
  "task title is required": "Enter a task title.",
  "task unavailable": "This task is no longer available.",
  "task/subtask is not open for progress":
    "This work is not open for progress updates.",
  "task/subtask is not open for submission":
    "This work is not open for submission.",
  "tell your lead what is blocking you":
    "Describe what is blocking this work.",
  "the accounting liquidation function is not installed in supabase. apply migration 20260919000000_phase04_phase05_accounting.sql before submitting a cash return":
    "Liquidation submission isn't available right now because an accounting service update is missing.",
  "the accounting schedule override is not installed in supabase. run migration 20260919000003_accounting_release_schedule_override.sql in the sql editor, then retry":
    "Schedule override isn't available right now because an accounting service update is missing.",
  "the annual budget is locked and cannot be edited":
    "The annual budget is locked and cannot be edited.",
  "the annual budget total must be greater than zero":
    "The annual budget total must be greater than zero.",
  "the annual department budget is no longer open":
    "The annual Office budget is no longer open.",
  "the assignee cannot review their own task":
    "The assignee cannot review their own task.",
  "the assignment receipt was not confirmed. retry the same assignment":
    "The assignment was not confirmed. Retry the same assignment to verify.",
  "the budget changed. check the latest schedule before confirming":
    "The budget changed. Check the latest schedule before confirming.",
  "the budget changed. refresh and review the latest sections before saving":
    "The budget changed. Refresh and review the latest sections before saving.",
  "the cash release override is not installed in supabase yet. apply migration 20260831000002_cash_release_schedule_override.sql, then try again":
    "Schedule override isn't available right now because a release update is missing.",
  "the database did not return the created project":
    "Project creation could not be confirmed. Refresh Projects to verify before retrying.",
  "the database did not return the created task":
    "Task creation could not be confirmed. Refresh this project to verify before retrying.",
  "the entire subtree must be untouched":
    "All child subitems must be unstarted before making this change.",
  "the funded task no longer exists": "The funded task no longer exists.",
  "the held amount changed. check the latest schedule":
    "The held amount changed. Check the latest schedule.",
  "the itemized liquidation function is unavailable. refresh the funding context and verify the itemized cash migration before retrying":
    "Itemized liquidation isn't available right now. Refresh funding details and try again later.",
  "the lead office stays with this project":
    "The Lead Office cannot be removed from this project.",
  "the liquidation's fiscal year could not be verified":
    "The liquidation's fiscal year could not be verified.",
  "the liquidation's office budget is unavailable":
    "The Office budget for this liquidation is unavailable.",
  "the office project list is changing. try again":
    "The Office project list is updating. Try again shortly.",
  "the ordered list contains a missing or duplicate subtask id":
    "Subtask list changed. Refresh before reordering.",
  "the ordered list must contain every subtask exactly once":
    "Subtask list changed. Refresh before reordering.",
  "the parent task is not open for subtask progress":
    "Start the parent task before updating subtask progress.",
  "the parent task is not open for subtask submission":
    "The parent task must be in progress before submitting subtasks.",
  "the project changed. review its current name before saving":
    "Project details changed. Review current details before saving.",
  "the project database upgrade has not been applied yet. apply the atomic project creation migration, then retry":
    "Project creation isn't available right now because a service update is missing.",
  "the project default group is unavailable":
    "The project default group is unavailable.",
  "the project deletion database upgrade has not been applied yet":
    "Project deletion isn't available right now because a service update is missing.",
  "the project deletion task-link fix has not been applied yet. apply migration 20260819000003, then retry":
    "Project deletion isn't available right now because a service update is missing.",
  "the project-creation permission check could not run. refresh the page and retry":
    "Could not verify project creation permission. Refresh and try again.",
  "the referenced subitem is no longer assigned to you":
    "This subitem is no longer assigned to you.",
  "the referenced subitem root is unavailable":
    "The parent task for this subitem is unavailable.",
  "the request must be fiscally approved before release":
    "The cash request must be approved before release.",
  "the saved invitation is already being sent. check its status before retrying":
    "This invitation is already being sent. Check its status before retrying.",
  "the secure sign-in service is unavailable. please try again shortly":
    "The sign-in service is temporarily unavailable. Try again shortly.",
  "the task budget has already been committed to subtask funding or task-level petty cash":
    "This task budget has already been committed to subtask funding or cash requests.",
  "the task budget has already been distributed to subtasks or committed to task-level petty cash":
    "This task budget has already been distributed to subtasks or cash requests.",
  "the task budget is no longer sufficient":
    "The task budget is no longer sufficient.",
  "the task database upgrade has not been applied yet. apply the atomic task creation migration, then retry":
    "Task creation isn't available right now because a service update is missing.",
  "the task does not have enough unallocated budget":
    "This task does not have enough unallocated budget.",
  "the task does not have enough unallocated funding":
    "This task does not have enough unallocated funding.",
  "the task has no approved proposal allocation":
    "This task has no approved funding allocation.",
  "the team leader endorsement and department approval must be made by different people":
    "Task endorsement and approval must be made by different people.",
  "the work allocation does not have enough remaining funds":
    "This allocation does not have enough remaining funds.",
  "the work allocation is no longer available":
    "This work funding allocation is no longer available.",
  "the work allocation is no longer sufficient":
    "This work funding allocation is no longer sufficient.",
  "this office has project work. move or remove that work before removing the office":
    "This Office has assigned work. Reassign or remove that work before removing the Office.",
  "this office is no longer available": "This Office is no longer available.",
  "this office participation is no longer available":
    "This Office participation is no longer available.",
  "this office was removed from the project":
    "This Office was removed from the project.",
  "this office was removed. add it again before inviting or linking it":
    "This Office was removed. Add it again before inviting or linking.",
  "this account changed. review it before approval":
    "This account changed. Review it before approval.",
  "this account has already changed. reopen its current details":
    "This account already changed. Reopen its current details.",
  "this allocation has already been decided":
    "This allocation has already been decided.",
  "this annual budget is already locked":
    "This annual budget is already locked.",
  "this approval identity was already used":
    "This approval was already recorded. Refresh to check the status.",
  "this budget particular does not have enough unallocated funding":
    "This funding source does not have enough unallocated balance.",
  "this cap has an active cash request and cannot be edited":
    "This subtask cap has an active cash request and cannot be edited.",
  "this cap has an active cash request and cannot be removed":
    "This subtask cap has an active cash request and cannot be removed.",
  "this cash tranche has already been processed":
    "This cash tranche has already been processed.",
  "this group has funded work or cash requests. move those tasks before deleting it":
    "This group has funded work or cash requests. Move those tasks before deleting it.",
  "this group has saved work or submitted evidence. move those tasks before deleting it":
    "This group has saved work or submitted evidence. Move those tasks before deleting it.",
  "this group still has tasks. move or delete them first. archived tasks must be moved too":
    "This group still has tasks. Move or delete them first, including archived tasks.",
  "this invitation can no longer be resent":
    "This invitation can no longer be resent.",
  "this invitation is no longer pending":
    "This invitation is no longer pending.",
  "this invitation was already used with other details":
    "Invitation details changed. Refresh before retrying.",
  "this liquidation has already been decided":
    "This liquidation has already been decided.",
  "this liquidation is not awaiting department settlement":
    "This liquidation is not awaiting department settlement.",
  "this liquidation is not awaiting team leader review":
    "This liquidation is not awaiting Team Leader review.",
  "this liquidation was submitted after its deadline and requires department head approval":
    "This liquidation was submitted late and requires Office Head approval.",
  "this liquidation is unavailable under your current access":
    "This liquidation is unavailable under your current access.",
  "this message was deleted": "This message was deleted.",
  "this office already has a head. review its leadership first":
    "This Office already has an appointed Head.",
  "this package does not require conflict review":
    "This liquidation package does not require conflict review.",
  "this package is not awaiting late liquidation authorization":
    "This liquidation package is not awaiting late-liquidation authorization.",
  "this person is no longer in the chat":
    "This person is no longer in the chat.",
  "this person is not currently selected and eligible for this project. ask the responsible office head to review members, then refresh recommendations":
    "This person is not currently eligible on the project team.",
  "this person is unavailable for direct messages":
    "This person is unavailable for direct messages.",
  "this project belongs to another workspace":
    "This project belongs to another workspace.",
  "this project cannot be deleted": "This project cannot be deleted.",
  "this project chat is archived": "This project chat is archived.",
  "this project is already archived": "This project is already archived.",
  "this project is outside your organization scope":
    "This project is outside your Office scope.",
  "this project is read-only": "This project is read-only.",
  "this project still has funding. return unused funds in project settings -> project budget before deleting it. archive the project to keep any spending history together":
    "Return unused project funds before deleting, or archive the project to keep its spending history.",
  "this receipt is already recorded against another petty cash request":
    "This receipt is already used in another petty cash request.",
  "this recommendation is no longer eligible. refresh context and review new recommendations":
    "This recommendation is no longer eligible. Refresh to review current options.",
  "this release has already been processed":
    "This cash release has already been processed.",
  "this release is already due; use the normal release confirmation":
    "This release is already due; use standard release confirmation.",
  "this release is not due yet": "This release is not due yet.",
  "this release would exceed the approved request amount":
    "This release would exceed the approved request amount.",
  "this request has already been decided":
    "This request has already been decided.",
  "this request has different details. start a new request":
    "Request details changed. Start a new request.",
  "this request is not awaiting corrections":
    "This request is not awaiting corrections.",
  "this request is not awaiting department approval":
    "This request is not awaiting Head approval.",
  "this request is not awaiting team leader review":
    "This request is not awaiting Team Leader review.",
  "this request is not ready for liquidation":
    "This request is not ready for liquidation.",
  "this request key belongs to different funding details":
    "Funding details changed. Refresh and review before retrying.",
  "this request was already used for another change":
    "This change was already applied or conflicted. Refresh before retrying.",
  "this scheduled release was not found. check the latest budget":
    "Scheduled release not found. Refresh the budget.",
  "this settings request was already used for another change":
    "Settings changed. Refresh before saving again.",
  "this source still backs cash or child funding; it cannot be deleted":
    "This source still backs cash requests or subtask funding and cannot be removed.",
  "this subitem is already completed": "This subitem is already completed.",
  "this subtask is already under review or completed":
    "This subtask is already under review or completed.",
  "this subtask is locked while under review or completed":
    "This subtask is locked while under review or completed.",
  "this task already has approved funding; it cannot be charged twice":
    "This task already has approved funding.",
  "this task already has funding. release its unused allocation before reallocating; existing spending and advances cannot be erased":
    "This task already has funding. Return unused funds before reallocating.",
  "this task already has subtask leads. choose its lead manually to review their assignments":
    "This task already has subtask leads. Choose its lead manually.",
  "this task has no task leader for endorsement routing":
    "This task needs an assigned Task Lead before cash requests can be routed.",
  "this task has no team leader for petty-cash routing":
    "This task needs an assigned Task Lead for petty cash routing.",
  "this tranche would exceed the approved cash request amount":
    "This tranche would exceed the approved cash request amount.",
  "this update is no longer available or read access was denied":
    "This update is no longer available.",
  "this work allocation does not have enough remaining funds":
    "This work allocation does not have enough remaining funds.",
  "type the exact project title to confirm deletion":
    "Type the exact project title to confirm deletion.",
  "unable to finish sign-in. please try again":
    "Unable to finish sign-in. Please try again.",
  "undo reason is required": "Enter a reason before undoing.",
  "unlink this document from its tasks before removing it from the library":
    "Unlink this document from its tasks before removing it.",
  "unsupported account role. ask an admin to correct this account":
    "Unsupported account role. Ask an Admin to review your account.",
  "upload a receipt file for this request":
    "Upload a receipt file for this request.",
  "upload access denied": "You don't have permission to upload here.",
  "upload has not been confirmed. keep this draft and retry":
    "Upload was not confirmed. Retry before clearing this draft.",
  "upload identity conflict": "Upload conflicted with an existing file. Try again.",
  "use a chat name up to 100 characters":
    "Use a chat name up to 100 characters.",
  "use a complete event cursor": "History cursor expired. Refresh history.",
  "use a nickname up to 40 characters": "Use a nickname up to 40 characters.",
  "use a valid itemized receipt package":
    "Review receipts and purchased items before submitting.",
  "use a valid list of at most 250 budget sections":
    "Use up to 250 budget sections.",
  "use between 1 and 30 groups": "Use between 1 and 30 groups.",
  "use cancellation to retain this task's history":
    "Cancel this task instead of deleting it to preserve its history.",
  "use each budget source only once": "Use each budget source only once.",
  "use itemized liquidation for multi-account cash requests":
    "Use itemized liquidation for multi-account cash requests.",
  "use the custom status action to change this status":
    "Use the status action to change this custom status.",
  "use the existing archive restore workflow to reopen a closed project":
    "Restore this archived project before reopening it.",
  "use the existing office evidence workflow":
    "Use the Office evidence review workflow.",
  "use the managed subtask deadline action to change a due date":
    "Use the subtask deadline option to change the due date.",
  "use the project lifecycle or ownership workflow for this change":
    "Use the project settings workflow for this change.",
  "use the subitem completion action; direct row edits are disabled":
    "Use the completion action for this subitem.",
  "use the versioned nested work operation":
    "Use the subitem update action to save changes.",
  "use up to 100 acceptance criteria": "Use up to 100 acceptance criteria.",
  "use up to 100 scheduled releases per account":
    "Use up to 100 scheduled releases per account.",
  "use valid non-negative amounts in cents; held money cannot exceed the amount":
    "Use valid non-negative amounts; held money cannot exceed the total.",
  "utilization threshold must be from 0 to 100":
    "Utilization threshold must be between 0 and 100.",
  "verified current read access required":
    "Your read access could not be verified. Refresh and try again.",
  "verify current work access before saving":
    "Verify current work access before saving.",
  "voucher number does not match this release":
    "Voucher number does not match this cash release.",
  "wait for prerequisite task approval before final submission":
    "Wait for prerequisite task approval before submitting.",
  "work access denied": "You don't have access to this work.",
  "work changed; reload and review the current tree":
    "Work structure changed. Reload and review before continuing.",
  "work changed; reload and review the impact again":
    "Work changed. Reload and review the impact again.",
  "work deletion denied": "You don't have permission to delete this work.",
  "work has no approved funding": "This work has no approved funding.",
  "work hierarchy has a cycle, foreign parent or depth beyond 8; resolve it first":
    "Work hierarchy has a cycle or exceeds 8 levels. Resolve it before continuing.",
  "work impact changed; reload and review affected work before confirming again":
    "Work impact changed. Reload before confirming again.",
  "work or draft terms changed during confirmation. review the current impact again":
    "Work terms changed while confirming. Refresh and review again.",
  "work request identity required":
    "Could not verify this action. Refresh and try again.",
  "work scope unavailable": "This work item is no longer available.",
  "work submission identity already in use":
    "This submission was already sent. Refresh to check the status.",
  "work under review or closed work must retain its history":
    "Work under review or closed work must retain its history.",
  "work update exceeds its text limit":
    "Work update exceeds its character limit.",
  "workspace access denied": "You don't have access to this workspace.",
  "workspace owner already has permanent ownership":
    "Workspace owner already has permanent ownership.",
  "workspace owner membership is mandatory":
    "Workspace owner membership cannot be removed.",
  "workspace ownership needs a replacement before removal":
    "Assign a new workspace owner before removing the current one.",
  "workspace ownership requires permanent access":
    "Workspace ownership requires permanent access.",
  "workspace request conflict":
    "Workspace update conflicted with another change. Refresh and try again.",
  "you are not assigned to this work item":
    "You are not assigned to this work item.",
  "you can only remove your own messages":
    "You can remove only your own messages.",
  "you cannot approve your own allocation request":
    "You cannot approve your own allocation request.",
  "you cannot approve your own request":
    "You cannot approve your own request.",
  "you cannot delete projects in this organization":
    "You don't have permission to delete projects in this Office.",
  "you cannot edit this group": "You don't have permission to edit this group.",
  "you cannot order another office work":
    "You cannot reorder another Office's work.",
  "you cannot review your own liquidation":
    "You cannot review your own liquidation.",
  "you cannot review your own request":
    "You cannot review your own request.",
  "you cannot review your own submission":
    "You cannot review your own submission.",
  "you cannot review your own subtask submission":
    "You cannot review your own subtask submission.",
  "you cannot verify your own liquidation":
    "You cannot verify your own liquidation.",
  "you cannot view funding for this task":
    "You don't have permission to view funding for this task.",
  "you must be signed in": "Sign in to continue.",
  "you must be signed in to comment": "Sign in to post a comment.",
  "you must be signed in to create a subtask": "Sign in to create a subtask.",
  "you must be signed in to create subtasks": "Sign in to create subtasks.",
  "you need current permission to update this subtask":
    "You need current permission to update this subtask.",
  "your account changed. revalidate this review before deciding":
    "Your account access changed. Refresh before deciding.",
  "your active eflow profile could not be verified. contact an administrator if this continues":
    "Your active eFlow profile could not be verified. Contact an administrator if this continues.",
  "your active eflow profile could not be verified. sign in again or ask an administrator to check your account":
    "Your active eFlow profile could not be verified. Sign in again or contact an administrator.",
  "your current eflow role is not allowed to create work in this office. ask its head to check your access":
    "Your current role isn't allowed to create work in this Office.",
  "your current sponsoring head approval is required. the request is saved":
    "Sponsoring Head approval is required. The request is saved.",
  "your current work access could not be verified":
    "Your current work access could not be verified. Refresh and try again.",
  "your project access is read-only for this office work":
    "Your project access is read-only for this Office's work.",
  "your session changed. reopen this task to check its saved team":
    "Your session changed. Reopen this task to check its saved team.",
  "your session changed. verify the work impact again":
    "Your session changed. Refresh and verify the work impact again.",
  "your sign-in session has expired. sign in again, then retry creating the project":
    "Your sign-in session expired. Sign in again, then retry creating the project.",
  "your sign-in session has expired. sign in again, then retry creating the task":
    "Your sign-in session expired. Sign in again, then retry creating the task.",
  "your sign-in session has expired. sign in again, then retry this work plan":
    "Your sign-in session expired. Sign in again before saving.",

  // Client-side validation & service verification messages from src/app
  "an assigned office is required to load office reports":
    "An assigned Office is required to load Office reports.",
  "another financial action in this record has no confirmed response. verify it before changing the request terms":
    "Another financial action on this record has no confirmed response. Verify it before changing request details.",
  "choose a jpg, png, gif or webp image":
    "Choose a JPG, PNG, GIF, or WebP image.",
  "choose a pdf smaller than 10 mb": "Choose a PDF smaller than 10 MB.",
  "choose a pdf up to 10 mb": "Choose a PDF up to 10 MB.",
  "choose an image up to 10 mb": "Choose an image up to 10 MB.",
  "could not continue loading updates":
    "Could not load more updates. Refresh and try again.",
  "could not load project task totals":
    "Could not load project task totals. Refresh and try again.",
  "could not load project tasks":
    "Could not load project tasks. Refresh and try again.",
  "could not verify project setup":
    "Could not verify project setup. Refresh and try again.",
  "could not verify the selected workspace context":
    "Could not verify the selected workspace. Refresh and try again.",
  "could not verify the work expense amounts":
    "Could not verify work expense amounts. Refresh and try again.",
  "could not verify this office and fiscal year":
    "Could not verify this Office and fiscal year.",
  "could not verify your conversations":
    "Could not load your conversations. Refresh and try again.",
  "file sharing is unavailable on this device":
    "File sharing is unavailable on this device.",
  "invalid message cursor. refresh the conversation":
    "Message history changed. Refresh the conversation.",
  "microphone permission was not granted. typed help remains available":
    "Microphone permission was not granted. Typed Help remains available.",
  "no network connection. check your internet connection":
    "Connection unavailable. Try again when the service is reachable.",
  "project status is unavailable": "Project status is unavailable.",
  "speech must be between 0.25 and 25 seconds":
    "Speech must be between 0.25 and 25 seconds.",
  "task planning fields could not be confirmed":
    "Task planning fields could not be confirmed. Refresh and check before saving.",
  "the active account changed":
    "Your active account changed. Refresh before continuing.",
  "the configured gateway does not serve office team. check its deployment":
    "Office Team roster is unavailable right now.",
  "the financial action was already saved":
    "This financial action was already saved. Refresh the current record.",
  "the funding office or fiscal year could not be verified":
    "The funding Office or fiscal year could not be verified.",
  "the funding office or fiscal year is unavailable":
    "The funding Office or fiscal year is unavailable.",
  "the funding scope could not be verified":
    "The funding scope could not be verified.",
  "the gateway did not return a valid office roster":
    "Could not verify the Office roster. Refresh and try again.",
  "the gateway requires current office head access for this roster":
    "Office Head access is required for this roster.",
  "the help service returned an incomplete answer. please try again":
    "The help service returned an incomplete answer. Try again.",
  "the microphone delivered incomplete pcm audio":
    "Microphone audio was incomplete. Try speaking again.",
  "the microphone delivered invalid pcm audio":
    "Microphone audio could not be read. Try speaking again.",
  "the microphone sample rate changed. restart the conversation":
    "Microphone audio changed. Restart the conversation.",
  "the original message receipt does not match. refresh the conversation":
    "Message details changed. Refresh the conversation.",
  "the original work receipt could not be verified":
    "The original work request could not be verified. Refresh and check before retrying.",
  "the publication service could not respond":
    "The publication service could not respond. Try again later.",
  "the read marker could not be confirmed":
    "Could not mark this announcement as read. Try again.",
  "the speech service returned an unreadable transcript":
    "Speech could not be transcribed cleanly. Try speaking again.",
  "the spoken answer could not be read. the written answer is still available":
    "The spoken answer could not be played. The written answer is still available.",
  "this account is inactive. contact your office head or admin":
    "This account is inactive. Contact your Office Head or Admin.",
  "this action has no confirmed response. check the current record before repeating the write":
    "This action has no confirmed response. Check the current record before repeating it.",
  "this app build does not contain native microphone capture. install the rebuilt eflow development app":
    "Voice capture isn't available in this app build. Typed Help remains available.",
  "this financial action was already saved. refresh the current record":
    "This financial action was already saved. Refresh the current record.",
  "this personal work item has no current project context. refresh your work":
    "This work item has no current project context. Refresh My Work.",
  "this workspace is not in your current authorized workspace list":
    "This workspace is not in your current authorized workspace list.",
  "work access or revision changed. reopen the editor and review the current work":
    "Work access or details changed. Reopen the editor and review the current work.",
  "work access or revision changed. reopen this subtask and review the current work":
    "Work access or details changed. Reopen this subtask and review the current work.",
  "work changed. review the latest details before saving your draft":
    "Work changed elsewhere. Review the latest details before saving.",
  "workspace access ended": "Workspace access ended.",
  "write a message first": "Write a message first.",
  "your session changed. sign in again":
    "Your session changed. Sign in again.",
};

type PatternRule = readonly [
  RegExp,
  (...groups: string[]) => string,
];

const patternMessages: readonly PatternRule[] = [
  [
    /^(.+?) cannot be removed while assigned to unfinished subtask "(.+)"\.?$/i,
    (who, title) =>
      `${who} cannot be removed while assigned to unfinished subtask "${title}".`,
  ],
  [
    /^A petty-cash request cannot exceed (.+)\.?$/i,
    (limit) => `A petty cash request cannot exceed ${limit}.`,
  ],
  [
    /^A task named "(.+)" already exists in this project\. No work was added\. Open the existing task, or use a new project for a separate copy\.?$/i,
    (title) =>
      `A task named "${title}" already exists in this project. Open the existing task or choose another name.`,
  ],
  [
    /^Account (.+?) has insufficient released budget(?:; held funds cannot be committed)?\.?$/i,
    (account) => `Account ${account} has insufficient released budget.`,
  ],
  [
    /^Approval requirements not complete: (.+)\.?$/i,
    (reason) => `Approval requirements not complete: ${reason}.`,
  ],
  [
    /^Cannot reduce "(.+)" to (PHP [^.]+\.[^.]+|PHP [^\s.]+)\. The minimum allowed is (PHP [^.]+\.[^.]+|PHP [^\s.]+)\.?$/i,
    (name, target, min) =>
      `Cannot reduce "${name}" to ${target}. Minimum allowed is ${min}.`,
  ],
  [
    /^Complete and review every descendant first: resolve descendant "(.+)" \((.+)\) before approval\.?$/i,
    (title, status) =>
      `Complete and review "${title}" (${status}) before approving this task.`,
  ],
  [
    /^Complete every child step first: resolve "(.+)" \((.+)\)\.?$/i,
    (title, status) =>
      `Complete every child step first: resolve "${title}" (${status}).`,
  ],
  [
    /^Daily release ceiling exceeded\. Only (.+) remains on server date (.+) after released cash and today's scheduled tranches; this tranche needs (.+)\. The schedule override cannot bypass this limit\.?$/i,
    (remaining, date, needed) =>
      `Daily release ceiling exceeded on ${date}. Only ${remaining} remains for today, while this tranche needs ${needed}.`,
  ],
  [
    /^Enter an amount greater than zero for "(.+)"\.?$/i,
    (name) => `Enter an amount greater than zero for "${name}".`,
  ],
  [
    /^Enter up to 30 named subtasks for (.+)\.?$/i,
    (name) => `Enter up to 30 named subtasks for ${name}.`,
  ],
  [
    /^FY (\d{4}(?:\s+Q[1-4])?) does not overlap the project timeline\.?$/i,
    (fy) => `FY ${fy} does not overlap the project timeline.`,
  ],
  [
    /^Funding source (.+): requested (.+), available (.+)\.?$/i,
    (source, requested, available) =>
      `Funding source ${source}: requested ${requested}, only ${available} available.`,
  ],
  [
    /^Insufficient (?:owner-)?department budget\. Shortfall: (.+)\.?$/i,
    (shortfall) => `Insufficient Office budget. Shortfall: ${shortfall}.`,
  ],
  [
    /^Insufficient office petty cash\. Available: (.+)\.?$/i,
    (available) => `Insufficient Office petty cash. Available: ${available}.`,
  ],
  [
    /^Only (.+) remains available on (.+?) · (.+)\.?$/i,
    (remaining, label, detail) =>
      `Only ${remaining} remains available on ${label} · ${detail}.`,
  ],
  [
    /^Only (.+) remains unallocated; release the unused task allocations first\.?$/i,
    (remaining) =>
      `Only ${remaining} remains unallocated; return unused task allocations first.`,
  ],
  [
    /^Project closeout is blocked: (.+)\.?$/i,
    (reason) => `Project closeout is blocked: ${reason}.`,
  ],
  [
    /^Receipt exceeds the configured per-receipt threshold of (.+)\.?$/i,
    (limit) => `Receipt exceeds the per-receipt threshold of ${limit}.`,
  ],
  [
    /^Release dates must be within fiscal year (\d{4})\.?$/i,
    (fy) => `Release dates must be within fiscal year ${fy}.`,
  ],
  [
    /^Scheduled releases exceed the budget for "(.+)"\.?$/i,
    (account) => `Scheduled releases exceed the budget for "${account}".`,
  ],
  [
    /^Start date follows due date: (.+)\.?$/i,
    (title) => `Start date cannot be after due date for "${title}".`,
  ],
  [
    /^Subtask dates cannot be (before|after) (.+)\.?$/i,
    (dir, date) => `Subtask dates cannot be ${dir} ${date}.`,
  ],
  [
    /^Subtask due date cannot be later than its parent task due date(?: \((.+)\))?\.?$/i,
    (date) =>
      date
        ? `Subtask due date cannot be later than its parent task due date (${date}).`
        : "Subtask due date cannot be later than its parent task due date.",
  ],
  [
    /^Task dates cannot be (before|after) the project (start|target) date \((.+)\)\. Extend the project timeline first\.?$/i,
    (dir, bound, date) =>
      `Task dates cannot be ${dir} the project ${bound} date (${date}). Extend the project timeline first.`,
  ],
  [
    /^Task "(.+)" (?:must be marked funded or no cost|has no funding decision)\.?$/i,
    (title) => `Choose whether task "${title}" is funded or no cost.`,
  ],
  [
    /^Task "(.+)" needs at least one funded particular\.?$/i,
    (title) => `Task "${title}" needs at least one funded source.`,
  ],
  [
    /^The cap cannot be lower than its settled spending of (.+)\.?$/i,
    (amount) => `The cap cannot be lower than its settled spending of ${amount}.`,
  ],
  [
    /^The selected budget line has only (.+) available\.?$/i,
    (amount) => `The selected budget line has only ${amount} available.`,
  ],
  [
    /^This release is scheduled for (.+)\. A Head must use the audited schedule override\.?$/i,
    (date) =>
      `This release is scheduled for ${date}. A Head must use the schedule override to release it early.`,
  ],
  [
    /^This source still backs cash or child funding; retain its source and at least (.+)\.?$/i,
    (amount) =>
      `This source still backs cash or child funding; retain at least ${amount}.`,
  ],
  [
    /^This task is blocked until every prerequisite is completed and approved: (.+)\.?$/i,
    (tasks) =>
      `Complete and approve prerequisite tasks first: ${tasks}.`,
  ],
  [
    /^This tranche is scheduled for ([^.]+)\. Use Override schedule and provide a reason to release it early\.?$/i,
    (date) =>
      `This tranche is scheduled for ${date}. Use Override schedule and enter a reason to release it early.`,
  ],
  [
    /^This tranche is scheduled for (.+)\.?$/i,
    (date) => `This tranche is scheduled for ${date}.`,
  ],
  [
    /^This work operation is blocked: (.+); resolve affected work first\.?$/i,
    (reason) => `This action is blocked: ${reason}. Resolve affected work first.`,
  ],
  [
    /^Unsupported evidence MIME type: (.+)\.?$/i,
    (mime) => `Unsupported file type (${mime}). Choose a supported image or document.`,
  ],
  [
    /^Work history or dependent responsibilities block this operation: (.+); resolve affected work first\.?$/i,
    (reason) => `Dependent work blocks this action: ${reason}. Resolve affected work first.`,
  ],
  [
    /^You can start this (subtask|task) on or after (.+)\.?$/i,
    (kind, date) => `You can start this ${kind} on or after ${date}.`,
  ],
];

function normalizeKey(text: string): string {
  return text
    .trim()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/→/g, "->")
    .replace(/\.$/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function matchDomainErrorMessage(
  rawText: string,
  isInternal: (value: string) => boolean,
): string | undefined {
  const key = normalizeKey(rawText);
  if (Object.hasOwn(exactMessages, key)) return exactMessages[key];
  const straight = rawText
    .trim()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"');
  for (const [pattern, format] of patternMessages) {
    const match = straight.match(pattern);
    if (!match) continue;
    const captures = match.slice(1).filter((part): part is string => Boolean(part));
    if (captures.some((part) => isInternal(part))) return undefined;
    return format(...match.slice(1));
  }
  return undefined;
}
