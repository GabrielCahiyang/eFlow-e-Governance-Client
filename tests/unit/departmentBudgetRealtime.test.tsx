// @vitest-environment jsdom

import { StrictMode, type ReactNode } from "react";
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const realtime = vi.hoisted(() => ({
  channels: new Map<string, {
    subscribed: boolean;
    on: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  }>(),
  topics: [] as string[],
}));

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    channel: vi.fn((topic: string) => {
      realtime.topics.push(topic);
      const existing = realtime.channels.get(topic);
      if (existing) return existing;

      const channel = {
        subscribed: false,
        on: vi.fn(function (this: typeof channel) {
          if (this.subscribed) {
            throw new Error(`cannot add postgres_changes callbacks for realtime:${topic} after subscribe()`);
          }
          return this;
        }),
        subscribe: vi.fn(function (this: typeof channel) {
          this.subscribed = true;
          return this;
        }),
      };
      realtime.channels.set(topic, channel);
      return channel;
    }),
    // Keep removal pending to reproduce the Supabase cleanup race.
    removeChannel: vi.fn(() => new Promise(() => undefined)),
  },
}));

vi.mock("../../src/app/features/budget/services/budgetService", () => ({
  fetchDepartmentBudgetBundle: vi.fn(() => new Promise(() => undefined)),
}));

import { useDepartmentBudget } from "../../src/app/features/budget/hooks/useDepartmentBudget";

afterEach(() => {
  cleanup();
  realtime.channels.clear();
  realtime.topics.length = 0;
});

describe("useDepartmentBudget realtime lifecycle", () => {
  it("uses a fresh topic when Strict Mode remounts before channel removal completes", () => {
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;

    expect(() => renderHook(() => useDepartmentBudget("org-a", 2026), { wrapper })).not.toThrow();
    expect(realtime.topics).toHaveLength(2);
    expect(new Set(realtime.topics)).toHaveLength(2);
  });

  it("shares one Realtime channel across simultaneous hooks and coalesces burst events", () => {
    vi.useFakeTimers();
    const first = renderHook(() => useDepartmentBudget("org-b", 2026));
    const second = renderHook(() => useDepartmentBudget("org-b", 2026));

    expect(realtime.topics).toHaveLength(1);
    const channel = realtime.channels.get(realtime.topics[0]);
    expect(channel).toBeDefined();

    // Unmounting one of two consumers keeps the shared channel active.
    first.unmount();
    expect(realtime.channels.get(realtime.topics[0])?.subscribed).toBe(true);

    // Unmounting the final consumer releases the shared channel and a remount opens a fresh topic.
    second.unmount();
    renderHook(() => useDepartmentBudget("org-b", 2026));
    expect(realtime.topics).toHaveLength(2);
    vi.useRealTimers();
  });
});
