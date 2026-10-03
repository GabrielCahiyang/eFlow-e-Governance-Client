// @vitest-environment jsdom
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useProcessingGuard } from "../../src/app/features/proposal-import/hooks/useProcessingGuard";
import { isNavigationLocked, acquireNavigationLock } from "../../src/app/shared/navigationLock";
import { useRoleNavigationState } from "../../src/app/features/navigation/useRoleNavigationState";
import { suggestedFirstSteps } from "../../src/app/features/guided-tours/firstSteps";
import { TaskDepartmentLabel, TaskDepartmentProvider } from "../../src/app/features/tasks/components/TaskDepartmentLabel";
import { deadlineFromInputs, deadlineInputParts, isValidCalendarDeadline } from "../../src/app/features/tasks/selectors/deadlineInput";
import { CollaborationActionRail } from "../../src/app/features/interdepartment-collaboration/components/CollaborationActionRail";
import { Modal } from "../../src/app/components/ui/Modal";

describe("PDF operation lock", () => {
  it("ignores close and Escape during processing and allows closing after release", () => {
    const close = vi.fn();
    const view = render(<Modal isOpen preventClose onClose={close} title="Processing proposal"><p>Reading the PDF</p></Modal>);
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(close).not.toHaveBeenCalled();
    view.rerender(<Modal isOpen onClose={close} title="Processing proposal"><p>Ready to review</p></Modal>);
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(close).toHaveBeenCalledOnce();
  });
  it.each(["success", "failure"])("releases navigation and unload guards on %s", () => {
    const onProcessingChange = vi.fn();
    const view = renderHook(({ active }) => useProcessingGuard(active, onProcessingChange), { initialProps: { active: true } });
    expect(isNavigationLocked()).toBe(true);
    const busyUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(busyUnload);
    expect(busyUnload.defaultPrevented).toBe(true);
    view.rerender({ active: false });
    expect(isNavigationLocked()).toBe(false);
    const freeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(freeUnload);
    expect(freeUnload.defaultPrevented).toBe(false);
    expect(onProcessingChange).toHaveBeenLastCalledWith(false);
  });
  it("keeps other concurrent operation locks and cleans up unmounted imports", () => {
    const releaseOther = acquireNavigationLock();
    const view = renderHook(() => useProcessingGuard(true));
    view.unmount();
    expect(isNavigationLocked()).toBe(true);
    releaseOther();
    expect(isNavigationLocked()).toBe(false);
  });
  it("blocks sidebar and history navigation while processing and restores navigation afterward", () => {
    window.history.replaceState({}, "", "/dashboard");
    const initialPage = () => "Overview";
    const view = renderHook(() => useRoleNavigationState("head", initialPage));
    const release = acquireNavigationLock();
    fireEvent(window, new PopStateEvent("popstate"));
    act(() => view.result.current.selectPage("projects", "Plans & Projects"));
    expect(view.result.current.activeSection).toBe("dashboard");
    release();
    act(() => view.result.current.selectPage("projects", "Plans & Projects"));
    expect(view.result.current.activeSection).toBe("projects");
  });
});

describe("clear task context", () => {
  it("uses the task office before its activity, includes supporting offices, and only defaults draft tasks", () => {
    const organizations = [{ id: "lead", name: "LEDIPO" }, { id: "activity", name: "Activity office" }, { id: "support", name: "TDFRO" }] as any;
    const view = render(<TaskDepartmentProvider organizations={organizations} defaultDepartmentId="lead"><TaskDepartmentLabel task={{ primaryOrgId: "lead", activityPrimaryOrgId: "activity", supportingOrgIds: ["support"] }} /></TaskDepartmentProvider>);
    expect(screen.getByText("Office: LEDIPO")).toBeTruthy();
    expect(screen.getByText("Supporting offices: TDFRO")).toBeTruthy();
    view.rerender(<TaskDepartmentProvider organizations={organizations} defaultDepartmentId="lead"><TaskDepartmentLabel task={{}} /></TaskDepartmentProvider>);
    expect(screen.getByText("Office: Office not set")).toBeTruthy();
    view.rerender(<TaskDepartmentProvider organizations={organizations} defaultDepartmentId="lead"><TaskDepartmentLabel task={{}} draft /></TaskDepartmentProvider>);
    expect(screen.getByText("Office: LEDIPO")).toBeTruthy();
  });
  it("round trips Philippine due times and rejects impossible calendar dates", () => {
    expect(deadlineInputParts("2026-09-30T15:30:00Z")).toEqual({ date: "2026-09-30", time: "23:30" });
    expect(deadlineFromInputs("2026-09-30", "23:30")).toBe("2026-09-30T23:30:00+08:00");
    expect(deadlineFromInputs("2026-09-30", "")).toBe("2026-09-30");
    expect(isValidCalendarDeadline("2026-02-30")).toBe(false);
    expect(isValidCalendarDeadline("2026-09-30T25:00:00+08:00")).toBe(false);
    expect(isValidCalendarDeadline("2026-09-30T23:30:00+08:00")).toBe(true);
  });
  it("suggests actions available to each role", () => {
    const sections = [{ id: "projects", label: "Plans & Projects", page: "Plans & Projects" }, { id: "users", label: "Users", page: "All Users" }, { id: "tasks", label: "Tasks", page: "My Tasks" }];
    expect(suggestedFirstSteps("admin", sections)[0].id).toBe("users");
    expect(suggestedFirstSteps("head", sections)[0].description).toContain("Review your office work plans");
    expect(suggestedFirstSteps("member", sections.filter((section) => section.id === "tasks")).map((section) => section.id)).toEqual(["tasks"]);
  });
});

describe("resend approval interactions", () => {
  it("preserves the confirmation after failure and permits retry without duplicate clicks", async () => {
    let rejectRequest: (error: Error) => void = () => {};
    const request = vi.fn().mockImplementationOnce(() => new Promise((_, reject) => { rejectRequest = reject; })).mockResolvedValue(undefined);
    render(<CollaborationActionRail isOwner departmentOnly={false} status="changes_requested" readiness={null} busy={false} hasRevision onRequestReview={request} onCommit={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Resend approval requests" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Resend approval requests" }));
    const send = screen.getByTestId("confirm-request-collaboration-review");
    fireEvent.click(send); fireEvent.click(send);
    expect(request).toHaveBeenCalledTimes(1);
    rejectRequest(new Error("Network unavailable"));
    await waitFor(() => expect(screen.getByText("Network unavailable")).toBeTruthy());
    expect(screen.getByText("Send this plan for review?")).toBeTruthy();
    fireEvent.click(send);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "Resend approval requests" })).toBeTruthy());
  });
});
