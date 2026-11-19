import type { GuidedTourSection, GuidedTourStep } from "./types";

const SECTION_GUIDANCE: Record<string, string> = {
  personal_work: "Track your assigned work, leading responsibilities, subtasks, pending reviews, and completed history in one personal hub.",
  inbox: "Stay on top of items that need your action, recent notifications, and direct work messages.",
  dashboard: "Review today's workspace summary, live project delivery, urgent deadlines, and items waiting on your attention.",
  command: "Use the command center to review current operations before drilling into detailed workspaces.",
  projects: "Manage office and shared projects with structured task groups, subitems, PDF proposal import, funding authorization, and completion checks.",
  tasks: "Track tasks from planning through approval. Switch between List, Kanban, Timeline, and Hierarchy views without changing the underlying records.",
  budget: "Set and lock the annual Office Budget, authorize project and task funding, review cash releases and receipts, and monitor office petty cash.",
  leading: "Coordinate tasks where you are the Team Leader, break work into subtasks, and review member evidence.",
  subtasks: "Open each assigned subtask, update progress, attach supporting evidence, and submit completed work to your Team Leader.",
  reviews: "Inspect submitted evidence and activity history, approve ready work, or send clear revision notes back to the owner.",
  team: "Open Office Analytics—Delivery, Workload & health, People & skills, Contributions, Reports, and Deep Analysis—plus manage your Office Team roster and invitations.",
  identity: "Review office-level identity, roles, and access assignments for your team.",
  intelligence: "Explore Delivery, Workload & health, People & skills, Contributions, exportable Reports, and Deep Analysis to spot workflow bottlenecks and rework.",
  deadlines: "Spot upcoming and overdue work in one timeline and open any affected task immediately.",
  history: "Review completed, cancelled, reopened, and previously submitted items with their full audit history intact.",
  performance: "Check your operational performance metrics and the recorded work used to calculate them.",
  reports: "Filter operational reports by report type, period, project, person, or status, and export clean CSV or PDF copies directly.",
  accounting_overview: "Monitor pending cash releases, open liquidations, and fiscal-year office ledger totals from one accounting dashboard.",
  accounting_releases: "Release authorized cash or cheque vouchers, record acknowledgements, and settle submitted liquidation receipts.",
  accounting_journal: "Inspect double-entry accounting entries generated from verified releases and settlements.",
  accounting_audit: "Review the immutable financial audit trail of releases, adjustments, and verifications.",
  accounting_budgets: "Inspect fiscal-year Office Budget ledgers, remaining balances, and pending financial actions.",
  announcements: "Read official announcements and see which notices are new or already viewed.",
  users: "Manage user accounts, locked accounts, role defaults, user access overrides, account audit records, and system settings.",
  org_tree: "Maintain the official office hierarchy and assign each office's Head.",
  permissions: "Review role defaults and user-specific overrides. Database security continues to be enforced directly by Supabase policies.",
  audit: "Inspect accountable system activity with actors, timestamps, affected records, and recorded reasons.",
  administration: "Maintain system-wide branding, maintenance notices, and operational settings for administrators.",
  migration: "Run reviewed data tools safely and verify results before leaving the page.",
  settings: "Update your display name, avatar, regional date and time format, theme, layout density, notifications, password, and local cache.",
};

