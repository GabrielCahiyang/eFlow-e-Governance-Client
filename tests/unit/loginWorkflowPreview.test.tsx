// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { WorkflowPreview } from "../../src/app/features/authentication";
import { WORKFLOW_WALKTHROUGHS } from "../../src/app/features/authentication/workflow-preview/walkthroughSteps";
import { SCENE_SECONDS, useWorkflowPlayback } from "../../src/app/features/authentication/workflow-preview/useWorkflowPlayback";

beforeAll(async () => {
  await import("../../src/app/features/authentication/workflow-preview/WorkflowPreviewPanel");
}, 60_000);
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});

async function openPreview(title: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(title) }));
  return screen.findByRole("dialog", { name: title }, { timeout: 10_000 });
}

function tick(seconds: number) {
  for (let second = 0; second < seconds; second++) act(() => vi.advanceTimersByTime(1000));
}

it("opens both login previews in playback mode with timeline and chapter navigation", async () => {
  render(<WorkflowPreview />);
  for (const title of ["Interdepartmental flow", "Within-office flow"]) {
    await openPreview(title);
    expect(screen.getByRole("heading", { name: "Prepare the Office Budget" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pause flow" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next step" })).toBeNull();
    const preview = screen.getByTitle("eFlow sample screen");
    expect(preview.getAttribute("src")).toContain("walkthrough.html?scene=office-budget");
    expect(preview.parentElement?.hasAttribute("inert")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Pause flow" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Jump to chapter" }), { target: { value: "Project team" } });
    const chapterTitle = title === "Interdepartmental flow" ? "Add an outside office to this project" : "Add the project’s team";
    expect(screen.getByRole("heading", { name: chapterTitle })).toBeTruthy();
    const timeline = screen.getByRole("slider", { name: "Walkthrough timeline" });
    fireEvent.change(timeline, { target: { value: timeline.getAttribute("max") } });
    expect(screen.getByRole("heading", { name: "Archive and retain the record" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Replay flow" }));
    expect(screen.getByRole("heading", { name: "Prepare the Office Budget" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close flow preview" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  }
}, 30_000);

it("covers project-scoped acceptance and a balanced funded example in both guides", () => {
  const shared = ["office-budget", "create-project", "project-funding", "allocate-task", "activate", "request-cash", "authorize", "release", "receipts", "settlement", "task-review", "return-funding", "complete", "archived"];
  for (const scenes of Object.values(WORKFLOW_WALKTHROUGHS)) {
    expect(scenes.filter(scene => shared.includes(scene.id)).map(scene => scene.id)).toEqual(shared);
    const step = (id: string) => scenes.find(scene => scene.id === id)!;
    expect(step("receipts").description).toContain("₱3,500");
    expect(step("settlement").description).toContain("Settle & post");
    expect(step("return-funding").description).toContain("₱6,500");
  }
  const ids = ["add-office", "invite-person", "accept-invite", "assign-guest"];
  expect(WORKFLOW_WALKTHROUGHS.interdepartmental.filter(scene => ids.includes(scene.id)).map(scene => scene.id)).toEqual(ids);
  expect(WORKFLOW_WALKTHROUGHS.department.some(scene => ids.includes(scene.id))).toBe(false);
  expect(WORKFLOW_WALKTHROUGHS.interdepartmental.find(scene => scene.id === "invite-person")?.description).toContain("this project only");
});

it("plays, pauses, seeks, replays and cleans up its timer on close", () => {
  vi.useFakeTimers();
  const ready = () => true;
  const view = renderHook(() => useWorkflowPlayback(3, ready));
  tick(SCENE_SECONDS);
  expect(view.result.current.stepIndex).toBe(1);
  act(() => view.result.current.togglePlay());
  tick(4);
  expect(view.result.current.elapsed).toBe(SCENE_SECONDS);
  act(() => view.result.current.seek(2 * SCENE_SECONDS));
  expect(view.result.current.stepIndex).toBe(2);
  expect(view.result.current.isPlaying).toBe(false);
  act(() => view.result.current.togglePlay());
  tick(SCENE_SECONDS);
  expect(view.result.current.ended).toBe(true);
  act(() => view.result.current.togglePlay());
  expect(view.result.current.elapsed).toBe(0);
  expect(view.result.current.isPlaying).toBe(true);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("waits briefly for narration, then continues if the browser speech engine stalls", () => {
  vi.useFakeTimers();
  const view = renderHook(() => useWorkflowPlayback(2, () => false));
  tick(SCENE_SECONDS);
  expect(view.result.current.stepIndex).toBe(0);
  tick(8);
  expect(view.result.current.stepIndex).toBe(1);
});

it("does not consume scene time before the real screen is ready", () => {
  vi.useFakeTimers();
  const view = renderHook(({ loaded }) => useWorkflowPlayback(2, () => true, () => loaded), { initialProps: { loaded: false } });
  tick(SCENE_SECONDS * 2);
  expect(view.result.current.elapsed).toBe(0);
  view.rerender({ loaded: true });
  tick(1);
  expect(view.result.current.elapsed).toBe(1);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("stops narration when paused and on close", async () => {
  class Utterance {
    onstart?: () => void;
    constructor(readonly text: string) {}
  }
  const speech = { cancel: vi.fn(), getVoices: () => [], speak: vi.fn((utterance: Utterance) => utterance.onstart?.()) };
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  vi.stubGlobal("speechSynthesis", speech);
  render(<WorkflowPreview />);
  await openPreview("Within-office flow");
  const frame = screen.getByTitle("eFlow sample screen") as HTMLIFrameElement;
  act(() => window.dispatchEvent(new MessageEvent("message", { source: frame.contentWindow, origin: location.origin, data: { type: "eflow-walkthrough-ready", scene: "office-budget" } })));
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole("button", { name: "Turn narration on" }));
  act(() => vi.advanceTimersByTime(350));
  expect(speech.speak.mock.calls[0][0].text).toContain("Prepare the Office Budget");
  const beforePause = speech.cancel.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Pause flow" }));
  expect(speech.cancel.mock.calls.length).toBeGreaterThan(beforePause);
  fireEvent.click(screen.getByRole("button", { name: "Play flow" }));
  act(() => vi.advanceTimersByTime(350));
  const beforeClose = speech.cancel.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Close flow preview" }));
  expect(speech.cancel.mock.calls.length).toBeGreaterThan(beforeClose);
}, 30_000);
