import { Bell, MessageCircle } from "lucide-react";
import { PreparationScreens } from "./screens/PreparationScreens";
import { ApprovalScreens } from "./screens/ApprovalScreens";
import { TaskScreens } from "./screens/TaskScreens";
import { BudgetScreens } from "./screens/BudgetScreens";
import { CloseoutScreens } from "./screens/CloseoutScreens";
import { DemoBadge, type DemoScreenProps } from "./screens/PreviewControls";
import { getPreviewWorkspace } from "./previewWorkspace";
import styles from "./WorkflowDemo.module.scss";

export function WorkflowDemo(props: DemoScreenProps) {
  const { step, kind } = props;
  const draft = step.stage === "prepare" || step.stage === "approve";
  const plans = step.workspace === "plans";
  const workspace = getPreviewWorkspace(step);
  const leader = step.actor === "Task Leader";
  const employee = leader || step.workspace === "subtasks" || step.workspace === "accounting";
  const nav = employee ? ["My Tasks", "Projects", "Work I'm Leading", "My Subtasks", "Leader Reviews", ...(step.workspace === "accounting" ? ["Voucher & Cash Releases", "General Journal"] : [])] : ["Overview", "Plans & Projects", "Task Board", "Department Budget", "Work I'm Leading", "My Subtasks", "Reviews"];
  const tabs = plans ? ["Overview", draft ? "Work plan" : "Project tasks", "Collaboration", ...(kind === "interdepartmental" ? ["Review & Governance"] : [])]
    : step.workspace === "reviews" ? ["Work Plans", "Project Tasks", "Governance & Approval", "Subtasks", "Budget"]
    : step.workspace === "budget" ? ["Overview", "Planning & Allocation", "Requests & Settlement", "Ledger & Audit"] : [];
  const budgetTabs = step.workspace === "budget" ? ["Annual Budget", "Proposal & Task Funding"] : [];
  const drawer = step.workspace === "leading" && step.detail?.includes("View Details");
  return <div className={styles.app} data-preview-screen={step.screen} data-preview-workspace={step.workspace} data-preview-tab={step.tab} data-preview-detail={step.detail} aria-label={`Example eFlow screen: ${workspace.path}`}>
    <header className={styles.appHeader}><div className={styles.brand}>eFlow<span>LGU Ormoc City</span></div><div className={styles.appAccount}><Bell size={15} /><MessageCircle size={15} /><span className={styles.avatar}>EF</span><div><strong>{workspace.label}</strong><small>{step.actor}</small></div></div></header>
    <div className={styles.appBody}>
      <aside className={styles.sidebar}><section><h3>{employee ? "My workspace" : "Department workspace"}</h3>{nav.map((label) => <div key={label} className={label === workspace.label ? styles.sidebarSelected : ""}>{label}</div>)}</section>
        {plans && <><section><h3>Projects</h3><p>{draft ? "No active projects." : "Community Services Improvement"}</p><small>▸ Archived projects ({step.screen === "archived" ? "1" : "0"})</small><div className={styles.sidebarCreate}>＋ Create work plan</div></section><section><h3>Planning</h3><div className={draft ? styles.sidebarSelected : ""}>Drafts <span>{draft ? "1" : "0"}</span></div><div>Waiting for approval</div></section></>}
      </aside>
      <main className={styles.content} data-preview-scroll>
        <div className={styles.projectHeading}><div><p>{workspace.label}</p><h2>{workspace.title}</h2><small>{plans ? "Lead: Lead Department · 2 tasks" : step.workspace === "budget" || step.workspace === "accounting" ? "Lead Department · Fiscal year 2026" : "Community Services Improvement · Lead Department"}</small></div><DemoBadge tone={step.screen === "resend" ? "amber" : "teal"}>{step.screen === "archived" ? "Archived" : step.screen === "resend" ? "Updates needed" : plans && draft ? "Draft" : step.workspace === "budget" ? "FY 2026" : "Example"}</DemoBadge></div>
        {tabs.length > 0 && <div className={styles.tabs} aria-label="Example workspace tabs">{tabs.map((tab) => <span key={tab} className={tab === step.tab ? styles.activeTab : ""} aria-current={tab === step.tab ? "page" : undefined}>{tab}</span>)}</div>}
        {budgetTabs.length > 0 && <div className={styles.subtabs}>{budgetTabs.map((tab) => <span key={tab} className={step.detail === tab ? styles.activeSubtab : ""}>{tab}</span>)}</div>}
        {plans && step.detail && <div className={styles.panelHeading}>Workspace tools → {step.detail}</div>}
        {drawer && <><div className={styles.panelHeading}>View Details · Prepare outreach materials</div><div className={styles.subtabs}><span className={styles.activeSubtab}>Overview</span><span>Activity</span><span>Discussion</span></div></>}
        <div className={styles.screenContent} key={step.screen}><PreparationScreens {...props} /><ApprovalScreens {...props} /><TaskScreens {...props} /><BudgetScreens {...props} /><CloseoutScreens {...props} /></div>
      </main>
    </div>
  </div>;
}
