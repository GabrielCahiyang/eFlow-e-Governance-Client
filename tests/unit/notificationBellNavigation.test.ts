// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { markRead } = vi.hoisted(() => ({
  markRead: vi.fn(async () => undefined),
}));

vi.mock("../../src/app/services/notificationService", () => ({
  subscribeToNotifications: (_userId: string, callback: (items: unknown[]) => void) => {
    callback([{
      id: "notification-1",
      type: "approval_needed",
      title: "Subtask evidence ready for review",
      message: 'Gabriel submitted "Prepare presentation".',
      taskId: "task-1",
      taskTitle: "Parent task",
      statusTo: "for_review",
      read: false,
      createdAt: Date.now(),
    }]);
    return () => undefined;
  },
  markNotificationRead: markRead,
  markAllNotificationsRead: vi.fn(async () => undefined),
}));

import { NotificationBell } from "../../src/app/components/ui/NotificationBell";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("notification bell navigation", () => {
  it("marks an alert read, closes the panel, and opens its role destination", async () => {
    const navigate = vi.fn();
    render(createElement(NotificationBell, {
      userId: "user-1",
      role: "head",
      onNavigate: navigate,
    }));

    fireEvent.click(screen.getByTitle("1 unread notifications"));
    expect(screen.getByText("Open subtask review")).toBeTruthy();

    const row = screen.getByText("Subtask evidence ready for review").closest("button");
    expect(row).toBeTruthy();
    fireEvent.click(row!);

    await waitFor(() => {
      expect(markRead).toHaveBeenCalledWith("user-1", "notification-1");
      expect(navigate).toHaveBeenCalledWith("reviews", "For Review");
    });
    expect(screen.queryByText("Open subtask review")).toBeNull();
  });
});