const PAGE_GUIDANCE: Record<string, string> = {
  "personal_work:Assigned work": "Your active tasks and deliverables across workspaces live right here in My Work. Filter by due date or status and click any task to open its full details.",
  "personal_work:Leading": "View every task and subtask you lead or supervise across workspaces, delegate work cleanly, and keep track of your branch progress.",
  "personal_work:Subtasks": "See all subtask steps assigned to you grouped by project and parent task, log progress, attach evidence, and submit finished work.",
  "personal_work:Reviews": "Inspect subtask completion submissions and check-ins waiting on your decision so work moves smoothly without delays.",
  "personal_work:History": "Browse completed, cancelled, and archived work records across your workspaces with their full audit trail intact.",
  "dashboard:Workspace Overview": "Review today's office summary, live delivery progress, urgent deadlines, and items waiting for your attention.",
  "budget:Office Budget": "Plan and lock your annual Office Budget, authorize project and task funding without double-charging, review cash releases and receipts, and manage office petty cash.",
  "team:Analytics": "Explore six live Office Analytics views: Delivery, Workload & health, People & skills, Contributions, clean CSV/PDF Reports, and Deep Analysis (draggable workflow map, right-click stage actions, and saved snapshot history).",
  "team:Office Team": "Search active Office members, track invitation validity separately from email delivery, open authorized member summaries, and invite new Members or Accounting Staff.",
  "projects:Projects": "Open active projects, star Favorites for quick access, browse Archived projects, organize tasks into groups and subitems, import PDF proposals, and manage project funding.",
  "inbox:Needs action": "Focus first on pending approvals, review requests, and items waiting directly on your response.",
  "inbox:Notifications": "Read recent workspace updates, task status changes, and funding alerts in one chronological feed.",
  "inbox:Messages": "Open work conversations linked to tasks and projects and keep up with team discussions right inside eFlow.",
  "reviews:For Review": "Review submitted project and task work, verify attached evidence and history, then approve or request specific revisions.",
  "reviews:Leader Reviews": "Review submissions routed to you as a Team Leader, inspect evidence, and approve or return items with clear feedback.",
  "accounting_releases:Voucher & Cash Releases": "Process authorized cash and cheque releases, verify project funding links, and track recipient acknowledgements.",
  "accounting_releases:Settlements": "Inspect submitted liquidation receipts, check remaining balances, and settle or return items needing correction.",
  "users:People & Accounts": "Create and maintain LEDIPO staff accounts, pending invitations, lockouts, and active account status.",
  "users:Roles & Access": "Manage role defaults and per-user permission overrides while database security remains enforced independently in Supabase.",
  "users:Account Audit": "Inspect accountable administrative activity with actors, timestamps, targets, and recorded reasons.",
  "users:System & Maintenance": "Maintain workspace branding, maintenance notices, work statuses, skill tags, and system-wide settings.",
  "users:Backup & Export": "Use reviewed backup and export tools safely and verify results before leaving the page.",
  "users:All Users": "Create and maintain LEDIPO staff accounts, employment identifiers, and active account status.",
  "users:Locked out accounts": "Review accounts locked after repeated sign-in failures and restore verified access safely.",
  "users:Role Defaults": "Configure default role capabilities while keeping database security enforced independently in Supabase.",
  "users:User Access": "Apply and audit explicit per-user permission overrides when a role exception is needed.",
  "users:System Settings": "Configure workspace branding, maintenance notices, and system-wide administrative defaults.",
};

const SECTION_NARRATION: Record<string, string> = {
  personal_work: "Here's your My Work hub! It pulls together everything assigned to you, the tasks you lead, your subtasks, reviews, and past history so you never have to hunt across screens.",
  inbox: "Your Inbox keeps actionable work front and center. Check Needs action first for approvals or handoffs, then glance through notifications and work messages right beside them.",
  dashboard: "Workspace Overview gives you a calm snapshot of today's operations. You'll quickly spot active project progress, upcoming deadlines, and anything waiting for your input.",
  projects: "Projects is where your office plans come to life! Open any project to organize tasks in groups, expand subitems, import tasks from a PDF proposal, and keep funding cleanly tied to the work.",
  tasks: "In Tasks, you can look at the exact same live records in whichever layout feels best for you, whether that's a structured list, a Kanban board, a timeline, or a full hierarchy.",
  budget: "Office Budget keeps your fiscal year under control. Set and lock your annual budget first, authorize funding into projects and tasks without double-charging, and verify cash releases and receipts in one place.",
  leading: "When you're leading a task, this space helps you split the work into clear subtasks, assign teammates, and review their evidence before forwarding it along.",
  subtasks: "My Subtasks focuses on the hands-on pieces assigned to you. Open any item to log progress, attach your supporting files, and submit it smoothly to your Team Leader.",
  reviews: "Reviews brings every submitted item straight to you. Take a quick look at the attached evidence and history, then either approve it or send back clear notes for a quick fix.",
  team: "This is your command center for Analytics and your Office Team! Inside Analytics you can explore Delivery, Workload and health, People and skills, Contributions, exportable Reports, and Deep Analysis, or switch to Office Team to invite and manage members.",
  identity: "Identity and Access gives you a clear view of your office roles and permissions so everyone has just the access they need.",
  intelligence: "Analytics pulls your live delivery, workload, contributions, clean CSV and PDF reports, and Deep Analysis workflow maps into one place so you can spot slowdowns early.",
  deadlines: "Deadlines lines up what's coming due and what's overdue, making it easy to jump straight into the items that need a nudge today.",
  history: "History keeps a clean, read-only trail of completed, cancelled, and reopened work whenever you need to look back at how something wrapped up.",
  performance: "Performance highlights your delivery trends along with the actual records behind each number, so everything stays transparent.",
  reports: "Reports gives you clean, filterable tables across operations, projects, reviews, evidence, and risks. Narrow down what you need and export straight to CSV or PDF anytime.",
  accounting_overview: "Accounting Overview gives you an instant read on pending voucher releases, open settlements, and office ledger balances.",
  accounting_releases: "Here's where Accounting handles cash and cheque releases alongside liquidation settlements, keeping every disbursement linked to its receipts.",
  accounting_journal: "General Journal maintains clean double-entry records for every verified release and settlement automatically.",
  accounting_audit: "Financial Audit Trail preserves the complete timeline of approvals, releases, and adjustments so every peso stays accounted for.",
  accounting_budgets: "Office Budget Ledgers lets Accounting review fiscal-year allocations, available funds, and pending financial items across offices.",
  users: "Admin Center puts user accounts, locked-out accounts, role defaults, user overrides, account audit logs, and system settings right at your fingertips.",
  org_tree: "Use the office structure view to organize offices cleanly and confirm who leads each one.",
  permissions: "Review role defaults and individual overrides here. Remember, backend security policies always stay enforced independently in Supabase.",
  audit: "Account Audit records who did what, when it happened, and the reason behind every sensitive change.",
  administration: "System Settings lets administrators manage workspace branding, maintenance banners, and operational defaults safely.",
  settings: "Personal Settings lets you make eFlow feel comfortable, from your profile and date formats to light or dark theme, density, notifications, and local cache controls.",
};

