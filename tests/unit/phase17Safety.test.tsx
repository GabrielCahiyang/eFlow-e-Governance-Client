// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReviewedMutation } from "../../src/app/shared/useReviewedMutation";
import {
  installNavigationConfirmation,
  requestNavigation,
} from "../../src/app/shared/navigationGuard";
import { useExplicitDraft } from "../../src/app/shared/useExplicitDraft";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
};

describe("Phase 17 reviewed actions", () => {
  function Harness({
    operation,
    refresh,
    context = "task-a",
    severe = false,
    validate,
  }: {
    operation: () => Promise<void>;
    refresh?: () => Promise<void>;
    context?: string;
    severe?: boolean;
    validate?: () => void;
  }) {
    const safety = useReviewedMutation(context);
    return (
      <>
        <button
          onClick={() =>
            void safety.run({
              key: "remove",
              operation,
              refresh,
              validate,
              success: "Record saved.",
              confirmation: {
                title: "Review record change?",
                description: "Review the current record.",
                actionLabel: "Apply change",
                confirmationText: severe ? "Record A" : undefined,
                reason: severe
                  ? { label: "Required reason", onAccept: () => {} }
                  : undefined,
              },
            })
          }
        >
          Change record
        </button>
        {safety.dialog}
        <p role="status">{safety.message}</p>
      </>
    );
  }
  it.each(["Cancel", "Escape"])(
    "dismisses with %s without writing and returns focus",
    async (dismiss) => {
      const operation = vi.fn().mockResolvedValue(undefined);
      render(<Harness operation={operation} />);
      const trigger = screen.getByRole("button", { name: "Change record" });
      trigger.focus();
      fireEvent.click(trigger);
      const dialog = await screen.findByRole("alertdialog");
      if (dismiss === "Cancel")
        fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
      else fireEvent.keyDown(dialog, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(operation).not.toHaveBeenCalled();
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    },
  );
  it("requires exact typed confirmation and a nonblank reason, then deduplicates synchronously", async () => {
    const write = deferred<void>(),
      operation = vi.fn(() => write.promise);
    render(<Harness operation={operation} severe />);
    const trigger = screen.getByRole("button", { name: "Change record" });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("alertdialog");
    const apply = within(dialog).getByRole("button", { name: "Apply change" });
    expect((apply as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Type Record A to confirm"), {
      target: { value: "Record A" },
    });
    expect((apply as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Required reason/), {
      target: { value: "Official correction" },
    });
    fireEvent.click(apply);
    fireEvent.click(apply);
    await waitFor(() => expect(operation).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Change record" }));
    expect(operation).toHaveBeenCalledTimes(1);
    await act(async () => write.resolve());
    expect(screen.getByRole("status").textContent).toBe("Record saved.");
  });
  it("keeps the known write receipt after failed refresh and rejects replay", async () => {
    const operation = vi.fn().mockResolvedValue(undefined),
      refresh = vi.fn().mockRejectedValue(new Error("Read unavailable"));
    render(<Harness operation={operation} refresh={refresh} />);
    fireEvent.click(screen.getByRole("button", { name: "Change record" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Apply change" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Record saved. The view could not refresh",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Change record" }));
    expect(operation).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
  it("requires verification after a lost response and rejects another write", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("Response lost"));
    render(<Harness operation={operation} />);
    fireEvent.click(screen.getByRole("button", { name: "Change record" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Apply change" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "result needs verification",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Change record" }));
    expect(operation).toHaveBeenCalledTimes(1);
  });
  it("rejects context changes and latest validation blockers after confirmation", async () => {
    const operation = vi.fn().mockResolvedValue(undefined);
    const view = render(<Harness operation={operation} context="a" />);
    fireEvent.click(screen.getByRole("button", { name: "Change record" }));
    await screen.findByRole("alertdialog");
    view.rerender(<Harness operation={operation} context="b" />);
    fireEvent.click(screen.getByRole("button", { name: "Apply change" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(operation).not.toHaveBeenCalled();
    view.rerender(
      <Harness
        operation={operation}
        context="b"
        validate={() => {
          throw new Error("Current dependency blocks removal");
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Change record" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Apply change" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "Current dependency blocks removal",
      ),
    );
    expect(operation).not.toHaveBeenCalled();
  });
});

describe("Phase 17 fresh discard context", () => {
  it("resets the latest baseline callback after acceptance", async () => {
    const decision = deferred<boolean>(),
      uninstall = installNavigationConfirmation(() => decision.promise);
    const oldReset = vi.fn(),
      newReset = vi.fn(),
      destination = vi.fn();
    const view = renderHook(
      ({ reset }) => useExplicitDraft("Team", true, false, reset, "task-a"),
      { initialProps: { reset: oldReset } },
    );
    let navigation!: Promise<boolean>;
    act(() => {
      navigation = requestNavigation(destination);
    });
    view.rerender({ reset: newReset });
    await act(async () => decision.resolve(true));
    expect(await navigation).toBe(true);
    expect(newReset).toHaveBeenCalledOnce();
    expect(oldReset).not.toHaveBeenCalled();
    expect(destination).toHaveBeenCalledOnce();
    uninstall();
  });
  it.each(["identity", "pending"])(
    "rejects a changed %s before discarding",
    async (change) => {
      const decision = deferred<boolean>(),
        uninstall = installNavigationConfirmation(() => decision.promise),
        reset = vi.fn(),
        destination = vi.fn();
      const view = renderHook(
        ({ identity }) =>
          useExplicitDraft("Team", true, false, reset, identity),
        { initialProps: { identity: "a" } },
      );
      let navigation!: Promise<boolean>;
      act(() => {
        navigation = requestNavigation(destination);
      });
      if (change === "identity") view.rerender({ identity: "b" });
      else view.result.current.pendingRef.current = true;
      await act(async () => decision.resolve(true));
      expect(await navigation).toBe(false);
      expect(reset).not.toHaveBeenCalled();
      expect(destination).not.toHaveBeenCalled();
      uninstall();
    },
  );
});
