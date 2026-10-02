// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkflowPreview } from "../../src/app/features/authentication";
import { WORKFLOW_GUIDES } from "../../src/app/features/authentication/workflow-preview/workflowGuides";
import { WORKFLOW_WALKTHROUGHS } from "../../src/app/features/authentication/workflow-preview/walkthroughSteps";
import { WorkflowDemo } from "../../src/app/features/authentication/workflow-preview/WorkflowDemo";
import { useWorkflowPlayback, WORKFLOW_STEP_DURATION } from "../../src/app/features/authentication/workflow-preview/useWorkflowPlayback";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("login workflow guides", () => {
  it("distinguishes participation approval from department-only publication and covers both complete journeys", () => {
    const inter = WORKFLOW_GUIDES.interdepartmental.steps;
    const internal = WORKFLOW_GUIDES.department.steps;
    expect(inter.find((step) => step.id === "participation")?.returnPath).toMatch(/resend approval requests/i);
    expect(internal.some((step) => step.id === "participation" || step.id === "departments")).toBe(false);
    expect(internal.find((step) => step.id === "publish")?.description).toMatch(/does not need another department/);
    for (const steps of [inter, internal]) {
      expect(steps[0].id).toBe("create");
      expect(steps.at(-1)?.id).toBe("archive");
      expect(steps.find((step) => step.id === "subtasks")?.condition).toBeTruthy();
      expect(steps.find((step) => step.id === "funding")?.condition).toBeTruthy();
      expect(steps.findIndex((step) => step.id === "funding")).toBeLessThan(steps.findIndex((step) => step.id === "task-review"));
      expect(steps.find((step) => step.id === "task-review")?.returnPath).toMatch(/Unresolved task or subtask cash/);
      expect(steps.find((step) => step.id === "complete")).toBeTruthy();
    }
  });

  it("opens an unsigned-in guide, navigates backward/forward, scrubs to archive, and starts fresh on reopen", () => {
    render(<WorkflowPreview />);
    fireEvent.click(screen.getByRole("button", { name: /Interdepartmental flow/ }));
    expect(screen.getByRole("dialog", { name: "Interdepartmental flow" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Create a proposal" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Previous step" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByRole("heading", { name: "Import a proposal" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    expect(screen.getByRole("heading", { name: "Create a proposal" })).toBeTruthy();
    fireEvent.change(screen.getByRole("slider", { name: "Jump to workflow step" }), { target: { value: WORKFLOW_WALKTHROUGHS.interdepartmental.length } });
    expect(screen.getByRole("heading", { name: "Archive and retain the record" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Next step" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close flow preview" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Within-department flow/ }));
    expect(screen.getByRole("dialog", { name: "Within-department flow" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Create a proposal" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Step .*Request department approvals/ })).toBeNull();
  }, 60000);

  it("changes example screens when a highlighted control is clicked, without leaving the login panel", () => {
    const view = render(<WorkflowPreview />);
    fireEvent.click(screen.getByRole("button", { name: /Interdepartmental flow/ }));
    expect(view.baseElement.querySelector('[data-preview-screen="start"]')).toBeTruthy();
    expect(screen.queryByText("What to do")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Create work plan", exact: true }));
    expect(view.baseElement.querySelector('[data-preview-screen="upload"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Choose proposal PDF/ }));
    expect(view.baseElement.querySelector('[data-preview-screen="extract"]')).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Watch the PDF being prepared" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
    expect(view.baseElement.querySelector('[data-preview-screen="plan"]')).toBeTruthy();
  }, 60000);

  it("provides one real spotlight target for every demo screen and preserves the workflow order", () => {
    for (const kind of ["interdepartmental", "department"] as const) {
      const steps = WORKFLOW_WALKTHROUGHS[kind];
      expect(steps[0].screen).toBe("start");
      expect(steps.at(-1)?.screen).toBe("archived");
      expect(steps.findIndex((step) => step.screen === "settlement")).toBeLessThan(steps.findIndex((step) => step.screen === "review"));
      expect(steps.some((step) => step.screen === "participation")).toBe(kind === "interdepartmental");
      for (const step of steps) {
        const onAction = vi.fn();
        const view = render(<WorkflowDemo kind={kind} step={step} onAction={onAction} />);
        const targets = view.container.querySelectorAll(`[data-preview-target="${step.target}"]`);
        expect(targets.length, `${kind}: ${step.screen}`).toBe(1);
        if (targets[0] instanceof HTMLButtonElement) {
          expect(targets[0].disabled).toBe(false);
          fireEvent.click(targets[0]);
          expect(onAction).toHaveBeenCalledOnce();
        }
        view.unmount();
      }
    }
  }, 60000);
});

describe("workflow playback", () => {
  it("waits for narration without losing pause or close cleanup", () => {
    vi.useFakeTimers();
    let ready = false;
    const view = renderHook(() => useWorkflowPlayback(3, () => ready));
    act(() => view.result.current.togglePlay());
    act(() => vi.advanceTimersByTime(WORKFLOW_STEP_DURATION + 1000));
    expect(view.result.current.stepIndex).toBe(0);
    ready = true;
    act(() => vi.advanceTimersByTime(250));
    expect(view.result.current.stepIndex).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("only advances while playing, stops at the final stage, and replays from the beginning", () => {
    vi.useFakeTimers();
    const view = renderHook(() => useWorkflowPlayback(3));
    act(() => vi.advanceTimersByTime(WORKFLOW_STEP_DURATION));
    expect(view.result.current.stepIndex).toBe(0);
    act(() => view.result.current.togglePlay());
    act(() => vi.advanceTimersByTime(WORKFLOW_STEP_DURATION));
    expect(view.result.current.stepIndex).toBe(1);
    act(() => view.result.current.togglePlay());
    act(() => vi.advanceTimersByTime(WORKFLOW_STEP_DURATION * 2));
    expect(view.result.current.stepIndex).toBe(1);
    act(() => view.result.current.togglePlay());
    act(() => vi.advanceTimersByTime(WORKFLOW_STEP_DURATION));
    expect(view.result.current.stepIndex).toBe(2);
    expect(view.result.current.isPlaying).toBe(false);
    act(() => view.result.current.togglePlay());
    expect(view.result.current.stepIndex).toBe(0);
    expect(view.result.current.isPlaying).toBe(true);
  });

  it("pauses on a manual jump and cannot go past either end", () => {
    vi.useFakeTimers();
    const view = renderHook(() => useWorkflowPlayback(4));
    act(() => view.result.current.previous());
    expect(view.result.current.stepIndex).toBe(0);
    act(() => view.result.current.togglePlay());
    act(() => view.result.current.seek(2));
    expect(view.result.current.isPlaying).toBe(false);
    act(() => vi.advanceTimersByTime(WORKFLOW_STEP_DURATION));
    expect(view.result.current.stepIndex).toBe(2);
    act(() => view.result.current.seek(99));
    act(() => view.result.current.next());
    expect(view.result.current.stepIndex).toBe(3);
  });

  it("releases the autoplay timer when a guide closes", () => {
    vi.useFakeTimers();
    const view = renderHook(() => useWorkflowPlayback(4));
    act(() => view.result.current.togglePlay());
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

it("shows the real workspaces and the complete yearly-budget-to-voucher route in both flows", () => {
  const expected = {
    "annual-budget": ["budget", "Planning & Allocation", "Annual Budget"],
    "lock-budget": ["budget", "Planning & Allocation", "Annual Budget"],
    funding: ["budget", "Planning & Allocation", "Proposal & Task Funding"],
    tasks: ["leading"],
    "cash-request": ["leading", undefined, "View Details → Overview → Task funding"],
    "cash-authorize": ["reviews", "Budget"],
    release: ["accounting"], voucher: ["accounting"],
    "receipt-confirm": ["leading"],
    progress: ["subtasks"], "subtask-submit": ["subtasks"],
    subtasks: ["reviews", "Subtasks"],
    receipts: ["leading"], settlement: ["accounting"],
    submit: ["leading"], review: ["reviews", "Project Tasks"],
  };
  for (const kind of ["interdepartmental", "department"] as const) {
    const steps = WORKFLOW_WALKTHROUGHS[kind];
    for (const [id, [workspace, tab, detail]] of Object.entries(expected)) {
      const step = steps.find((entry) => entry.id === id)!;
      expect(step, `${kind}: ${id}`).toBeTruthy();
      expect(step.workspace).toBe(workspace);
      if (tab) expect(step.tab).toBe(tab);
      if (detail) expect(step.detail).toBe(detail);
    }
    const position = (id: string) => steps.findIndex((entry) => entry.id === id);
    for (const [before, after] of [["lock-budget", "publish"], ["publish", "funding"], ["funding", "cash-request"], ["cash-request", "cash-authorize"], ["cash-authorize", "voucher"], ["voucher", "receipt-confirm"], ["progress", "subtask-submit"], ["subtask-submit", "subtasks"], ["receipts", "settlement"], ["settlement", "review"], ["subtasks", "submit"]]) expect(position(before)).toBeLessThan(position(after));
    expect(steps.find((step) => step.id === "cash-request")?.actor).toBe("Task Leader");
    expect(steps.find((step) => step.id === "cash-request")?.description).toMatch(/own task-level request goes directly/);
    expect(steps.find((step) => step.id === "settlement")?.description).toMatch(/own receipts skip self-endorsement/);
    for (const id of ["progress", "subtasks", "cash-request", "review"]) {
      const step = steps.find((entry) => entry.id === id)!;
      const view = render(<WorkflowDemo kind={kind} step={step} onAction={() => {}} />);
      expect(view.container.querySelector('[data-preview-workspace]')?.getAttribute("data-preview-workspace")).toBe(step.workspace);
      expect(view.container.querySelector('[aria-label="Example workspace tabs"]')?.textContent ?? "").not.toContain("Project tasks");
      view.unmount();
    }
  }
});

it("uses the walkthrough voice, keeps it enabled across steps, and cancels on off and close", () => {
  vi.useFakeTimers();
  class Utterance {
    text: string; onstart?: () => void; onend?: () => void; onerror?: () => void;
    constructor(text: string) { this.text = text; }
  }
  const spoken: Utterance[] = [];
  const speech = { cancel: vi.fn(), getVoices: () => [], speak: vi.fn((utterance: Utterance) => { spoken.push(utterance); utterance.onstart?.(); }) };
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  vi.stubGlobal("speechSynthesis", speech);
  render(<WorkflowPreview />);
  fireEvent.click(screen.getByRole("button", { name: /Within-department flow/ }));
  expect(screen.getByRole("switch", { name: "Turn AI voice on" }).getAttribute("aria-checked")).toBe("false");
  fireEvent.click(screen.getByRole("switch", { name: "Turn AI voice on" }));
  act(() => vi.advanceTimersByTime(350));
  expect(spoken[0].text).toContain("Create a proposal. In Plans & Projects");
  fireEvent.click(screen.getByRole("button", { name: "Next step" }));
  expect(screen.getByRole("switch", { name: "Turn AI voice off" }).getAttribute("aria-checked")).toBe("true");
  act(() => vi.advanceTimersByTime(350));
  expect(spoken[1].text).toContain("Import a proposal.");
  fireEvent.click(screen.getByRole("switch", { name: "Turn AI voice off" }));
  const stopped = speech.cancel.mock.calls.length;
  act(() => vi.advanceTimersByTime(1000));
  expect(speech.speak).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("switch", { name: "Turn AI voice on" }));
  act(() => vi.advanceTimersByTime(350));
  fireEvent.click(screen.getByRole("button", { name: "Close flow preview" }));
  expect(speech.cancel.mock.calls.length).toBeGreaterThan(stopped);
  const total = speech.speak.mock.calls.length;
  act(() => vi.advanceTimersByTime(10000));
  expect(speech.speak).toHaveBeenCalledTimes(total);
}, 60000);

