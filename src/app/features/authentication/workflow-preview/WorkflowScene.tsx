import { Archive, ArrowDown, ArrowRight, Building2, Check, CheckCircle2, CircleDollarSign, ClipboardCheck, FileText, ListChecks, Send, TrendingUp, Users, type LucideIcon } from "lucide-react";
import type { PreviewIcon, WorkflowStep } from "./types";
import styles from "./WorkflowPreview.module.scss";

export const WORKFLOW_ICONS: Record<PreviewIcon, LucideIcon> = {
  proposal: FileText, plan: ListChecks, departments: Building2, team: Users,
  approval: ClipboardCheck, publish: Send, progress: TrendingUp, evidence: FileText,
  funding: CircleDollarSign, complete: CheckCircle2, archive: Archive,
};

export function WorkflowScene({ step, nextTitle }: { step: WorkflowStep; nextTitle?: string }) {
  const Icon = WORKFLOW_ICONS[step.icon];
  return <div className={styles.scene} aria-label="Illustrated workflow step">
    <div className={styles.sceneLabel}><span className={styles.sceneDot} /> Illustrative preview</div>
    <div className={styles.actorCard}>
      <span className={styles.actorIcon}><Users size={18} aria-hidden="true" /></span>
      <div><span className={styles.microLabel}>Handled by</span><strong>{step.actor}</strong></div>
    </div>
    <div className={styles.connector} aria-hidden="true"><ArrowDown size={18} /></div>
    <div className={styles.previewCard}>
      <div className={styles.previewHeader}>
        <span className={styles.previewIcon}><Icon size={21} aria-hidden="true" /></span>
        <strong>{step.preview.title}</strong><span className={styles.status}>{step.preview.status}</span>
      </div>
      <div className={styles.previewRows}>{step.preview.rows.map((row) => <div className={styles.previewRow} key={row.label}>
        <span>{row.label}</span><strong className={row.tone === "ready" ? styles.ready : row.tone === "pending" ? styles.pending : styles.info}>
          {row.tone === "ready" && <Check size={13} aria-hidden="true" />}{row.value}
        </strong>
      </div>)}</div>
    </div>
    <div className={styles.connector} aria-hidden="true"><ArrowDown size={18} /></div>
    <div className={styles.outcomeCard}><CheckCircle2 size={18} aria-hidden="true" /><div><span className={styles.microLabel}>What happens next</span><p>{step.outcome}</p>{nextTitle && <span className={styles.nextLabel}>Next: {nextTitle}<ArrowRight size={13} aria-hidden="true" /></span>}</div></div>
  </div>;
}
