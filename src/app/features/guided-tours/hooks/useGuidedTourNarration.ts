import { useEffect, useState } from "react";
import { isTourNarrationSupported, speakTourStep, stopTourNarration } from "../services/tourNarrationService";
import type { GuidedTourStep } from "../types";

export function useGuidedTourNarration(step: Pick<GuidedTourStep, "id" | "title" | "description">, enabled: boolean) {
  const supported = isTourNarrationSupported();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [finishedStepId, setFinishedStepId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsSpeaking(false);
    setFinishedStepId(null);
    if (!enabled || !supported) {
      stopTourNarration();
      return;
    }

    const timer = window.setTimeout(() => {
      speakTourStep(step, {
        onStart: () => { if (active) setIsSpeaking(true); },
        onEnd: () => { if (active) { setIsSpeaking(false); setFinishedStepId(step.id); } },
      });
    }, 320);

    return () => {
      active = false;
      window.clearTimeout(timer);
      stopTourNarration();
    };
  }, [enabled, step, supported]);

  return { supported, isSpeaking, finishedStepId };
}
