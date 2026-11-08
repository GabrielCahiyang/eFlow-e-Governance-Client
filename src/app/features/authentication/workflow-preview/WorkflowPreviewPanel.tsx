import { useCallback, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Pause, Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { WORKFLOW_GUIDES } from "./workflowGuides";
import { SCENE_SECONDS, useWorkflowPlayback } from "./useWorkflowPlayback";
import { WorkflowWalkthrough } from "./WorkflowWalkthrough";
import { WORKFLOW_WALKTHROUGHS } from "./walkthroughSteps";
import { useGuidedTourNarration } from "../../guided-tours";
import type { WorkflowKind } from "./types";
import styles from "./WorkflowPreview.module.scss";

function formatTime(seconds: number) {
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}

export function WorkflowPreviewPanel({ kind }: { kind: WorkflowKind }) {
  const guide = WORKFLOW_GUIDES[kind];
  const steps = WORKFLOW_WALKTHROUGHS[kind];
  const [voice, setVoice] = useState(false);
  const [screenReady, setScreenReady] = useState("");
  const screenState = useRef("");
  const markReady = useCallback((scene: string) => { screenState.current = scene; setScreenReady(scene); }, []);
  const narrationState = useRef<{ active: boolean; finished: string | null }>({ active: false, finished: null });
  const readyToAdvance = useCallback((index: number) =>
    screenState.current === steps[index].id && (!narrationState.current.active || narrationState.current.finished === steps[index].id), [steps]);
  const isScreenReady = useCallback((index: number) => screenReady === steps[index].id, [screenReady, steps]);
  const { elapsed, duration, stepIndex, isPlaying, ended, seek, togglePlay } = useWorkflowPlayback(steps.length, readyToAdvance, isScreenReady);
  const step = steps[stepIndex];
  const narration = useGuidedTourNarration(step, voice && isPlaying && screenReady === step.id);
  narrationState.current = { active: voice && narration.supported, finished: narration.finishedStepId };
  const chapters = steps.filter((item, index) => index === 0 || item.chapter !== steps[index - 1].chapter);
  const progress = elapsed / duration * 100;

  return <Dialog.Portal>
    <Dialog.Overlay className={styles.overlay} />
    <Dialog.Content className={styles.dialog}>
      <header className={styles.dialogHeader}>
        <div><p className={styles.eyebrow}>eFlow walkthrough</p><Dialog.Title className={styles.dialogTitle}>{guide.title}</Dialog.Title><Dialog.Description className={styles.dialogDescription}>{guide.summary}</Dialog.Description></div>
        <Dialog.Close className={styles.closeButton} aria-label="Close flow preview"><X size={21} aria-hidden="true" /></Dialog.Close>
      </header>
      <div className={styles.workspace}>
        <WorkflowWalkthrough key={step.id} step={step} onReady={markReady} />
      </div>
      <footer className={styles.player}>
        <label className={styles.timelineLabel}>
          <span className={styles.srOnly}>Walkthrough timeline</span>
          <input type="range" min={0} max={duration} value={elapsed} onChange={event => seek(Number(event.target.value))}
            aria-valuetext={formatTime(elapsed) + " of " + formatTime(duration)}
            style={{ background: `linear-gradient(to right, #0875e1 ${progress}%, #dce7f3 ${progress}%)` }} />
        </label>
        <div className={styles.playerControls}>
          <button type="button" className={styles.playButton} onClick={togglePlay} aria-label={isPlaying ? "Pause flow" : ended ? "Replay flow" : "Play flow"}>
            {isPlaying ? <Pause size={18} /> : ended ? <RotateCcw size={18} /> : <Play size={18} />}
          </button>
          <button type="button" className={styles.restartButton} disabled={!narration.supported} aria-pressed={voice}
            aria-label={voice ? "Turn narration off" : "Turn narration on"}
            title={narration.supported ? "Narration" : "Narration unavailable in this browser"} onClick={() => setVoice(!voice)}>
            {voice ? <Volume2 size={19} /> : <VolumeX size={19} />}
          </button>
          <span className={styles.playTime}>{formatTime(elapsed)} <span>/</span> {formatTime(duration)}</span>
          <label className={styles.chapterSelect}>
            <span className={styles.srOnly}>Jump to chapter</span>
            <select value={step.chapter} onChange={event => seek(steps.findIndex(item => item.chapter === event.target.value) * SCENE_SECONDS)}>
              {chapters.map(item => <option key={item.id}>{item.chapter}</option>)}
            </select>
          </label>
        </div>
      </footer>
    </Dialog.Content>
  </Dialog.Portal>;
}
