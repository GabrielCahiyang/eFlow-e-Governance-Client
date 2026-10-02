import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, ChevronLeft, ChevronRight, Map, Pause, Play, RotateCcw, X } from "lucide-react";
import { WORKFLOW_GUIDES, WORKFLOW_STAGE_LABELS } from "./workflowGuides";
import { useWorkflowPlayback } from "./useWorkflowPlayback";
import { WorkflowWalkthrough } from "./WorkflowWalkthrough";
import { WORKFLOW_WALKTHROUGHS } from "./walkthroughSteps";
import { useGuidedTourNarration } from "../../guided-tours";
import type { WorkflowKind } from "./types";
import styles from "./WorkflowPreview.module.scss";

export function WorkflowPreviewPanel({ kind }: { kind: WorkflowKind }) {
  const guide = WORKFLOW_GUIDES[kind];
  const steps = WORKFLOW_WALKTHROUGHS[kind];
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const narrationState = useRef({ enabled: false, supported: false, finishedStepId: null as string | null });
  const readyToAdvance = useCallback((index: number) => !narrationState.current.enabled || !narrationState.current.supported || narrationState.current.finishedStepId === steps[index].id, [steps]);
  const playback = useWorkflowPlayback(steps.length, readyToAdvance);
  const { stepIndex, isPlaying, seek, togglePlay, previous, next } = playback;
  const step = steps[stepIndex];
  const narration = useGuidedTourNarration(step, voiceEnabled);
  narrationState.current = { enabled: voiceEnabled, supported: narration.supported, finishedStepId: narration.finishedStepId };
  const stepButton = useRef<HTMLButtonElement>(null);
  const percentage = Math.round((stepIndex / Math.max(1, steps.length - 1)) * 100);
  const finalStep = stepIndex === steps.length - 1;

  useEffect(() => {
    // Keep manual jumps and playback visible without scrolling the page behind the dialog.
    const revealSelectedStep = () => {
      const button = stepButton.current;
      const rail = button?.closest<HTMLElement>("[data-workflow-map]");
      if (!button || !rail) return;
      const item = button.getBoundingClientRect();
      const area = rail.getBoundingClientRect();
      if (rail.scrollHeight > rail.clientHeight) rail.scrollTop += item.top - area.top - (rail.clientHeight - item.height) / 2;
      if (rail.scrollWidth > rail.clientWidth) rail.scrollLeft += item.left - area.left - (rail.clientWidth - item.width) / 2;
    };
    revealSelectedStep();
    window.addEventListener("resize", revealSelectedStep);
    return () => window.removeEventListener("resize", revealSelectedStep);
  }, [stepIndex]);

  return <Dialog.Portal>
    <Dialog.Overlay className={styles.overlay} />
    <Dialog.Content className={styles.dialog} onKeyDown={(event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "ArrowRight") { event.preventDefault(); next(); }
      if (event.key === "ArrowLeft") { event.preventDefault(); previous(); }
    }}>
      <header className={styles.dialogHeader}>
        <div><p className={styles.eyebrow}>eFlow · From proposal to archive</p><Dialog.Title className={styles.dialogTitle}>{guide.title}</Dialog.Title><Dialog.Description className={styles.dialogDescription}>{guide.summary} Watch the screens change or click the highlighted controls.</Dialog.Description></div>
        <Dialog.Close className={styles.closeButton} aria-label="Close flow preview"><X size={21} aria-hidden="true" /></Dialog.Close>
      </header>
      <div className={styles.workspace}>
        <nav className={styles.flowMap} aria-label="Complete workflow" data-workflow-map>
          <div className={styles.mapHeading}><Map size={16} aria-hidden="true" /> The whole journey <span>{steps.length} steps</span></div>
          <ol className={styles.stepList}>{steps.map((item, index) => <li key={item.id}>
            {(index === 0 || item.stage !== steps[index - 1].stage) && <span className={styles.stageLabel}>{WORKFLOW_STAGE_LABELS[item.stage]}</span>}
            <button type="button" ref={index === stepIndex ? stepButton : undefined} onClick={() => seek(index)} className={`${styles.stepButton} ${index === stepIndex ? styles.currentStep : ""} ${index < stepIndex ? styles.pastStep : ""}`} aria-current={index === stepIndex ? "step" : undefined} aria-label={`Step ${index + 1}: ${item.title}`}>
              <span className={styles.stepNumber}>{index < stepIndex ? <Check size={13} aria-hidden="true" /> : index + 1}</span><span>{item.title}</span>
            </button>
          </li>)}</ol>
        </nav>
        <div className={styles.stepContent}>
          <WorkflowWalkthrough step={step} index={stepIndex} total={steps.length} kind={kind} onNext={next} voice={{ enabled: voiceEnabled, supported: narration.supported, speaking: narration.isSpeaking, toggle: () => setVoiceEnabled((enabled) => !enabled) }} />
          <span className={styles.srOnly} aria-live="polite" aria-atomic="true">Step {stepIndex + 1} of {steps.length}: {step.title}</span>
        </div>
      </div>
      <footer className={styles.player}>
        <div className={styles.progressCaption}><span>{finalStep ? "Journey complete" : isPlaying ? voiceEnabled && narration.supported ? "Playing · waits for AI voice to finish" : "Playing · a new step every 9 seconds" : "Explore at your own pace · ← Back / → Next"}</span><strong>{percentage}% · Step {stepIndex + 1} of {steps.length}</strong></div>
        <label className={styles.timelineLabel}><span className={styles.srOnly}>Jump to workflow step</span><input type="range" min={1} max={steps.length} value={stepIndex + 1} onChange={(event) => seek(Number(event.target.value) - 1)} aria-valuetext={`Step ${stepIndex + 1} of ${steps.length}: ${step.title}`} style={{ background: `linear-gradient(to right, #0875e1 ${percentage}%, #dce7f3 ${percentage}%)` }} /></label>
        <div className={styles.playerControls}>
          <button type="button" onClick={previous} disabled={stepIndex === 0} className={styles.navigationButton} aria-label="Previous step"><ChevronLeft size={18} aria-hidden="true" /><span>Previous</span></button>
          <div className={styles.centerControls}><button type="button" className={styles.restartButton} onClick={() => seek(0)} aria-label="Restart flow"><RotateCcw size={17} aria-hidden="true" /></button><button type="button" onClick={togglePlay} className={styles.playButton} aria-label={isPlaying ? "Pause flow" : finalStep ? "Replay flow" : "Play flow"}>{isPlaying ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}<span>{isPlaying ? "Pause" : finalStep ? "Replay" : "Play guide"}</span></button></div>
          <button type="button" onClick={next} disabled={finalStep} className={styles.navigationButton} aria-label="Next step"><span>Next</span><ChevronRight size={18} aria-hidden="true" /></button>
        </div>
      </footer>
    </Dialog.Content>
  </Dialog.Portal>;
}
