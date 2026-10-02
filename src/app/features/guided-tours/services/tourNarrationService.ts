import type { GuidedTourStep } from "../types";

const NATURAL_VOICE_PATTERN = /natural|neural|online|aria|jenny|samantha|google.*english/i;

export function isTourNarrationSupported(): boolean {
  return typeof window !== "undefined"
    && "speechSynthesis" in window
    && typeof SpeechSynthesisUtterance !== "undefined";
}

export function getTourNarrationText(step: Pick<GuidedTourStep, "title" | "description"> & Partial<GuidedTourStep>): string {
  return `${step.title}. ${step.description}`.replace(/\s+/g, " ").trim();
}

export function selectTourNarrationVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return [...voices]
    .sort((first, second) => voiceScore(second) - voiceScore(first))[0];
}

function voiceScore(voice: SpeechSynthesisVoice): number {
  let score = 0;
  if (/^en(?:-|_)/i.test(voice.lang)) score += 20;
  if (/^en-PH$/i.test(voice.lang)) score += 5;
  if (NATURAL_VOICE_PATTERN.test(voice.name)) score += 12;
  if (voice.default) score += 4;
  if (voice.localService) score += 1;
  return score;
}

export function stopTourNarration(): void {
  if (isTourNarrationSupported()) window.speechSynthesis.cancel();
}

export function speakTourStep(
  step: Pick<GuidedTourStep, "title" | "description"> & Partial<GuidedTourStep>,
  handlers: { onStart?: () => void; onEnd?: () => void } = {},
): SpeechSynthesisUtterance | null {
  if (!isTourNarrationSupported()) return null;

  const utterance = new SpeechSynthesisUtterance(getTourNarrationText(step));
  const voice = selectTourNarrationVoice(window.speechSynthesis.getVoices());
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = "en-US";
  }
  utterance.rate = 0.94;
  utterance.pitch = 1;
  utterance.volume = 1;
  utterance.onstart = () => handlers.onStart?.();
  utterance.onend = () => handlers.onEnd?.();
  utterance.onerror = () => handlers.onEnd?.();

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return utterance;
}