const PAGE_NARRATION: Record<string, string> = {
  "personal_work:Assigned work": "Let's start at the top in My Work! Assigned work is your personal task list across every workspace you belong to. Filter by status or due date, and click any task to jump right in.",
  "personal_work:Leading": "Next down is Work I lead. Whenever you supervise a task or coordinate a team branch, everything you're leading lines up neatly right here.",
  "personal_work:Subtasks": "Right below that is Subtasks, showing the hands-on steps assigned to you grouped by project and parent task so you can attach evidence and submit cleanly.",
  "personal_work:Reviews": "Next up in My Work is Reviews, where subtask submissions and check-ins wait for your quick look before moving forward.",
  "personal_work:History": "And wrapping up My Work is History, a clean record of completed, cancelled, and archived items whenever you want to look back.",
  "dashboard:Workspace Overview": "Now we're moving into Workspace, starting right at the top with Workspace Overview! Think of this as your live snapshot of office delivery, active priorities, and upcoming deadlines.",
  "budget:Office Budget": "Right below Overview is Office Budget. This is where you set and lock your annual budget, authorize project and task funding once without double-charging, and track cash releases, receipts, and petty cash.",
  "team:Analytics": "Next down is Analytics! Open this for Delivery, Workload and health, People and skills, Contributions, clean CSV and PDF Reports, and Deep Analysis, where you can drag workflow stage boxes, right-click any stage to inspect its actions, and view saved reports even when the analysis server is offline.",
  "team:Office Team": "Right under Analytics is Office Team. Search your active office roster, check invitation status, inspect authorized member profiles, and invite new teammates by email.",
  "projects:Projects": "Next in Workspace is your Projects section, along with Favorites and Archived projects! Click any project to organize task groups and subitems, import a PDF proposal, or check funding and completion requirements.",
  "inbox:Needs action": "Now let's step down to Inbox! Needs action sits right at the top so pending approvals and requests waiting on you never get buried.",
  "inbox:Notifications": "Right below that is Notifications, keeping your workspace updates, task status changes, and funding notices easy to scan.",
  "inbox:Messages": "Next is Messages, where your team chats and project conversations stay connected without leaving eFlow.",
  "reviews:For Review": "And right below Messages in Inbox is Reviews, your dedicated queue for checking submitted work evidence and either approving it or requesting clear fixes.",
  "reviews:Leader Reviews": "Right here in Inbox is Leader Reviews, where submissions from your teammates await your review before moving ahead.",
  "accounting_releases:Voucher & Cash Releases": "Here in Voucher and Cash Releases, Accounting processes approved disbursements and tracks acknowledgements cleanly.",
  "accounting_releases:Settlements": "Next down is Settlements, where submitted liquidation receipts are verified and closed out accurately.",
  "users:People & Accounts": "Starting at the top of Admin Center, People and Accounts lets you create LEDIPO staff accounts, check invitations, and unlock accounts safely.",
  "users:Roles & Access": "Next down is Roles and Access, where you review default role capabilities and individual overrides while Supabase policies stay enforced behind the scenes.",
  "users:Account Audit": "Account Audit tracks every administrative change with timestamps, actors, and recorded reasons.",
  "users:System & Maintenance": "Next is System and Maintenance for branding, maintenance banners, work statuses, skill tags, and operational defaults.",
  "users:Backup & Export": "And right below that is Backup, giving administrators safe, controlled tools to export and verify system data.",
  "users:All Users": "Starting in Admin Center, All Users lets you create LEDIPO staff accounts and manage active user profiles.",
  "users:Locked out accounts": "Next down is Locked out accounts, making it easy to verify and unlock teammates who hit sign-in lockouts.",
  "users:Role Defaults": "Here in Role Defaults, you review and adjust baseline capabilities for each role safely.",
  "users:User Access": "Next is User Access, where you can grant or review individual permission overrides cleanly.",
  "users:System Settings": "And System Settings manages workspace branding, maintenance notices, and global administrative defaults.",
};

