import { useEffect, useState } from "react";

export const SCENE_SECONDS = 12;
const MAX_NARRATION_WAIT = 8;

export function useWorkflowPlayback(sceneCount: number, readyToAdvance: (index: number) => boolean, screenReady?: (index: number) => boolean) {
  const duration = sceneCount * SCENE_SECONDS;
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const stepIndex = Math.min(sceneCount - 1, Math.floor(elapsed / SCENE_SECONDS));
  const ended = elapsed === duration;
  const isPlaying = playing && !ended;

  useEffect(() => {
    if (!isPlaying || screenReady && !screenReady(stepIndex)) return;
    let timer: number;
    let waited = 0;
    const advance = () => {
      const sceneEnds = (elapsed + 1) % SCENE_SECONDS === 0;
      if (sceneEnds && !readyToAdvance(stepIndex) && waited++ < MAX_NARRATION_WAIT) {
        timer = window.setTimeout(advance, 1000);
        return;
      }
      setElapsed(elapsed + 1);
    };
    timer = window.setTimeout(advance, 1000);
    return () => window.clearTimeout(timer);
  }, [elapsed, isPlaying, readyToAdvance, screenReady, stepIndex]);

  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);

  function seek(seconds: number) {
    if (ended) setPlaying(false);
    setElapsed(Math.max(0, Math.min(duration, seconds)));
  }
  function togglePlay() {
    if (ended) {
      setElapsed(0);
      setPlaying(true);
      return;
    }
    setPlaying(!playing);
  }

  return { elapsed, duration, stepIndex, isPlaying, ended, seek, togglePlay };
}
