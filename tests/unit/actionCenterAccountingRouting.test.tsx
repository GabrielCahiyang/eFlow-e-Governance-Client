// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Notification } from "../../src/app/services/notificationService";
import {
  completeNotificationNavigationIntent,
  peekNotificationNavigationIntent,
} from "../../src/app/features/notifications/navigationIntent";

const mocks = vi.hoisted(() => ({
  sampleNotification: {
    id: "notif-acct-1",
    type: "petty_cash_liquidation_accounting_review",
    title: "Liquidation ready for accounting settlement",
    message: 'Receipt package for "Field Inspection" is ready for settlement.',
    taskId: "other-employee-task-999",
    financialRecordId: "liq-999",
    financialRecordType: "petty_cash_liquidation",
    read: false,
    createdAt: Date.parse("2026-11-22T04:00:00Z"),
  } as Notification,
  pushNavigationHistory: vi.fn(),
}));

vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "acct-user-1" },
    userProfile: { id: "acct-user-1", role: "accounting_staff", org_id: "org-1" },
    can: () => true,
  }),
}));

vi.mock("../../src/app/hooks/useSupabaseData", () => ({
  useTasksData: () => ({ tasks: [], loading: false, error: null, retry: vi.fn() }),
}));

vi.mock("../../src/app/features/action-center/components/UpdatesFeed", () => ({
  UpdatesFeed: ({ onOpen }: { onOpen: (item: Notification) => void }) => (
    <button type="button" onClick={() => onOpen(mocks.sampleNotification)}>
      Open settlement update
    </button>
  ),
}));

vi.mock("../../src/app/features/budget", () => ({
  AssignedIndependentReviews: () => null,
}));

vi.mock("../../src/app/features/task-inspector", () => ({
  TaskInspector: () => null,
  useTaskInspector: () => ({ taskId: null, origin: undefined, openTask: vi.fn(), close: vi.fn() }),
}));

vi.mock("../../src/app/features/subtasks", () => ({
  fetchPersonalSubtaskReviews: vi.fn(async () => []),
  fetchTaskSubtasks: vi.fn(async () => []),
}));

vi.mock("../../src/app/shared/navigationHistory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/app/shared/navigationHistory")>();
  return {
    ...actual,
    pushNavigationHistory: (...args: unknown[]) => mocks.pushNavigationHistory(...args),
  };
});

import { ActionCenter } from "../../src/app/features/action-center/components/ActionCenter";

beforeEach(() => {
  sessionStorage.clear();
  mocks.pushNavigationHistory.mockReset();
  window.history.replaceState({}, "", "/inbox?page=Notifications");
});

afterEach(() => {
  completeNotificationNavigationIntent("notif-acct-1");
  cleanup();
});

describe("ActionCenter Accounting Staff notification routing", () => {
  it("opens settlement notifications carrying another user's taskId without blocking on personal task membership", async () => {
    render(<ActionCenter role="accounting_staff" page="Notifications" />);

    fireEvent.click(screen.getByRole("button", { name: "Open settlement update" }));

    await waitFor(() => {
      expect(mocks.pushNavigationHistory).toHaveBeenCalledWith(
        "/voucher-cash-releases?page=Settlements",
      );
    });
    expect(screen.queryByText(/referenced task is unavailable/i)).toBeNull();
    expect(peekNotificationNavigationIntent("acct-user-1")).toMatchObject({
      notificationId: "notif-acct-1",
      kind: "budget",
      financialRecordId: "liq-999",
      financialRecordType: "petty_cash_liquidation",
    });
  });
});
