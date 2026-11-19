import type { GuidedTourStep } from "../types";

export interface NarrationPhrase {
  text: string;
  rate: number;
  pitch: number;
  pauseAfterMs: number;
}

const EXPRESSIVE_NEURAL_VOICE_PATTERN =
  /\b(aria|ava|emma|jenny|sonia|andrew|brian|guy|libby|steffan|ryan|sara|michelle|christopher)\b.*\b(natural|online|neural)\b|\b(natural|online|neural)\b.*\b(aria|ava|emma|jenny|sonia|andrew|brian|guy|libby|steffan|ryan)\b/i;
const NATURAL_VOICE_PATTERN = /natural|neural|online|wavenet|studio/i;
const POLISHED_ENGLISH_VOICE_PATTERN = /google.*(us|uk)?\s*english|samantha|karen|moira|tessa|daniel|serena|aria|jenny|ava|emma/i;
const WARM_LOCAL_VOICE_PATTERN = /\b(zira|hazel|susan|catherine|samantha)\b/i;
const ENGLISH_LANG_PATTERN = /^en\b/i;

let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesListenerBound = false;
let activePlaybackToken = 0;
let pendingPauseTimer: number | null = null;

function ensureVoicesPrewarmed(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  const current = synth.getVoices?.() || [];
  if (current.length) cachedVoices = current;
  if (voicesListenerBound) return;
  voicesListenerBound = true;
  const syncVoices = () => {
    const next = synth.getVoices?.() || [];
    if (next.length) cachedVoices = next;
  };
  if (typeof synth.addEventListener === "function") {
    synth.addEventListener("voiceschanged", syncVoices);
  }
}

export function isTourNarrationSupported(): boolean {
  return (
    typeof window !== "undefined"
    && "speechSynthesis" in window
    && typeof SpeechSynthesisUtterance !== "undefined"
  );
}

/** Clean UI glyphs so browser voices never pronounce arrows, bullets, or symbols literally. */
export function cleanNarrationText(raw: string): string {
  return raw
    .replace(/\s*→\s*/g, ", then ")
    .replace(/\s*·\s*/g, ", ")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s*&\s*/g, " and ")
    .replace(/₱\s*([\d,]+(?:\.\d+)?)/g, "$1 pesos")
    .replace(/\s+/g, " ")
    .trim();
}

export function getTourNarrationText(
  step: Pick<GuidedTourStep, "title" | "description"> & Partial<GuidedTourStep>,
): string {
  if (step.narration?.trim()) {
    return cleanNarrationText(step.narration);
  }
  return `${step.title}. ${step.description}`.replace(/\s+/g, " ").trim();
}

function scoreVoice(voice: SpeechSynthesisVoice): number {
  const isEnglish = ENGLISH_LANG_PATTERN.test(voice.lang || "");
  if (!isEnglish) return voice.default ? 2 : 1;

  let score = 20;
  if (/^en[-_]US$/i.test(voice.lang)) score += 10;
  else if (/^en[-_](GB|AU|CA|PH)$/i.test(voice.lang)) score += 6;

  if (EXPRESSIVE_NEURAL_VOICE_PATTERN.test(voice.name)) score += 100;
  else if (NATURAL_VOICE_PATTERN.test(voice.name)) score += 70;
  else if (POLISHED_ENGLISH_VOICE_PATTERN.test(voice.name)) score += 50;
  else if (WARM_LOCAL_VOICE_PATTERN.test(voice.name)) score += 20;

  if (!voice.localService) score += 8;
  if (voice.default) score += 3;
  return score;
}

