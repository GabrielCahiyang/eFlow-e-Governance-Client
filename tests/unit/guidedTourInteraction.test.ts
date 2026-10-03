// @vitest-environment jsdom

import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GuidedTourProvider, PageWalkthroughButton } from "../../src/app/features/guided-tours";

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  class MockSpeechSynthesisUtterance {
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
  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", { configurable: true, value: MockSpeechSynthesisUtterance });
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: {
      cancel: vi.fn(),
      getVoices: vi.fn(() => []),
      speak: vi.fn((utterance: MockSpeechSynthesisUtterance) => utterance.onstart?.()),
    },
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("guided page walkthrough", () => {
  it("opens from the page toolbar and advances without changing page data", () => {
    render(createElement(GuidedTourProvider, {
      userId: "",
      role: "member",
      activeSection: "tasks",
      activePage: "My Tasks",
      sections: [{ id: "tasks", label: "My Tasks", page: "My Tasks" }],
      onNavigate: vi.fn(),
      children: createElement("div", { "data-tour-id": "application-shell" },
        createElement("button", { "data-tour-section": "tasks" }, "My Tasks"),
        createElement("div", { "data-tour-page-content": true }, createElement("h1", null, "My Tasks")),
        createElement(PageWalkthroughButton),
      ),
    }));

    fireEvent.click(screen.getByRole("button", { name: "Walkthrough" }));
    expect(screen.getByRole("dialog", { name: "Guided walkthrough" })).toBeTruthy();
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
    const card = screen.getByTestId("guided-tour-card");
    expect(card.className).toContain("duration-500");
    expect(screen.getByTestId("guided-tour-step-content").className).toContain("fade-in");

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Step 2 of 4")).toBeTruthy();
    expect(screen.getAllByText("My Tasks").length).toBeGreaterThan(0);
    expect(screen.getByTestId("guided-tour-card")).toBe(card);
  });

  it("advances only once when Enter activates the focused Next button", () => {
    render(createElement(GuidedTourProvider, {
      userId: "",
      role: "member",
      activeSection: "tasks",
      activePage: "My Tasks",
      sections: [{ id: "tasks", label: "My Tasks", page: "My Tasks" }],
      onNavigate: vi.fn(),
      children: createElement("div", { "data-tour-id": "application-shell" },
        createElement("button", { "data-tour-section": "tasks" }, "My Tasks"),
        createElement("div", { "data-tour-page-content": true }, createElement("h1", null, "My Tasks")),
        createElement(PageWalkthroughButton),
      ),
    }));

    fireEvent.click(screen.getByRole("button", { name: "Walkthrough" }));
    const next = screen.getByRole("button", { name: /Next/ });
    fireEvent.keyDown(next, { key: "Enter" });
    fireEvent.click(next);

    expect(screen.getByText("Step 2 of 4")).toBeTruthy();
  });

  it("optionally narrates each step and stops immediately when switched off", () => {
    vi.useFakeTimers();
    render(createElement(GuidedTourProvider, {
      userId: "",
      role: "member",
      activeSection: "tasks",
      activePage: "My Tasks",
      sections: [{ id: "tasks", label: "My Tasks", page: "My Tasks" }],
      onNavigate: vi.fn(),
      children: createElement("div", { "data-tour-id": "application-shell" },
        createElement("button", { "data-tour-section": "tasks" }, "My Tasks"),
        createElement("div", { "data-tour-page-content": true }, createElement("h1", null, "My Tasks")),
        createElement(PageWalkthroughButton),
      ),
    }));

    fireEvent.click(screen.getByRole("button", { name: "Walkthrough" }));
    const voiceSwitch = screen.getByRole("switch", { name: "Turn AI voice on" });
    fireEvent.click(voiceSwitch);
    expect(screen.getByRole("switch", { name: "Turn AI voice off" }).getAttribute("aria-checked")).toBe("true");

    act(() => vi.advanceTimersByTime(350));
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("switch", { name: "Turn AI voice off" }));
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    expect(screen.getByRole("switch", { name: "Turn AI voice on" }).getAttribute("aria-checked")).toBe("false");
  });
});
