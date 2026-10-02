import type { ReactNode } from "react";
import { Check, FileText } from "lucide-react";
import type { PreviewTourStep } from "../walkthroughSteps";
import type { WorkflowKind } from "../types";
import styles from "../WorkflowDemo.module.scss";

export interface DemoScreenProps { step: PreviewTourStep; kind: WorkflowKind; onAction: () => void }
export function DemoAction({ id, step, onAction, children, secondary = false }: Pick<DemoScreenProps, "step" | "onAction"> & { id: string; children: ReactNode; secondary?: boolean }) {
  return <button type="button" data-preview-target={id} disabled={step.target !== id} onClick={onAction}
    className={`${styles.action} ${secondary ? styles.secondary : ""}`}>
    {children}
  </button>;
}
export function DemoCard({ title, children, target }: { title: string; children: ReactNode; target?: string }) {
  return <section className={styles.card} data-preview-target={target}><h3>{title}</h3>{children}</section>;
}
export function DemoField({ label, value }: { label: string; value: string }) {
  return <label className={styles.field}><span>{label}</span><input value={value} readOnly tabIndex={-1} /></label>;
}
export function DemoBadge({ children, tone = "teal" }: { children: ReactNode; tone?: "teal" | "amber" | "gray" }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}
export function DemoFile({ name }: { name: string }) {
  return <div className={styles.file}><FileText size={19} /><div><strong>{name}</strong><span>Example attachment</span></div><Check size={15} /></div>;
}
export function DemoChecks({ labels, target }: { labels: string[]; target?: string }) {
  return <div className={styles.checks} data-preview-target={target}>{labels.map((label) => <div key={label}><Check size={16} /><span>{label}</span><DemoBadge>Ready</DemoBadge></div>)}</div>;
}
export function DemoConfirmation({ title, children, action, id, ...props }: DemoScreenProps & { title: string; children: ReactNode; action: string; id: string }) {
  return <section className={styles.confirmation} aria-label={title}>
    <div className={styles.confirmIcon}><Check size={22} /></div><h3>{title}</h3>{children}
    <div className={styles.confirmActions}><span>Cancel</span><DemoAction {...props} id={id}>{action}</DemoAction></div>
  </section>;
}
