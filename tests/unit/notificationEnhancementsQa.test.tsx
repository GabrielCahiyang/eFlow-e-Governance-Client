// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Notification } from '../../src/app/services/notificationService';

const hoisted = vi.hoisted(() => ({
  subscribeCallback: null as ((rows: Notification[]) => void) | null,
  markAllRead: vi.fn(async (_userId: string) => {}),
  markSingleRead: vi.fn(async (_userId: string, _id: string) => {}),
  inboxRows: [] as Notification[],
  inboxCount: 2,
  inboxFilters: {} as Record<string, unknown>,
  inboxRetry: vi.fn(),
  inboxLoadMore: vi.fn(),
  updateEmailPref: vi.fn(async (_userId: string, enabled: boolean) => ({
    email_notifications_enabled: enabled,
  })),
  supabaseCalls: {
    eq: [] as Array<[string, unknown]>,
    in: [] as Array<[string, unknown]>,
    or: [] as string[],
    gte: [] as Array<[string, unknown]>,
  },
}));

vi.mock('../../src/lib/supabase', () => {
  const buildChain = () => {
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = (col: string, val: unknown) => {
      hoisted.supabaseCalls.eq.push([col, val]);
      return chain;
    };
    chain.in = (col: string, val: unknown) => {
      hoisted.supabaseCalls.in.push([col, val]);
      return chain;
    };
    chain.or = (expr: string) => {
      hoisted.supabaseCalls.or.push(expr);
      return chain;
    };
    chain.gte = (col: string, val: unknown) => {
      hoisted.supabaseCalls.gte.push([col, val]);
      return chain;
    };
    chain.order = () => chain;
    chain.limit = async () => ({ data: [], error: null, status: 200 });
    return chain;
  };
  return {
    supabase: {
      from: () => buildChain(),
    },
  };
});

vi.mock('../../src/app/services/notificationService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/app/services/notificationService')>();
  return {
    ...actual,
    subscribeToNotifications: vi.fn(
      (_userId: string, onUpdate: (rows: Notification[]) => void) => {
        hoisted.subscribeCallback = onUpdate;
        return () => {
          hoisted.subscribeCallback = null;
        };
      },
    ),
    markAllNotificationsRead: (userId: string) => hoisted.markAllRead(userId),
    markRecentNotificationRead: (userId: string, id: string) =>
      hoisted.markSingleRead(userId, id),
  };
});

vi.mock('../../src/app/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-qa' },
    userProfile: {
      id: 'user-qa',
      role: 'head',
      email_notifications_enabled: true,
    },
    updateUserProfile: vi.fn(),
  }),
}));

vi.mock('../../src/app/services/userSettingsService', () => ({
  updateEmailPreference: (userId: string, enabled: boolean) =>
    hoisted.updateEmailPref(userId, enabled),
}));

vi.mock('../../src/app/features/notifications/hooks/useNotificationInbox', () => ({
  useNotificationInbox: (_userId: string, filters: Record<string, unknown>) => {
    hoisted.inboxFilters = filters;
    return {
      rows: hoisted.inboxRows,
      unreadCount: hoisted.inboxCount,
      next: null,
      loading: false,
      refreshing: false,
      loadingMore: false,
      error: '',
      retry: hoisted.inboxRetry,
      loadMore: hoisted.inboxLoadMore,
    };
  },
}));

import {
  playNotificationChime,
  resetNotificationChimeCooldownForTest,
} from '../../src/app/features/notifications/notificationSound';
import {
  formatNotificationExactManila,
  getManilaStartOfDayIso,
  groupNotificationsByManilaDate,
  sanitizePostgrestSearch,
} from '../../src/app/features/notifications/visuals';
import { fetchNotificationPage } from '../../src/app/features/notifications/services/notificationInboxService';
import { NotificationBell } from '../../src/app/components/ui/NotificationBell';
import { UpdatesFeed } from '../../src/app/features/action-center/components/UpdatesFeed';
import { NotificationSettingsPage } from '../../src/app/features/settings/components/NotificationSettingsPage';
import { readPersonalSettings } from '../../src/app/features/settings/personalSettingsStore';

interface FakeAudioTracker {
  oscillatorCount: number;
  resumeCount: number;
  restore: () => void;
}

