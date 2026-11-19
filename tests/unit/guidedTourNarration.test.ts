// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildNarrationPhrases,
  getTourNarrationText,
  selectTourNarrationVoice,
  speakTourStep,
  stopTourNarration,
} from "../../src/app/features/guided-tours";

function voice(name: string, lang: string, isDefault = false, localService = true): SpeechSynthesisVoice {
  return { name, lang, default: isDefault, localService, voiceURI: name };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("guided tour narration", () => {
  it("turns a step into concise spoken guidance", () => {
    expect(getTourNarrationText({
      id: "navigation",
      title: "Your navigation",
      description: "Move between  role-specific   workspaces.",
      target: "#sidebar",
    })).toBe("Your navigation. Move between role-specific workspaces.");
  });

  it("uses conversational narration when provided instead of reading card text verbatim", () => {
    expect(getTourNarrationText({
      id: "deep-analysis",
      title: "Deep Analysis",
      description: "Help → Guide for this page · ₱500",
      narration: "Welcome to Deep Analysis! Open Help → Guide for this page · ₱500.",
      target: "#analytics",
    })).toBe("Welcome to Deep Analysis! Open Help, then Guide for this page, 500 pesos.");
  });

  it("prefers an expressive online natural English voice over generic defaults", () => {
    const selected = selectTourNarrationVoice([
      voice("Default voice", "fr-FR", true),
      voice("Microsoft Zira Desktop", "en-US"),
      voice("Google US English", "en-US", false, false),
      voice("Microsoft Aria Online (Natural)", "en-US", false, false),
      voice("Basic English", "en-US"),
    ]);

    expect(selected?.name).toContain("Aria");
  });

  it("splits multi-sentence narration into smoothly paced expressive phrases", () => {
    const phrases = buildNarrationPhrases(
      "Welcome to Analytics! Want to spot slow stages? Drag any stage box to arrange the map.",
    );

    expect(phrases).toHaveLength(3);
    expect(phrases[0].pitch).toBeGreaterThan(1);
    expect(phrases[1].pitch).toBeGreaterThan(1);
    expect(phrases[0].pauseAfterMs).toBeGreaterThan(0);
    expect(phrases[2].pauseAfterMs).toBe(0);
  });

  it("plays phrases sequentially and cancels pending pauses immediately when stopped", () => {
    vi.useFakeTimers();
    const spoken: Array<{ text: string; onstart: (() => void) | null; onend: (() => void) | null }> = [];
    class MockUtterance {
      text: string;
      voice: SpeechSynthesisVoice | null = null;
      lang = "";
      rate = 1;
      pitch = 1;
      volume = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) { this.text = text; }
    }
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", { configurable: true, value: MockUtterance });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel: vi.fn(),
        getVoices: vi.fn(() => [voice("Microsoft Aria Online (Natural)", "en-US", false, false)]),
        speak: vi.fn((u: MockUtterance) => {
          spoken.push(u);
          u.onstart?.();
        }),
      },
    });

    const onStart = vi.fn();
    const onEnd = vi.fn();
    speakTourStep(
      {
        id: "demo",
        title: "Demo",
        description: "Card text",
        narration: "Welcome aboard! Here is your second smooth thought.",
      },
      { onStart, onEnd },
    );

    expect(spoken).toHaveLength(1);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();

    spoken[0].onend?.();
    vi.advanceTimersByTime(220);
    expect(spoken).toHaveLength(2);
    expect(onStart).toHaveBeenCalledTimes(1);

    spoken[1].onend?.();
    expect(onEnd).toHaveBeenCalledTimes(1);

    // Stopping mid-pause cancels upcoming phrases cleanly.
    spoken.length = 0;
    onEnd.mockClear();
    speakTourStep(
      {
        id: "demo-stop",
        title: "Stop",
        description: "Card text",
        narration: "First sentence! Second sentence should never run.",
      },
      { onEnd },
    );
    spoken[0].onend?.();
    stopTourNarration();
    vi.advanceTimersByTime(300);
    expect(spoken).toHaveLength(1);
    expect(onEnd).not.toHaveBeenCalled();
  });
});