export function getSectionGuidance(section: string, label: string, page?: string): string {
  if (page && PAGE_GUIDANCE[`${section}:${page}`]) {
    return PAGE_GUIDANCE[`${section}:${page}`];
  }
  return SECTION_GUIDANCE[section] || `Use ${label} to review and complete the responsibilities available to your role.`;
}

function getSectionNarration(section: string, label: string, page?: string): string {
  if (page && PAGE_NARRATION[`${section}:${page}`]) {
    return PAGE_NARRATION[`${section}:${page}`];
  }
  return (
    SECTION_NARRATION[section]
    || `Over here is ${label}. Open it whenever you want to check your current items and take action within your role.`
  );
}

function slugifyPage(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page";
}

function queryDestinationElement(sectionId: string, page: string): HTMLElement | null {
  const escaped = `${sectionId}:${page}`.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return document.querySelector<HTMLElement>(`[data-tour-dest="${escaped}"]`);
}

export function getSystemTourSteps(
  sections: GuidedTourSection[],
  navigate: (section: string, page: string) => void,
): GuidedTourStep[] {
  const idCounts = new Map<string, number>();
  for (const section of sections) {
    idCounts.set(section.id, (idCounts.get(section.id) || 0) + 1);
  }

  return [
    {
      id: "system-welcome",
      title: "Welcome to eFlow",
      description: "This interactive tour walks tab by tab through your role-specific workspace. It only explains the interface and never creates, edits, approves, or deletes records.",
      narration: "Welcome to eFlow! Let's take a smooth, tab-by-tab walk through your workspace from top to bottom. Don't worry about changing anything here, this tour is completely read-only.",
      target: "[data-tour-id='brand']",
    },
    {
      id: "system-navigation",
      title: "Your navigation",
      description: "The left rail groups your destinations from top to bottom—My Work, Workspace, Inbox, and any Accounting or Admin Center tools for your role. The panel beside it shows each group's tabs and your project tree.",
      narration: "First, let's get oriented on the left side. Your main rail flows top to bottom from My Work, to Workspace, to Inbox, and any role-specific workspaces below that. Let's walk straight down them in order!",
      target: "[data-tour-id='primary-navigation']",
    },
    ...sections.map((section) => {
      const hasDuplicates = (idCounts.get(section.id) || 0) > 1;
      return {
        id: hasDuplicates
          ? `system-section-${section.id}-${slugifyPage(section.page)}`
          : `system-section-${section.id}`,
        title: section.label,
        description: getSectionGuidance(section.id, section.label, section.page),
        narration: getSectionNarration(section.id, section.label, section.page),
        target: () =>
          queryDestinationElement(section.id, section.page)
          || (!hasDuplicates ? document.querySelector<HTMLElement>(`[data-tour-section='${section.id}']`) : null),
        fallbackTarget: () =>
          document.querySelector<HTMLElement>(`[data-tour-section='${section.id}']`)
          || document.querySelector<HTMLElement>("[data-tour-id='primary-navigation']"),
        beforeShow: () => navigate(section.id, section.page),
      };
    }),
    {
      id: "system-page-help",
      title: "Help & replayable guides",
      description: "Open Help anytime to launch Guide for this page on the exact screen you're viewing, or choose Tour of eFlow to replay this full walkthrough.",
      narration: "Whenever you want a quick refresher on the exact page you're looking at, or want to replay this full tour, just open Help right here!",
      target: "[data-tour-id='workspace-help']",
    },
    {
      id: "system-communication",
      title: "Notifications and messages",
      description: "Check real-time notifications, open work conversations, and catch incoming call alerts without leaving your current page.",
      narration: "Right next to Help, your alerts and messages stay within easy reach so you can reply to teammates without losing your spot.",
      target: "[data-tour-id='communications']",
    },
    {
      id: "system-settings",
      title: "Profile and settings",
      description: "Open Profile & settings from the account menu to customize your display name, photo, regional dates, theme, notifications, password, and local cache.",
      narration: "Through your account menu, you can adjust your profile, date formats, light or dark theme, notifications, and security settings anytime.",
      target: "[data-tour-id='settings']",
    },
    {
      id: "system-profile",
      title: "Your signed-in account",
      description: "Verify your active account name here, and remember to log out when finishing on a shared device.",
      narration: "And right here confirms the account you're signed in with. Remember to log out on a shared device. You're all set to dive in!",
      target: "[data-tour-id='profile']",
    },
  ];
}

