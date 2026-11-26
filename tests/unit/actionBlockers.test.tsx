// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ActionBlockerGroup,
  normalizeBlockers,
  type ActionBlockerItem,
} from "../../src/app/components/ui/action-blockers";
import { Button } from "../../src/app/components/ui/button";

afterEach(cleanup);

describe("Red Stop Blocker Button & ActionBlockersModal", () => {
  it("hides the red Stop button completely when there are no blockers", () => {
    render(
      <ActionBlockerGroup actionLabel="Activate project" blockers={[]}>
        <button type="button">Activate project</button>
      </ActionBlockerGroup>,
    );

    expect(screen.getByRole("button", { name: "Activate project" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /blocker/i })).toBeNull();
  });

  it("hides the red Stop button during transient busy/loading states", () => {
    render(
      <ActionBlockerGroup
        actionLabel="Save project"
        blockers="Saving…"
        busy
      >
        <button type="button" disabled>
          Saving…
        </button>
      </ActionBlockerGroup>,
    );

    expect(screen.queryByRole("button", { name: /blocker/i })).toBeNull();
    expect(normalizeBlockers("Saving…")).toEqual([]);
    expect(normalizeBlockers("Wait for the current action to finish.")).toEqual([]);
  });

  it("splits compound Head & Financial Officer approval blockers and displays both in the modal", () => {
    const items = normalizeBlockers(
      "Office Head endorsement and independent Accounting Staff certification are required before activation.",
    );
    expect(items).toHaveLength(2);
    expect(items[0].category).toBe("head_approval");
    expect(items[1].category).toBe("accounting_approval");

    render(
      <ActionBlockerGroup actionLabel="Activate project" blockers={items}>
        <button type="button" disabled>
          Activate project
        </button>
      </ActionBlockerGroup>,
    );

    const stopBtn = screen.getByRole("button", {
      name: /View 2 blockers/i,
    });
    expect(stopBtn.textContent).toContain("2 blockers");

    fireEvent.click(stopBtn);

    const dialog = screen.getByRole("dialog", {
      name: /Action blocked: Activate project/i,
    });
    expect(dialog.textContent).toContain("Waiting for Office Head approval");
    expect(dialog.textContent).toContain(
      "Waiting for Financial Officer (Accounting) approval",
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders structured amount (₱) and PH date (Asia/Manila) and invokes jump actions", () => {
    const onJump = vi.fn();
    const blockers: ActionBlockerItem[] = [
      {
        id: "unreturned",
        category: "financial_gate",
        title: "Unused project budget not returned",
        detail: "Return all unallocated project funds to Office Budget before closing.",
        waitingOn: "Office Head",
        amount: 10500,
        dueAt: "2026-11-26T08:00:00Z",
        actionLabel: "Open Budget tab",
        onAction: onJump,
      },
    ];

    render(
      <ActionBlockerGroup actionLabel="Mark project complete" blockers={blockers}>
        <button type="button" disabled>
          Confirm completion
        </button>
      </ActionBlockerGroup>,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /View 1 blocker/i,
      }),
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("₱10,500.00");
    expect(dialog.textContent).toContain("11/26/2026");

    fireEvent.click(screen.getByRole("button", { name: "Open Budget tab" }));
    expect(onJump).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("integrates directly with shared Button disabledReason prop", () => {
    render(
      <Button
        disabled
        disabledReason="Late liquidations require Office Head authorization before Accounting can settle."
      >
        Settle & post
      </Button>,
    );

    const stopBtn = screen.getByRole("button", {
      name: /View 2 blockers/i,
    });
    expect(stopBtn).toBeTruthy();

    fireEvent.click(stopBtn);
    expect(screen.getByRole("dialog").textContent).toContain(
      "Waiting for Office Head approval",
    );
  });
});
