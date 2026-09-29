import { useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, ChevronLeft, ChevronRight, Map, Pause, Play, RotateCcw, Undo2, X } from "lucide-react";
import { WORKFLOW_GUIDES, WORKFLOW_STAGE_LABELS } from "./workflowGuides";
import { useWorkflowPlayback } from "./useWorkflowPlayback";
import { WorkflowScene } from "./WorkflowScene";
import type { WorkflowKind } from "./types";
import styles from "./WorkflowPreview.module.scss";

export function WorkflowPreviewPanel({ kind }: { kind: WorkflowKind }) {
  const guide = WORKFLOW_GUIDES[kind];
  const playback = useWorkflowPlayback(guide.steps.length);
  const { stepIndex, isPlaying, seek, togglePlay, previous, next } = playback;
  const step = guide.steps[stepIndex];
  const stepButton = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const percentage = Math.round((stepIndex / Math.max(1, guide.steps.length - 1)) * 100);
  const finalStep = stepIndex === guide.steps.length - 1;

  useEffect(() => {
    // Keep manual jumps and playback visible without scrolling the page behind the dialog.
    const button = stepButton.current;
    const rail = button?.closest<HTMLElement>("[data-workflow-map]");
    if (button && rail) {
      if (rail.scrollHeight > rail.clientHeight) rail.scrollTop = Math.max(0, button.offsetTop - rail.offsetTop - rail.clientHeight / 2);
      if (rail.scrollWidth > rail.clientWidth) rail.scrollLeft = Math.max(0, button.offsetLeft - rail.offsetLeft - rail.clientWidth / 2);
    }
    if (content.current) content.current.scrollTop = 0;
  }, [stepIndex]);

  return <Dialog.Portal>
    <Dialog.Overlay className={styles.overlay} />
    <Dialog.Content className={styles.dialog}>
      <header className={styles.dialogHeader}>
        <div><p className={styles.eyebrow}>eFlow · From proposal to archive</p><Dialog.Title className={styles.dialogTitle}>{guide.title}</Dialog.Title><Dialog.Description className={styles.dialogDescription}>{guide.summary} {guide.scope}</Dialog.Description></div>
        <Dialog.Close className={styles.closeButton} aria-label="Close flow preview"><X size={21} aria-hidden="true" /></Dialog.Close>
      </header>
      <div className={styles.workspace}>
        <nav className={styles.flowMap} aria-label="Complete workflow" data-workflow-map>
          <div className={styles.mapHeading}><Map size={16} aria-hidden="true" /> The whole journey <span>{guide.steps.length} steps</span></div>
          <ol className={styles.stepList}>{guide.steps.map((item, index) => <li key={item.id}>
            {(index === 0 || item.stage !== guide.steps[index - 1].stage) && <span className={styles.stageLabel}>{WORKFLOW_STAGE_LABELS[item.stage]}</span>}
            <button type="button" ref={index === stepIndex ? stepButton : undefined} onClick={() => seek(index)} className={`${styles.stepButton} ${index === stepIndex ? styles.currentStep : ""} ${index < stepIndex ? styles.pastStep : ""}`} aria-current={index === stepIndex ? "step" : undefined} aria-label={`Step ${index + 1}: ${item.title}`}>
              <span className={styles.stepNumber}>{index < stepIndex ? <Check size={13} aria-hidden="true" /> : index + 1}</span><span>{item.title}</span>
            </button>
          </li>)}</ol>
        </nav>
        <div className={styles.stepContent} ref={content}>
          <div className={styles.stepHeading} aria-live="polite" aria-atomic="true">
            <div className={styles.stepMeta}><span>STEP {String(stepIndex + 1).padStart(2, "0")} / {guide.steps.length}</span><span>{WORKFLOW_STAGE_LABELS[step.stage]}</span>{step.condition && <span className={styles.conditional}>{step.condition}</span>}</div>
            <h3>{step.title}</h3><p>{step.description}</p>
          </div>
          <div className={styles.detailGrid}>
            <WorkflowScene key={step.id} step={step} nextTitle={guide.steps[stepIndex + 1]?.title} />
            <div className={styles.instructions}>
              <p className={styles.instructionHeading}>What to do</p><ol>{step.actions.map((action, index) => <li key={action}><span>{index + 1}</span><p>{action}</p></li>)}</ol>
              <div className={styles.location}><span className={styles.microLabel}>Where in eFlow</span><p>{step.location}</p></div>
              {step.returnPath && <div className={styles.returnPath}><Undo2 size={17} aria-hidden="true" /><div><strong>If updates are needed</strong><p>{step.returnPath}</p></div></div>}
            </div>
          </div>
        </div>
      </div>
      <footer className={styles.player}>
        <div className={styles.progressCaption}><span>{finalStep ? "Journey complete" : isPlaying ? "Playing · a new step every 9 seconds" : "Explore at your own pace"}</span><strong>{percentage}% · Step {stepIndex + 1} of {guide.steps.length}</strong></div>
        <label className={styles.timelineLabel}><span className={styles.srOnly}>Jump to workflow step</span><input type="range" min={1} max={guide.steps.length} value={stepIndex + 1} onChange={(event) => seek(Number(event.target.value) - 1)} aria-valuetext={`Step ${stepIndex + 1} of ${guide.steps.length}: ${step.title}`} style={{ background: `linear-gradient(to right, #0875e1 ${percentage}%, #dce7f3 ${percentage}%)` }} /></label>
        <div className={styles.playerControls}>
          <button type="button" onClick={previous} disabled={stepIndex === 0} className={styles.navigationButton} aria-label="Previous step"><ChevronLeft size={18} aria-hidden="true" /><span>Previous</span></button>
          <div className={styles.centerControls}><button type="button" className={styles.restartButton} onClick={() => seek(0)} aria-label="Restart flow"><RotateCcw size={17} aria-hidden="true" /></button><button type="button" onClick={togglePlay} className={styles.playButton} aria-label={isPlaying ? "Pause flow" : finalStep ? "Replay flow" : "Play flow"}>{isPlaying ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}<span>{isPlaying ? "Pause" : finalStep ? "Replay" : "Play guide"}</span></button></div>
          <button type="button" onClick={next} disabled={finalStep} className={styles.navigationButton} aria-label="Next step"><span>Next</span><ChevronRight size={18} aria-hidden="true" /></button>
        </div>
      </footer>
    </Dialog.Content>
  </Dialog.Portal>;
}
