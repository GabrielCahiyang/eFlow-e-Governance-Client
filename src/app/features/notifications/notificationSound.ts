import type { NotificationSoundVolume } from "../settings/personalSettingsStore";

export type NotificationChimeTone = "normal" | "urgent";

const COOLDOWN_MS = 1500;
let sharedAudioContext: AudioContext | null = null;
let lastPlayedAt = 0;
let unlockRegistered = false;

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const win = window as Window & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return win.AudioContext || win.webkitAudioContext || null;
}

function getOrCreateAudioContext(): AudioContext | null {
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return null;
  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    try {
      sharedAudioContext = new Ctor();
    } catch {
      return null;
    }
  }
  return sharedAudioContext;
}

/**
 * Registers one-time passive listeners so the Web Audio context unlocks cleanly
 * on the first user gesture, satisfying browser autoplay policies.
 */
export function ensureNotificationAudioUnlocked(): void {
  if (typeof window === "undefined" || unlockRegistered) return;
  unlockRegistered = true;

  const unlock = () => {
    const ctx = getOrCreateAudioContext();
    if (ctx && ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };

  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
}

function scheduleBellStrike(
  ctx: AudioContext,
  startAt: number,
  fundamentalHz: number,
  peakGain: number,
  decaySec: number,
): void {
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, startAt);
  master.gain.exponentialRampToValueAtTime(Math.max(0.0002, peakGain), startAt + 0.012);
  master.gain.exponentialRampToValueAtTime(0.0001, startAt + decaySec);
  master.connect(ctx.destination);

  // Warm bell partials: fundamental + soft fifth-above-octave overtone + subtle shimmer
  const partials: Array<[number, number]> = [
    [fundamentalHz, 1.0],
    [fundamentalHz * 2.0, 0.32],
    [fundamentalHz * 2.997, 0.12],
  ];

  for (const [freq, weight] of partials) {
    const osc = ctx.createOscillator();
    const partialGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, startAt);
    partialGain.gain.setValueAtTime(weight, startAt);
    osc.connect(partialGain);
    partialGain.connect(master);
    osc.start(startAt);
    osc.stop(startAt + decaySec + 0.03);
  }
}

/**
 * Plays a pleasant, synthesized Web Audio bell chime.
 * Coalesces rapid bursts via a 1.5s cooldown unless `force` is true (e.g. "Test sound").
 */
export function playNotificationChime(
  tone: NotificationChimeTone = "normal",
  options: {
    enabled?: boolean;
    volume?: NotificationSoundVolume;
    force?: boolean;
  } = {},
): boolean {
  const { enabled = true, volume = "normal", force = false } = options;
  if (!enabled && !force) return false;

  const nowMs = Date.now();
  if (!force && nowMs - lastPlayedAt < COOLDOWN_MS) {
    return false;
  }

  const ctx = getOrCreateAudioContext();
  if (!ctx) return false;

  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }

  try {
    const peak = volume === "soft" ? 0.08 : 0.16;
    const baseTime = ctx.currentTime + 0.005;
    if (tone === "urgent") {
      // Crisp two-note bell chime (A5 -> C#6)
      scheduleBellStrike(ctx, baseTime, 880, peak, 0.34);
      scheduleBellStrike(ctx, baseTime + 0.145, 1108.73, peak * 1.05, 0.44);
    } else {
      // Single warm resonant bell chime (A5)
      scheduleBellStrike(ctx, baseTime, 880, peak, 0.42);
    }
    lastPlayedAt = nowMs;
    return true;
  } catch {
    return false;
  }
}

/** Test-only helper to reset burst cooldown and cached AudioContext between unit tests. */
export function resetNotificationChimeCooldownForTest(): void {
  lastPlayedAt = 0;
  sharedAudioContext = null;
}
