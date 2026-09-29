// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkflowPreview } from "../../src/app/features/authentication";
import { WORKFLOW_GUIDES } from "../../src/app/features/authentication/workflow-preview/workflowGuides";
import { useWorkflowPlayback, WORKFLOW_STEP_DURATION } from "../../src/app/features/authentication/workflow-preview/useWorkflowPlayback";

afterEach(() => { cleanup(); vi.useRealTimers(); });

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
    expect(screen.getByRole("heading", { name: "Build the work plan" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    expect(screen.getByRole("heading", { name: "Create a proposal" })).toBeTruthy();
    fireEvent.change(screen.getByRole("slider", { name: "Jump to workflow step" }), { target: { value: WORKFLOW_GUIDES.interdepartmental.steps.length } });
    expect(screen.getByRole("heading", { name: "Archive and retain the record" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Next step" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close flow preview" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Within-department flow/ }));
    expect(screen.getByRole("dialog", { name: "Within-department flow" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Create a proposal" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Step .*Request department approvals/ })).toBeNull();
  });
});

describe("workflow playback", () => {
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