export function getPageTourSteps(section: string, page?: string): GuidedTourStep[] {
  const label = page || section;

  if (section === "projects" && page === "Projects") {
    return [
      {
        id: "project-context",
        title: "Choose or create a project",
        description: "Switch between projects from the Workspace sidebar or star favorites for fast access. Authorized leads can create projects, import PDF proposals, and manage work plans here.",
        narration: "Let's walk through your Projects workspace! On the left, you can jump between projects or star the ones you open most often. If your role allows it, this is also where you start new projects or import a PDF proposal.",
        target: () =>
          document.querySelector<HTMLElement>("[aria-label='Workspace content']")
          || document.querySelector<HTMLElement>("[aria-label='Mobile primary navigation']")
          || document.querySelector<HTMLElement>("[data-tour-page-content]"),
      },
      {
        id: "project-main-table",
        title: "Your main working table",
        description: "Groups organize tasks; expand a task to see its subitems. Your changes use the same records as evidence, reviews and budget workflows.",
        narration: "Here's your main project table. Tasks are neatly organized into groups, and you can expand any task to work directly on its subitems. Everything you update here stays automatically in sync with evidence, reviews, and budget tracking.",
        target: "[data-tour-id='project-main-table']",
      },
      {
        id: "project-table-tools",
        title: "Add, import, and filter work",
        description: "Use New task for individual items or Import PDF to turn a proposal into groups, tasks, dates, priorities, and budget estimates. Search, filter, sort, and customize visible columns anytime.",
        narration: "Right above the table are your quick tools. Add a single task in seconds, or import a full PDF proposal to generate structured groups and estimates automatically. You can also search, filter, and tailor the visible columns to fit how you work.",
        target: "[data-tour-id='project-table-toolbar']",
      },
      {
        id: "project-replay",
        title: "Inspect details or revisit this guide",
        description: "Click any task for evidence, review routing, staffing suggestions, and funding. Office Heads can check completion requirements before closing a project. Open Help → Guide for this page anytime.",
        narration: "Whenever you need deeper details, click any task to open evidence, reviews, staffing suggestions, and funding. And if you ever want a refresher on this screen, just open Help and pick Guide for this page!",
        target: "[data-tour-id='workspace-help']",
      },
    ];
  }

  if (section === "team" && page === "Office Team") {
    return [
      {
        id: "office-team",
        title: "Your Office Team",
        description: "Search active team members and track invitation status separately from email delivery. Select a member to view their authorized professional summary.",
        narration: "Welcome to Office Team! Here you can search everyone in your office, check which invitations are still active, and open any member to review their professional summary.",
        target: "[data-tour-id='office-team']",
      },
      {
        id: "invite-member",
        title: "Bring your team in",
        description: "Invite Members or Accounting Staff by email. PDS attachments are optional—each teammate reviews and confirms their own profile once they join.",
        narration: "Ready to add someone new? Just click Invite to bring in Members or Accounting Staff by email. Attaching a PDS is optional, and each teammate will review their own profile when they sign in.",
        target: "[data-tour-id='invite-member']",
      },
    ];
  }

  if ((section === "team" || section === "intelligence") && page === "Analytics") {
    return [
      {
        id: "analytics-overview",
        title: "Office Analytics views",
        description: "Switch across Delivery, Workload & health, People & skills, Contributions, Reports, and Deep Analysis to inspect your office from every angle without changing live records.",
        narration: "Welcome to Analytics! These tabs give you six clean lenses on your office, from live project delivery and team workload to contributions, reports, and Deep Analysis, all completely safe to explore.",
        target: () =>
          document.querySelector<HTMLElement>("[data-tour-id='analytics-tabs']")
          || document.querySelector<HTMLElement>("[data-tour-page-content]"),
      },
      {
        id: "analytics-reports",
        title: "Clean operational Reports",
        description: "Open the Reports tab to filter operations, projects, contributions, reviews, evidence, risks, or lifecycle history, then export straight to CSV or PDF.",
        narration: "Need to share numbers or print a summary? The Reports tab lets you slice your office records by date, project, person, or status and export clean CSV or PDF reports right away.",
        target: () =>
          document.querySelector<HTMLElement>("[data-tour-id='analytics-reports-tab']")
          || document.querySelector<HTMLElement>("[data-tour-id='analytics-tabs']")
          || document.querySelector<HTMLElement>("[data-tour-page-content]"),
      },
      {
        id: "analytics-deep-analysis",
        title: "Deep Analysis workflow discovery",
        description: "Deep Analysis maps how projects actually moved across stages, highlights slowdowns and rework loops, lets you drag stage boxes to arrange the map, right-click any stage box to inspect its exact actions, and loads the last saved snapshot with exact date and time when the analysis server is offline.",
        narration: "Here's one of the coolest tools in eFlow: Deep Analysis! It shows how your projects really moved across stages and highlights where work slows down or gets sent back. You can drag any stage box around to organize the map your way, and right-click any box to see the exact actions behind it. Best of all, even if the analysis server is offline, it automatically shows your last saved report with its exact date and time.",
        target: () =>
          document.querySelector<HTMLElement>("[data-tour-id='analytics-deep-analysis-tab']")
          || document.querySelector<HTMLElement>("[data-tour-id='analytics-tabs']")
          || document.querySelector<HTMLElement>("[data-tour-page-content]"),
      },
      {
        id: "analytics-help",
        title: "Revisit this guide anytime",
        description: "Open Help and choose Guide for this page whenever you want a quick reminder of how Analytics, Reports, and Deep Analysis work.",
        narration: "That's the tour of Analytics! Whenever you want to revisit these tips, just open Help up top and select Guide for this page.",
        target: "[data-tour-id='workspace-help']",
      },
    ];
  }

  if (section === "budget" || section === "accounting_budgets") {
    return [
      {
        id: "budget-header",
        title: `${label} overview`,
        description: "Pick your fiscal year at the top right, check whether the annual budget is still in draft or locked, and keep project and task funding aligned with available funds.",
        narration: `Let's look around ${label}. Up top, you can switch fiscal years and immediately see whether the annual budget is locked and ready for funding.`,
        target: () =>
          document.querySelector<HTMLElement>("[data-tour-page-content] h1")
          || document.querySelector<HTMLElement>("[data-tour-page-content]"),
      },
      {
        id: "budget-views",
        title: "Budget views and controls",
        description: "Move cleanly between annual allocations, project funding, task requests, cash releases, liquidations, audit entries, and office petty cash from this toolbar.",
        narration: "Use these view tabs to move smoothly from annual setup and allocations over to cash releases, receipts, and petty cash, without losing track of your fiscal year.",
        target: () =>
          document.querySelector<HTMLElement>("[data-tour-id='office-budget-views']")
          || document.querySelector<HTMLElement>("[data-tour-page-content]"),
      },
      {
        id: "budget-flow",
        title: "How funding flows safely",
        description: "Authorizing project funding reserves the Office Budget once. Task allocations and cash requests draw from that reserved pool so funds are never double-charged, and unused balances can be returned at closeout.",
        narration: "Here's a helpful rule to keep in mind: authorizing funds for a project reserves your Office Budget just once. Tasks draw from that reserved pool, so you never have to worry about double-charging, and unused amounts can be returned cleanly when a project wraps up.",
        target: "[data-tour-page-content]",
      },
      {
        id: "budget-help",
        title: "Revisit this guide anytime",
        description: "Open Help → Guide for this page whenever you want to review the budget workflow without touching any ledger numbers.",
        narration: "And you can always come back to this guide from Help whenever you want a quick budget refresher!",
        target: "[data-tour-id='workspace-help']",
      },
    ];
  }

  if (section === "dashboard") {
    return [
      {
        id: "dashboard-sidebar",
        title: "Workspace Overview",
        description: "This is your starting point for today's office operations. Use the sidebar anytime to jump into Office Budget, Analytics, Office Team, or Projects.",
        narration: "Welcome to Workspace Overview! Think of this as your morning briefing for the office, with Office Budget, Analytics, Office Team, and Projects right below it in the sidebar.",
        target: () => queryDestinationElement("dashboard", "Workspace Overview") || document.querySelector<HTMLElement>(`[data-tour-section='${section}']`),
      },
      {
        id: "dashboard-summary",
        title: "Today's operational pulse",
        description: "Scan active delivery progress, upcoming deadlines, and items waiting on review or assignment so you can prioritize quickly.",
        narration: "Start by glancing over your active progress and deadlines right here. It makes spotting urgent work super quick before you dive into the details.",
        target: () =>
          document.querySelector<HTMLElement>("[data-tour-page-content] h1")
          || document.querySelector<HTMLElement>("[data-tour-page-content]"),
      },
      {
        id: "dashboard-drilldown",
        title: "Jump straight into work",
        description: "Click any project, task, or team member card to open the live record directly without losing your navigation context.",
        narration: "Whenever something catches your eye, just click it! You'll jump straight into the live project or task so you can act right away.",
        target: "[data-tour-page-content]",
      },
      {
        id: "dashboard-help",
        title: "Guide available anytime",
        description: "Open Help → Guide for this page for page-specific help, or choose Tour of eFlow for the full system walkthrough.",
        narration: "If you ever want a reminder, Help is right up top with both page guides and the full tour of eFlow.",
        target: "[data-tour-id='workspace-help']",
      },
    ];
  }

  if (section === "personal_work" || section === "tasks" || section === "subtasks") {
    const displayTitle = section === "personal_work" && page === "Leading" ? "Work I lead" : label;
    return [
      {
        id: "work-sidebar",
        title: `${displayTitle} in My Work`,
        description: "Use My Work on the left to move smoothly across Assigned work, Work I lead, Subtasks, Reviews, and History.",
        narration: `Let's take a quick look around ${displayTitle}. You can switch smoothly between your assigned work, tasks you lead, subtasks, reviews, and history right in the My Work sidebar.`,
        target: () =>
          (page ? queryDestinationElement(section, page) : null)
          || document.querySelector<HTMLElement>(`[data-tour-section='${section}']`),
      },
      {
        id: "work-title",
        title: displayTitle,
        description: getSectionGuidance(section, displayTitle, page),
        narration: getSectionNarration(section, displayTitle, page),
        target: () =>
          document.querySelector<HTMLElement>("[data-tour-page-content] h1")
          || document.querySelector<HTMLElement>("[data-tour-page-content]"),
      },
      {
        id: "work-actions",
        title: "Update progress and attach evidence",
        description: "Open any task or subtask to view requirements, request task cash if needed, upload evidence files, and submit finished work for review.",
        narration: "Click any item to open its full drawer. That's where you'll check instructions, attach your evidence files, handle task funding if needed, and send completed work for review.",
        target: "[data-tour-page-content]",
      },
      {
        id: "work-help",
        title: "Walkthrough available anytime",
        description: "Reopen this guide anytime from Help → Guide for this page. Exploring the guide never modifies your tasks or submissions.",
        narration: "You're good to go! Reopen this walkthrough anytime from the Help button whenever you need a quick refresher.",
        target: "[data-tour-id='workspace-help']",
      },
    ];
  }

  if (section === "inbox" || section === "reviews") {
    return [
      {
        id: "inbox-nav",
        title: `${label} in Inbox`,
        description: "Switch between Needs action, Notifications, Messages, and pending Reviews right from the Inbox sidebar.",
        narration: `Here's your ${label} view inside Inbox. It keeps everything waiting for your response neatly separated from notifications and team chats.`,
        target: () =>
          (page ? queryDestinationElement(section, page) : null)
          || document.querySelector<HTMLElement>(`[data-tour-section='${section}']`),
      },
      {
        id: "inbox-focus",
        title: "Inspect before deciding",
        description: "Open any pending submission to review attached evidence, subtask completion, and past comments before approving or requesting changes.",
        narration: "When something is ready for review, click to check the attached evidence and notes first. From there, you can approve it cleanly or send back specific feedback for revision.",
        target: () =>
          document.querySelector<HTMLElement>("[data-tour-page-content] h1")
          || document.querySelector<HTMLElement>("[data-tour-page-content]"),
      },
      {
        id: "inbox-workspace",
        title: "Act without losing context",
        description: "Every decision, comment, and approval records an audit timestamp automatically while keeping the item linked to its project.",
        narration: "Every approval or revision note is logged automatically with its timestamp, so your team always knows the latest status without extra follow-up messages.",
        target: "[data-tour-page-content]",
      },
      {
        id: "inbox-help",
        title: "Walkthrough available anytime",
        description: "Reopen this guide from Help → Guide for this page whenever you need a refresher.",
        narration: "And remember, Help is always right here if you want to replay this guide later!",
        target: "[data-tour-id='workspace-help']",
      },
    ];
  }

  if (section === "reports") {
    return [
      {
        id: "reports-nav",
        title: `${label} in the sidebar`,
        description: "Open Reports whenever you need structured, filterable tables of office operations, projects, reviews, evidence, or risks.",
        narration: `Welcome to ${label}! This is your go-to place for clean, structured tables you can filter and export in seconds.`,
        target: () =>
          (page ? queryDestinationElement(section, page) : null)
          || document.querySelector<HTMLElement>(`[data-tour-section='${section}']`),
      },
      {
        id: "reports-filters",
        title: "Choose a report and filter",
        description: "Pick a report category, narrow by date range, project, team member, or status, and verify the live totals directly on screen.",
        narration: "Start by choosing the report type you need, then dial in your date range, project, or teammate filters so you see only the exact records that matter.",
        target: () =>
          document.querySelector<HTMLElement>("[data-tour-page-content] h1")
          || document.querySelector<HTMLElement>("[data-tour-page-content]"),
      },
      {
        id: "reports-export",
        title: "Export directly to CSV or PDF",
        description: "Use the Export menu to download your filtered table straight to CSV or PDF with matching headers and scope.",
        narration: "Once the table looks just right, open Export to save a crisp CSV or PDF copy ready for meetings or filing.",
        target: "[data-tour-page-content]",
      },
      {
        id: "reports-help",
        title: "Walkthrough available anytime",
        description: "Reopen this guide from Help → Guide for this page anytime.",
        narration: "Simple as that! Open Help anytime you want to run through this page guide again.",
        target: "[data-tour-id='workspace-help']",
      },
    ];
  }

  if (section.startsWith("accounting_")) {
    return [
      {
        id: "accounting-nav",
        title: `${label} in Accounting`,
        description: "Use the Accounting rail to move across Overview, Voucher & Cash Releases, Settlements, General Journal, Audit Trail, and Office Budget Ledgers.",
        narration: `Let's look through ${label}. Your Accounting menu keeps releases, settlements, journal entries, and office ledgers grouped neatly together.`,
        target: () =>
          (page ? queryDestinationElement(section, page) : null)
          || document.querySelector<HTMLElement>(`[data-tour-section='${section}']`),
      },
      {
        id: "accounting-title",
        title: label,
        description: getSectionGuidance(section, label, page),
        narration: getSectionNarration(section, label, page),
        target: () =>
          document.querySelector<HTMLElement>("[data-tour-page-content] h1")
          || document.querySelector<HTMLElement>("[data-tour-page-content]"),
      },
      {
        id: "accounting-workspace",
        title: "Verify records before posting",
        description: "Inspect linked project funding, release acknowledgements, and uploaded receipts before completing a release or settlement. Every step writes to the financial audit trail.",
        narration: "Before finalizing any release or settlement, take a quick look at the linked funding and receipts right here. Every completed action is automatically recorded in the audit trail.",
        target: "[data-tour-page-content]",
      },
      {
        id: "accounting-help",
        title: "Walkthrough available anytime",
        description: "Reopen this guide from Help → Guide for this page anytime without affecting financial records.",
        narration: "Whenever you'd like a quick recap of this accounting screen, just open Help up top!",
        target: "[data-tour-id='workspace-help']",
      },
    ];
  }

  if (section === "settings") {
    return [
      {
        id: "settings-nav",
        title: "Personal settings",
        description: "Switch between Profile, Appearance, Notifications, Security, and Storage & cache to tailor how eFlow looks and behaves for you.",
        narration: "Welcome to your personal settings! From here you can fine-tune your profile, visual theme, notifications, password, and local browser cache.",
        target: "[data-tour-id='settings']",
      },
      {
        id: "settings-section",
        title: label,
        description: getSectionGuidance("settings", label, page),
        narration: "Make any adjustments you'd like right here. eFlow will warn you if you have unsaved edits before you navigate away.",
        target: () =>
          document.querySelector<HTMLElement>("[data-tour-page-content] h1")
          || document.querySelector<HTMLElement>("[data-tour-page-content]"),
      },
      {
        id: "settings-storage",
        title: "Safe drafts and local cache",
        description: "Use Storage & cache if you ever need to check saved local drafts or refresh cached workspace data on this device.",
        narration: "Tip: if you ever want to check locally saved drafts or clear cached workspace reads on this browser, the Storage and cache tab handles that cleanly.",
        target: "[data-tour-page-content]",
      },
      {
        id: "settings-help",
        title: "Walkthrough available anytime",
        description: "Reopen this guide anytime from Help → Guide for this page.",
        narration: "That's everything in Settings! You can always open Help up top if you need a hand.",
        target: "[data-tour-id='workspace-help']",
      },
    ];
  }

  return [
    {
      id: "page-navigation",
      title: `${label} in the sidebar`,
      description: "The highlighted navigation item shows where you are. Choose another authorized destination from the sidebar, or open More on a small screen.",
      narration: `Let's take a quick look around ${label}. The highlighted spot in your sidebar always shows where you are, so switching workspaces stays effortless.`,
      target: () =>
        (page ? queryDestinationElement(section, page) : null)
        || document.querySelector<HTMLElement>(`[data-tour-section='${section}']`),
    },
    {
      id: "page-title",
      title: label,
      description: getSectionGuidance(section, label, page),
      narration: getSectionNarration(section, label, page),
      target: () =>
        document.querySelector<HTMLElement>("[data-tour-page-content] h1")
        || document.querySelector<HTMLElement>("[data-tour-page-content]"),
    },
    {
      id: "page-workspace",
      title: "Working on this page",
      description: "Review the summary first, then use the visible filters, views, cards, tables, and action buttons. Unsaved drafts prompt before you leave, and disabled controls explain any missing prerequisites.",
      narration: "Start with the summary at the top, then use the filters and action buttons below to get things done. Don't worry about losing edits either, eFlow prompts you before discarding unsaved drafts.",
      target: "[data-tour-page-content]",
    },
    {
      id: "page-help",
      title: "Walkthrough available anytime",
      description: "You can reopen this page guide whenever you need a reminder. Completing or skipping the guide never changes operational data.",
      narration: "And you're all set! You can replay this page guide anytime from Help, and it will never touch your live data.",
      target: "[data-tour-id='workspace-help']",
    },
  ];
}
