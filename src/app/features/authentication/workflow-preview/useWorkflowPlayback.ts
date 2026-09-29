import { useEffect, useState } from "react";

export const WORKFLOW_STEP_DURATION = 9000;

export function useWorkflowPlayback(stepCount: number) {
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setPlaying] = useState(false);
  const lastIndex = Math.max(0, stepCount - 1);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setTimeout(() => {
      if (stepIndex >= lastIndex - 1) setPlaying(false);
      setStepIndex((current) => Math.min(lastIndex, current + 1));
    }, WORKFLOW_STEP_DURATION);
    return () => window.clearTimeout(timer);
  }, [isPlaying, lastIndex, stepIndex]);

  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);

  const seek = (index: number) => {
    setPlaying(false);
    setStepIndex(Math.max(0, Math.min(lastIndex, index)));
  };
  const togglePlay = () => {
    if (isPlaying) { setPlaying(false); return; }
    if (stepIndex === lastIndex) setStepIndex(0);
    setPlaying(true);
  };

  return { stepIndex, isPlaying, seek, togglePlay, previous: () => seek(stepIndex - 1), next: () => seek(stepIndex + 1) };
}
