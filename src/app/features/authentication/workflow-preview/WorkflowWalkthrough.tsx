import { ArrowRight, Monitor, MousePointer2 } from "lucide-react";
import { useRef } from "react";
import { GuidedTourCard } from "../../guided-tours";
import { WorkflowDemo } from "./WorkflowDemo";
import { getPreviewWorkspace } from "./previewWorkspace";
import { usePreviewSpotlight } from "./usePreviewSpotlight";
import type { WorkflowKind } from "./types";
import type { PreviewTourStep } from "./walkthroughSteps";
import styles from "./WorkflowWalkthrough.module.scss";

export function WorkflowWalkthrough({ step, index, total, kind, onNext, voice }: { step: PreviewTourStep; index: number; total: number; kind: WorkflowKind; onNext: () => void; voice: { enabled: boolean; supported: boolean; speaking: boolean; toggle: () => void } }) {
  const frame = useRef<HTMLDivElement>(null);
  const layout = usePreviewSpotlight(frame, step.target);
  const final = index === total - 1;
  return <div className={styles.stage} ref={frame}>
    <div className={styles.demoBar}><span><Monitor size={13} /> {getPreviewWorkspace(step).path}</span><small>{step.condition ?? "Example screen · Click the highlight or Next"}</small></div>
    <div className={styles.viewport} data-preview-viewport>
      <WorkflowDemo step={step} kind={kind} onAction={onNext} />
      {layout ? <><div className={styles.spotlight} style={layout.target} data-testid="preview-spotlight" aria-hidden="true" /><div className={styles.pointer} style={{ left: layout.target.left + layout.target.width - 8, top: layout.target.top + layout.target.height - 8 }} aria-hidden="true"><MousePointer2 size={22} fill="white" /></div></> : <div className={styles.dim} aria-hidden="true" />}
    </div>
    <GuidedTourCard step={step} index={index} total={total} voice={voice} className={styles.tourCard} style={layout?.card} arrow={layout?.arrow}
      footer={<div className={styles.tourFooter}><div><span>Viewing as</span><strong>{step.actor}</strong></div>{!final && <button type="button" onClick={onNext} aria-label="Continue walkthrough">Next <ArrowRight size={14} /></button>}{final && <span className={styles.finished}>Flow complete ✓</span>}</div>}
    />
  </div>;
}
