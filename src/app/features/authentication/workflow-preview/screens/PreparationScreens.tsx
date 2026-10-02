import { ArrowRight, Building2, Check, FileUp, Loader2, Plus, Save, Sparkles, Users } from "lucide-react";
import { DemoAction, DemoBadge, DemoCard, DemoField, DemoFile, type DemoScreenProps } from "./PreviewControls";
import styles from "../WorkflowDemo.module.scss";

export function PreparationScreens(props: DemoScreenProps) {
  const { step, kind } = props;
  switch (step.screen) {
    case "start": return <>
      <div className={styles.stats}><DemoCard title="Active projects"><strong className={styles.stat}>0</strong></DemoCard><DemoCard title="Proposal drafts"><strong className={styles.stat}>0</strong></DemoCard><DemoCard title="Department"><strong>Lead Department</strong></DemoCard></div>
      <DemoCard title="Start your next work plan"><div className={styles.emptyState}><div className={styles.emptyIcon}><FileUp size={33} /></div><h4>Your proposal starts here</h4><p>Create a draft from a proposal PDF or build your plan manually.</p><DemoAction {...props} id="start"><Plus size={16} /> Create work plan</DemoAction></div></DemoCard>
    </>;
    case "upload": return <section className={styles.formPanel}><p className={styles.kicker}>Planning workspace</p><h3>Create a work plan</h3><p>Build from scratch or import a proposal document.</p><div className={styles.modeTabs}><span>New work plan</span><span className={styles.selected}>Import proposal</span></div>
      <DemoField label="Proposal title" value="Community Services Improvement" />
      <div className={styles.upload}><FileUp size={35} /><strong>Upload your proposal PDF</strong><span>The AI prepares an editable work plan for review.</span><DemoAction {...props} id="upload">Choose proposal PDF <ArrowRight size={15} /></DemoAction></div>
      <p className={styles.smallNote}>Prefer manual entry? New work plan opens the plan builder.</p>
    </section>;
    case "extract": return <section className={styles.formPanel}><p className={styles.kicker}>Import proposal</p><h3>Preparing your work plan</h3><DemoFile name="Community-Services-Proposal.pdf" />
      <div className={styles.processing} data-preview-target="extract"><div className={styles.processingHeading}><Sparkles size={23} /><div><strong>Preparing projects and tasks…</strong><span>The document is being converted into a draft.</span></div><Loader2 className={styles.spinner} size={20} /></div>
        <ol>{["Read the proposal document", "Extract project details and dates", "Break the work into tasks", "Prepare department and staffing suggestions"].map((label, index) => <li key={label} className={index === 2 ? styles.processingActive : ""}><span>{index < 2 ? <Check size={14} /> : index === 2 ? <Loader2 className={styles.spinner} size={14} /> : index + 1}</span>{label}<small>{index < 2 ? "Done" : index === 2 ? "Working" : "Next"}</small></li>)}</ol>
      </div><p className={styles.smallNote}>Keep this panel open until processing finishes. You can review and correct the result next.</p>
    </section>;
    case "plan": return <>
      <DemoCard title="Work plan structure"><div className={styles.hierarchy}><span>Community Services Program</span><ArrowRight size={14} /><strong>Community Services Improvement</strong><ArrowRight size={14} /><span>Resident outreach</span></div></DemoCard>
      <DemoCard title="Proposed tasks"><div className={styles.table}><div className={styles.tableHeader}><span>Task</span><span>Department</span><span>Working days</span><span>Deadline</span></div><div><strong>Prepare outreach materials</strong><span>Lead Department</span><span>3 days</span><span>Oct 12</span></div><div><strong>Conduct community visits</strong><span>{kind === "interdepartmental" ? "Office A" : "Lead Department"}</span><span>5 days</span><span>Oct 19</span></div></div><div className={styles.cardFooter}><span>Review AI suggestions before saving.</span><DemoAction {...props} id="plan"><Save size={15} /> Save work plan</DemoAction></div></DemoCard>
    </>;
    case "departments": return <>
      <DemoCard title="Participating departments"><div className={styles.officeRow}><Building2 size={19} /><div><strong>Lead Department</strong><small>Owns and publishes the plan</small></div><DemoBadge>Owner</DemoBadge></div>
        {["Office A", "Office B"].map((office) => <div className={styles.officeRow} key={office}><Building2 size={19} /><div><strong>{office}</strong><small>Staffing enabled</small></div><DemoBadge tone="gray">Required participant</DemoBadge></div>)}
        <div className={styles.officeRow}><Building2 size={19} /><div><strong>Review Board</strong><small>Reviews the final proposal record · No staffing</small></div><DemoBadge tone="gray">Governance reviewer</DemoBadge></div><div className={styles.cardFooter}><span>Observers can follow without blocking approval.</span><DemoAction {...props} id="departments"><Save size={15} /> Save department changes</DemoAction></div>
      </DemoCard>
      <DemoCard title="Approval status"><p>Required participants review the proposed scope before the plan can be published.</p><DemoBadge tone="amber">2 department approvals pending</DemoBadge></DemoCard>
    </>;
    case "staffing": return <>
      <DemoCard title="Proposed team · Prepare outreach materials"><div className={styles.officeRow}><Users size={19} /><div><strong>Task Leader</strong><small>Lead Department · Skills matched</small></div><DemoBadge>Light workload</DemoBadge></div><div className={styles.officeRow}><Users size={19} /><div><strong>Team Member</strong><small>Lead Department · Supporting member</small></div><DemoBadge tone="amber">Moderate workload</DemoBadge></div><div className={styles.cardFooter}><span>3 working days · 8 hours per day</span><DemoAction {...props} id="staffing"><Save size={15} /> Save team changes</DemoAction></div></DemoCard>
      <p className={styles.smallNote}>Workload uses task duration, working days, and deadline urgency. Check the separate Budget panel next.</p>
    </>;
    default: return null;
  }
}