function installFakeAudioContext(): FakeAudioTracker {
  const tracker = { oscillatorCount: 0, resumeCount: 0 };
  const original = (window as unknown as { AudioContext?: unknown }).AudioContext;

  class FakeAudioContext {
    state = 'running';
    currentTime = 0;
    destination = {};
    resume = vi.fn(async () => {
      tracker.resumeCount += 1;
      this.state = 'running';
    });
    createGain = () => ({
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    });
    createOscillator = () => {
      tracker.oscillatorCount += 1;
      return {
        type: 'sine',
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
    };
  }

  (window as unknown as { AudioContext?: unknown }).AudioContext = FakeAudioContext;
  return {
    get oscillatorCount() {
      return tracker.oscillatorCount;
    },
    get resumeCount() {
      return tracker.resumeCount;
    },
    restore: () => {
      (window as unknown as { AudioContext?: unknown }).AudioContext = original;
    },
  };
}

function makeNotif(overrides: Partial<Notification> & { id: string }): Notification {
  return {
    type: 'assignment',
    title: `Notification ${overrides.id}`,
    message: 'Assigned you to Budget review task.',
    taskId: 'task-101',
    taskTitle: 'Prepare Q4 Budget',
    actorName: 'Maria Clara',
    read: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('Notification bell sound, live banners, search, filters & Manila date grouping', () => {
  let audio: FakeAudioTracker;

  beforeEach(() => {
    localStorage.clear();
    document.title = 'eFlow';
    resetNotificationChimeCooldownForTest();
    audio = installFakeAudioContext();
    hoisted.subscribeCallback = null;
    hoisted.inboxRows = [];
    hoisted.inboxCount = 0;
    hoisted.inboxFilters = {};
    hoisted.supabaseCalls.eq = [];
    hoisted.supabaseCalls.in = [];
    hoisted.supabaseCalls.or = [];
    hoisted.supabaseCalls.gte = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    audio.restore();
    vi.useRealTimers();
  });

  it('plays synthesized bell chimes, distinguishes normal vs urgent, respects mute, and coalesces bursts', () => {
    expect(playNotificationChime('normal', { enabled: false })).toBe(false);
    expect(audio.oscillatorCount).toBe(0);

    // Normal tone: 1 bell strike = 3 harmonic partials
    expect(playNotificationChime('normal', { enabled: true, volume: 'normal' })).toBe(true);
    expect(audio.oscillatorCount).toBe(3);

    // Rapid burst within 1.5s cooldown is coalesced
    expect(playNotificationChime('normal', { enabled: true })).toBe(false);
    expect(audio.oscillatorCount).toBe(3);

    // Force (Test sound) bypasses cooldown & mute; urgent plays 2 strikes (6 partials)
    expect(playNotificationChime('urgent', { enabled: false, force: true, volume: 'soft' })).toBe(true);
    expect(audio.oscillatorCount).toBe(9);
  });

  it('sanitizes PostgREST search strings and applies server search and urgent category queries safely', async () => {
    expect(sanitizePostgrestSearch('  %budget_(Q4),*\\ "test"  ')).toBe('budget Q4 test');
    expect(sanitizePostgrestSearch('a'.repeat(200)).length).toBe(120);

    await fetchNotificationPage('user-qa', {
      category: 'urgent',
      period: 'all',
      unreadOnly: false,
      query: 'budget%(2026),test',
    });

    expect(hoisted.supabaseCalls.in).toHaveLength(1);
    expect(hoisted.supabaseCalls.in[0][0]).toBe('type');
    expect(hoisted.supabaseCalls.or).toHaveLength(1);
    expect(hoisted.supabaseCalls.or[0]).toContain('title.ilike.*budget 2026 test*');
    expect(hoisted.supabaseCalls.or[0]).toContain('task_title.ilike.*budget 2026 test*');
    expect(hoisted.supabaseCalls.or[0]).not.toContain('%');
    expect(hoisted.supabaseCalls.or[0]).not.toContain('(');
  });

  it('groups notifications strictly by Asia/Manila midnight boundaries and formats MM/DD/YYYY hh:mmAM/PM', () => {
    const manilaNoon = Date.parse('2026-11-22T12:00:00+08:00');
    expect(getManilaStartOfDayIso(0, manilaNoon)).toBe('2026-11-21T16:00:00.000Z');

    // 2026-11-21T16:30:00Z is 2026-11-22 12:30AM in Manila -> Today
    const justAfterManilaMidnight = Date.parse('2026-11-21T16:30:00Z');
    // 2026-11-21T15:30:00Z is 2026-11-21 11:30PM in Manila -> Yesterday
    const justBeforeManilaMidnight = Date.parse('2026-11-21T15:30:00Z');
    const threeDaysAgo = Date.parse('2026-11-19T04:00:00Z');
    const twoWeeksAgo = Date.parse('2026-11-05T04:00:00Z');

    expect(formatNotificationExactManila(justAfterManilaMidnight)).toBe('11/22/2026, 12:30 AM');

    const groups = groupNotificationsByManilaDate(
      [
        makeNotif({ id: 'today-1', createdAt: justAfterManilaMidnight }),
        makeNotif({ id: 'yest-1', createdAt: justBeforeManilaMidnight }),
        makeNotif({ id: 'week-1', createdAt: threeDaysAgo }),
        makeNotif({ id: 'old-1', createdAt: twoWeeksAgo }),
      ],
      manilaNoon,
    );

    expect(groups.map((g) => g.label)).toEqual([
      'Today',
      'Yesterday',
      'Earlier this week',
      'Older',
    ]);
    expect(groups[0].items.map((i) => i.id)).toEqual(['today-1']);
    expect(groups[1].items.map((i) => i.id)).toEqual(['yest-1']);
    expect(groups[2].items.map((i) => i.id)).toEqual(['week-1']);
    expect(groups[3].items.map((i) => i.id)).toEqual(['old-1']);
  });

  it('triggers live banner, plays chime, supports hover-pause, Open & Mark read actions, burst collapse, and tab title badge', async () => {
    const onNavigate = vi.fn();
    render(<NotificationBell userId="user-qa" role="head" onNavigate={onNavigate} />);

    const now = Date.now();
    const initial = [
      makeNotif({ id: 'init-1', title: 'Initial review', type: 'approval_needed', createdAt: now - 10_000 }),
    ];

    // Initial load: no banner, no bell chime, dynamic tab title shows (1)
    act(() => {
      hoisted.subscribeCallback?.(initial);
    });
    expect(screen.queryByLabelText('Live notifications')).toBeNull();
    expect(audio.oscillatorCount).toBe(0);
    expect(document.title).toBe('(1) eFlow');

    // New urgent unread arrival triggers chime + top-right live banner
    const incomingUrgent = makeNotif({
      id: 'live-1',
      type: 'overdue',
      title: 'Budget deadline overdue',
      message: 'Q4 submission is past due.',
      createdAt: now,
    });
    act(() => {
      hoisted.subscribeCallback?.([incomingUrgent, ...initial]);
    });

    expect(audio.oscillatorCount).toBe(6); // urgent 2-strike chime
    expect(document.title).toBe('(2) eFlow');
    const banner = screen.getByRole('alert');
    expect(banner.textContent).toContain('Budget deadline overdue');
    expect(banner.textContent).toContain('Overdue');
    expect(document.body.querySelector('.rounded-full')).toBeNull();

    // Hover pauses countdown bar, leave resumes
    fireEvent.mouseEnter(banner);
    expect(banner.getAttribute('data-paused')).toBe('true');
    fireEvent.mouseLeave(banner);
    expect(banner.getAttribute('data-paused')).toBe('false');

    // Clicking "Mark read" marks single read without navigating and dismisses banner
    fireEvent.click(screen.getByRole('button', { name: 'Mark read' }));
    await waitFor(() => {
      expect(hoisted.markSingleRead).toHaveBeenCalledWith('user-qa', 'live-1');
    });
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();

    // Second live arrival -> clicking primary action navigates & marks read
    resetNotificationChimeCooldownForTest();
    const incomingAssignment = makeNotif({
      id: 'live-2',
      type: 'assignment',
      title: 'Assigned to Procurement Review',
      message: 'Please review vendor quotes.',
      createdAt: now + 500,
    });
    act(() => {
      hoisted.subscribeCallback?.([incomingAssignment, incomingUrgent, ...initial]);
    });
    expect(audio.oscillatorCount).toBe(9); // normal 1-strike chime (+3)
    fireEvent.click(screen.getByRole('button', { name: 'Open task' }));
    await waitFor(() => {
      expect(hoisted.markSingleRead).toHaveBeenCalledWith('user-qa', 'live-2');
      expect(onNavigate).toHaveBeenCalled();
    });

    // Mute via bell header & verify burst of 4 collapses into 1 summary banner with zero chime
    fireEvent.click(screen.getByRole('button', { name: 'Open notifications' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mute notification sound' }));
    expect(readPersonalSettings('user-qa').notificationSoundEnabled).toBe(false);

    resetNotificationChimeCooldownForTest();
    const oscBeforeBurst = audio.oscillatorCount;
    const burst = [1, 2, 3, 4].map((n) =>
      makeNotif({ id: `burst-${n}`, title: `Burst item ${n}`, createdAt: now + 1000 + n }),
    );
    act(() => {
      hoisted.subscribeCallback?.([...burst, incomingAssignment, incomingUrgent, ...initial]);
    });
    expect(audio.oscillatorCount).toBe(oscBeforeBurst);
    expect(screen.getByText('4 new notifications')).toBeTruthy();
  });

  it('keeps compact Bell popover uncluttered and shows Manila date groups, Today (PH), match count, and quick Mark read in fullscreen only', () => {
    render(<NotificationBell userId="user-qa" role="head" onNavigate={vi.fn()} />);

    const now = Date.now();
    act(() => {
      hoisted.subscribeCallback?.([
        makeNotif({ id: 't-1', title: 'Initial review', type: 'approval_needed', createdAt: now - 10_000 }),
        makeNotif({ id: 'y-1', title: 'Yesterday update', type: 'comment', read: true, createdAt: now - 30 * 3600_000 }),
      ]);
    });

    // Compact popover: search & category exist, NO time period / date groups / per-row Mark read
    fireEvent.click(screen.getByRole('button', { name: 'Open notifications' }));
    const headerActions = document.querySelector('.eflow-notif-panel__actions');
    const tabsBar = document.querySelector('.eflow-notif-panel__tabs-bar');
    expect(headerActions?.querySelectorAll('button').length).toBe(3); // Mute, Expand, Close only
    expect(headerActions?.textContent).not.toContain('Mark all read');
    expect(tabsBar?.textContent).toContain('Mark all read');
    expect(screen.getByLabelText('Search notifications')).toBeTruthy();
    expect(screen.getByLabelText('Filter notifications by category')).toBeTruthy();
    expect(screen.queryByLabelText('Filter notifications by time period')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Today' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark read' })).toBeNull();

    // Expand to Fullscreen -> time period (Today PH), Manila date groups, match count & per-item Mark read appear
    fireEvent.click(screen.getByRole('button', { name: 'Expand notifications' }));
    expect(screen.getByLabelText('Filter notifications by time period')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Mark read' }).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Search notifications'), {
      target: { value: 'Yesterday update' },
    });
    expect(screen.getByText('1 matching notification')).toBeTruthy();
    expect(screen.getByText('Yesterday update')).toBeTruthy();
    expect(screen.queryByText('Initial review')).toBeNull();
    expect(document.body.querySelector('.rounded-full')).toBeNull();
  });

  it('supports debounced search, Today (PH), Urgent category, date grouping, and sound toggle in Inbox UpdatesFeed', async () => {
    const now = Date.now();
    hoisted.inboxRows = [
      makeNotif({ id: 'u1', title: 'Approve travel liquidation', type: 'petty_cash_leader_review', createdAt: now }),
      makeNotif({ id: 'u2', title: 'Older memo', type: 'comment', read: true, createdAt: now - 30 * 3600_000 }),
    ];
    hoisted.inboxCount = 1;

    const { container } = render(<UpdatesFeed onOpen={() => {}} />);

    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Action required / Urgent' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Today (PH)' })).toBeTruthy();
    expect(container.querySelector('.rounded-full')).toBeNull();

    // Debounced search updates filters.query
    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText('Search notifications'), {
      target: { value: 'liquidation' },
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(hoisted.inboxFilters.query).toBe('liquidation');

    // Clear search omits query again
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect('query' in hoisted.inboxFilters).toBe(false);
    vi.useRealTimers();

    // 1-click mute syncs personalSettingsStore
    fireEvent.click(screen.getByRole('button', { name: 'Mute notification sound' }));
    expect(readPersonalSettings('user-qa').notificationSoundEnabled).toBe(false);
  });

  it('exposes bell sound defaults, volume, test sound button, and opt-in desktop notification controls in NotificationSettingsPage', () => {
    render(<NotificationSettingsPage />);

    const soundSwitch = screen.getByRole('switch', { name: 'Notification bell sound' });
    expect(soundSwitch.getAttribute('aria-checked')).toBe('true');

    const desktopSwitch = screen.getByRole('switch', {
      name: 'Desktop notifications when tab is hidden',
    });
    expect(desktopSwitch.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Test sound' }));
    expect(audio.oscillatorCount).toBe(3);
    expect(screen.getByText('Played notification bell chime.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Notification bell volume'), {
      target: { value: 'soft' },
    });
    expect(readPersonalSettings('user-qa').notificationSoundVolume).toBe('soft');
  });
});