export function selectTourNarrationVoice(
  voices: readonly SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  let best = voices[0];
  let bestScore = scoreVoice(best);
  for (let i = 1; i < voices.length; i += 1) {
    const candidate = voices[i];
    const score = scoreVoice(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best || null;
}

function splitLongSentence(sentence: string): string[] {
  if (sentence.length <= 150) return [sentence];
  const midpoint = Math.floor(sentence.length / 2);
  const commaIndices: number[] = [];
  for (let i = 0; i < sentence.length; i += 1) {
    if (sentence[i] === "," || sentence[i] === ";") commaIndices.push(i);
  }
  if (!commaIndices.length) return [sentence];
  const bestSplit = commaIndices.reduce((best, current) =>
    Math.abs(current - midpoint) < Math.abs(best - midpoint) ? current : best,
  );
  const first = sentence.slice(0, bestSplit + 1).trim();
  const second = sentence.slice(bestSplit + 1).trim();
  if (!first || !second || first.length < 24 || second.length < 24) return [sentence];
  return [first, second];
}

/**
 * Splits spoken guidance into smooth, human-paced phrases with subtle emotional
 * inflection (warmth on welcomes, lift on questions, calm steady pacing on tips).
 */
export function buildNarrationPhrases(rawText: string): NarrationPhrase[] {
  const cleaned = cleanNarrationText(rawText);
  if (!cleaned) return [];

  const rawSentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks = rawSentences.flatMap(splitLongSentence);
  return chunks.map((text, index) => {
    const isFirst = index === 0;
    const isLast = index === chunks.length - 1;
    const isExclamation = text.endsWith("!");
    const isQuestion = text.endsWith("?");
    const endsWithClause = text.endsWith(",") || text.endsWith(";");

    let pitch = 1.0;
    let rate = 0.98;

    if (isExclamation) {
      pitch = 1.05;
      rate = 0.99;
    } else if (isQuestion) {
      pitch = 1.06;
      rate = 0.96;
    } else if (isFirst && chunks.length > 1) {
      pitch = 1.03;
      rate = 0.98;
    } else if (isLast && chunks.length > 1) {
      pitch = 1.01;
      rate = 0.95;
    } else {
      // Subtle micro-variation prevents flat robotic droning across consecutive sentences.
      pitch = index % 2 === 0 ? 1.01 : 0.985;
      rate = index % 2 === 0 ? 0.98 : 0.965;
    }

    const pauseAfterMs = isLast ? 0 : endsWithClause ? 90 : isQuestion || isExclamation ? 190 : 145;
    return { text, rate, pitch, pauseAfterMs };
  });
}

export function stopTourNarration(): void {
  activePlaybackToken += 1;
  if (pendingPauseTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(pendingPauseTimer);
    pendingPauseTimer = null;
  }
  if (isTourNarrationSupported()) {
    window.speechSynthesis.cancel();
  }
}

export function speakTourStep(
  step: Pick<GuidedTourStep, "title" | "description"> & Partial<GuidedTourStep>,
  handlers: { onStart?: () => void; onEnd?: () => void } = {},
): SpeechSynthesisUtterance | null {
  if (!isTourNarrationSupported()) return null;

  ensureVoicesPrewarmed();
  stopTourNarration();

  const phrases = buildNarrationPhrases(getTourNarrationText(step));
  if (!phrases.length) {
    handlers.onEnd?.();
    return null;
  }

  const playbackToken = activePlaybackToken;
  const availableVoices = window.speechSynthesis.getVoices?.() || [];
  const voice = selectTourNarrationVoice(availableVoices.length ? availableVoices : cachedVoices);
  let started = false;
  let firstUtterance: SpeechSynthesisUtterance | null = null;

  const speakPhraseAt = (phraseIndex: number): SpeechSynthesisUtterance | null => {
    if (playbackToken !== activePlaybackToken) return null;
    const phrase = phrases[phraseIndex];
    if (!phrase) {
      handlers.onEnd?.();
      return null;
    }

    const utterance = new SpeechSynthesisUtterance(phrase.text);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = "en-US";
    }
    utterance.rate = phrase.rate;
    utterance.pitch = phrase.pitch;
    utterance.volume = 1;

    utterance.onstart = () => {
      if (playbackToken !== activePlaybackToken) return;
      if (!started) {
        started = true;
        handlers.onStart?.();
      }
    };

    utterance.onend = () => {
      if (playbackToken !== activePlaybackToken) return;
      if (phraseIndex >= phrases.length - 1) {
        handlers.onEnd?.();
        return;
      }
      if (phrase.pauseAfterMs > 0) {
        pendingPauseTimer = window.setTimeout(() => {
          pendingPauseTimer = null;
          speakPhraseAt(phraseIndex + 1);
        }, phrase.pauseAfterMs);
      } else {
        speakPhraseAt(phraseIndex + 1);
      }
    };

    utterance.onerror = () => {
      if (playbackToken !== activePlaybackToken) return;
      handlers.onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
    return utterance;
  };

  firstUtterance = speakPhraseAt(0);
  return firstUtterance;
}
