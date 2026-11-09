// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const metrics = vi.hoisted(() => {
  const tableReads: string[] = [];
  const rpcCalls: string[] = [];
  const channelsCreated: string[] = [];
  const channelsRemoved: string[] = [];
  const results = new Map<string, Promise<unknown>>();
  const channelCallbacks = new Map<
    string,
    {
      onStatus?: (status: string) => void;
      handlers: Array<{ table?: string; cb: (payload?: any) => void }>;
    }
  >();

  function reset() {
    tableReads.length = 0;
    rpcCalls.length = 0;
    channelsCreated.length = 0;
    channelsRemoved.length = 0;
    results.clear();
  }

  function makeQuery(table: string) {
    let recorded = false;
    const record = () => {
      if (!recorded) {
        recorded = true;
        tableReads.push(table);
      }
    };
    const rowsForTable = () => {
      switch (table) {
        case "organizations":
          return [
            {
              id: "org-1",
              name: "Operations Office",
              code: "OPS",
              path: "ops",
              description: "",
              is_active: true,
              status: "active",
              created_at: "2026-01-01T00:00:00Z",
            },
          ];
        case "profiles":
          return [
            {
              id: "user-1",
              email: "head@eflow.local",
              full_name: "Alex Rivera",
              role: "head",
              org_id: "org-1",
              is_active: true,
              status: "Active",
              created_at: "2026-01-01T00:00:00Z",
              organizations: { name: "Operations Office" },
            },
          ];
        case "projects":
          return [
            {
              id: "proj-1",
              title: "Grid Modernization",
              description: "Desc",
              status: "Active",
              priority: "High",
              progress: 40,
              org_id: "org-1",
              lead_id: "user-1",
              start_date: "2026-01-01",
              end_date: "2026-12-31",
              created_at: "2026-01-01T00:00:00Z",
            },
          ];
        case "tasks":
          return [
            {
              id: "task-1",
              project_id: "proj-1",
              org_id: "org-1",
              title: "Substation Audit",
              description: "Audit",
              status: "In Progress",
              priority: "High",
              progress: 50,
              assigned_to_ids: ["user-1"],
              created_by: "user-1",
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-02T00:00:00Z",
            },
          ];
        case "subtasks":
          return [
            {
              id: "sub-1",
              task_id: "task-1",
              title: "Check relays",
              description: "",
              status: "in_progress",
              progress: 50,
              assigned_to_ids: ["user-1"],
              created_by: "user-1",
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-02T00:00:00Z",
            },
          ];
        case "proposal_collaboration_drafts":
          return [
            {
              id: "draft-1",
              title: "Joint Fiber Proposal",
              owner_org_id: "org-1",
              created_by: "user-1",
              status: "review",
              source_type: "manual",
              current_revision_id: "rev-1",
              snapshot: {
                title: "Joint Fiber Proposal",
                summary: "",
                organizations: [
                  {
                    organizationId: "org-1",
                    organizationName: "Operations Office",
                    participationRole: "owner",
                  },
                ],
                workItems: [],
              },
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-02T00:00:00Z",
            },
          ];
        case "proposal_collaboration_revisions":
          return [{ id: "rev-1", revision_number: 1 }];
        case "proposal_collaboration_approvals":
          return [];
        case "organization_memberships":
          return [
            { organization_id: "org-1", membership_role: "primary_approver" },
          ];
        case "notifications":
          return [
            {
              id: "notif-1",
              user_id: "user-1",
              title: "Update",
              message: "Task updated",
              type: "assignment",
              read: false,
              created_at: "2026-01-02T00:00:00Z",
            },
          ];
        case "announcements":
          return [
            {
              id: "ann-1",
              title: "Q1 Townhall",
              body: "Welcome",
              audience: "all",
              status: "published",
              org_id: "org-1",
              created_at: "2026-01-02T00:00:00Z",
              updated_at: "2026-01-02T00:00:00Z",
            },
          ];
        default:
          return [];
      }
    };
    const builder: Record<string, any> = {
      select: () => builder,
      eq: () => builder,
      neq: () => builder,
      is: () => builder,
      in: () => builder,
      or: () => builder,
      gte: () => builder,
      lte: () => builder,
      lt: () => builder,
      gt: () => builder,
      order: () => builder,
      range: (from: number) => {
        if (from > 0) {
          record();
          return Promise.resolve({ data: [], error: null, count: 0 });
        }
        return builder;
      },
      limit: () => builder,
      maybeSingle: () => {
        record();
        const rows = rowsForTable();
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      },
      single: () => {
        record();
        const rows = rowsForTable();
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      },
      then: (onFulfilled: any, onRejected: any) => {
        record();
        return (results.get(table) || Promise.resolve({
          data: rowsForTable(),
          error: null,
          count: rowsForTable().length,
        })).then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  return {
    tableReads,
    rpcCalls,
    channelsCreated,
    channelsRemoved,
    channelCallbacks,
    results,
    reset,
    makeQuery,
  };
});

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: (table: string) => metrics.makeQuery(table),
    rpc: (fn: string) => {
      metrics.rpcCalls.push(fn);
      if (metrics.results.has(fn)) return metrics.results.get(fn);
      if (fn === "department_budget_summary") {
        return Promise.resolve({
          data: {
            id: "budget-1",
            orgId: "org-1",
            fiscalYear: 2026,
            status: "locked",
            approvedAmount: 100000,
          },
          error: null,
        });
      }
      if (fn === "get_office_budget_sections") {
        return Promise.resolve({
          data: { sections: [], version: 1 },
          error: null,
        });
      }
      if (fn === "r8_list_office_team") {
        return Promise.resolve({
          data: {
            officeId: "org-1",
            officeName: "Operations Office",
            members: [],
          },
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    },
    channel: (topic: string) => {
      metrics.channelsCreated.push(topic);
      const handlers: Array<{ table?: string; cb: (payload?: any) => void }> =
        [];
      const ch = {
        topic,
        on: (_type: string, filter: { table?: string }, cb: any) => {
          handlers.push({ table: filter?.table, cb });
          return ch;
        },
        subscribe: (cb?: (status: string) => void) => {
          metrics.channelCallbacks.set(topic, { onStatus: cb, handlers });
          cb?.("SUBSCRIBED");
          return ch;
        },
        unsubscribe: () => Promise.resolve("ok"),
      };
      return ch;
    },
    removeChannel: (ch: { topic?: string }) => {
      if (ch?.topic) metrics.channelCallbacks.delete(ch.topic);
      metrics.channelsRemoved.push(ch?.topic ?? "unknown");
      return Promise.resolve("ok");
    },
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: "user-1" } }, error: null }),
      getSession: () =>
        Promise.resolve({
          data: { session: { access_token: "tok" } },
          error: null,
        }),
    },
  },
}));

const authState = {
  user: { id: "user-1", email: "head@eflow.local" },
  userProfile: {
    id: "user-1",
    email: "head@eflow.local",
    full_name: "Alex Rivera",
    role: "head",
    org_id: "org-1",
    is_active: true,
  },
  can: () => true,
};
const officeScope = { kind: "office" as const, id: "org-1" };

vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("../../src/app/shared/phase2Api", () => ({
  phase2Request: () =>
    Promise.resolve({ office_name: "Operations Office", members: [] }),
}));

vi.mock("../../src/app/features/invitations", () => ({
  listInvitations: () => Promise.resolve({ invitations: [] }),
}));

import {
  useOrgs,
  useProfiles,
  useProjectsData,
  useTasksData,
} from "../../src/app/hooks/useSupabaseData";
import {
  useEmployees,
  useEmployeeNotes,
} from "../../src/app/hooks/useFirebaseData";
import { usePendingPlanDrafts } from "../../src/app/features/app-shell/usePendingPlanDrafts";
import { useCollaborationDrafts } from "../../src/app/features/interdepartment-collaboration/hooks/useCollaborationDrafts";
import { useDepartmentTeamAnalytics } from "../../src/app/features/team-management/hooks/useDepartmentTeamAnalytics";
import { useDepartmentBudget } from "../../src/app/features/budget/hooks/useDepartmentBudget";
import { useGeneralJournal } from "../../src/app/features/budget/hooks/useGeneralJournal";
import { usePersonalFeed } from "../../src/app/features/action-center/hooks/usePersonalFeed";
import { useOfficeTeam } from "../../src/app/features/office-team/hooks/useOfficeTeam";
import { useWorkFeed } from "../../src/app/features/personal-work/hooks/useWorkFeed";
import { refreshProfiles, subscribeToProfiles } from "../../src/lib/supabaseService";
import { resetAuthCaches } from "../../src/app/shared/authCacheReset";
import {
  buildQueryScopeKey,
  inspectStorageAndCache,
  loadWithQueryCache,
  purgeAllQueryCaches,
  readCachedQuery,
} from "../../src/app/shared/queryCache";
import { StorageCacheSettingsPage } from "../../src/app/features/settings/components/StorageCacheSettingsPage";
import { writeSubtaskReviewDraft } from "../../src/app/features/reviews/services/subtaskReviewDraftStore";

describe("Navigation & Caching Benchmark and Verification", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    resetAuthCaches();
    metrics.reset();
  });
  afterEach(() => {
    cleanup();
  });

  it("reduces repeat-navigation requests to zero and eliminates loading resets across screens", async () => {
    // 1. Mount App Shell hooks (stays mounted across navigation)
    const shell = renderHook(() => {
      const tasks = useTasksData();
      const projects = useProjectsData();
      const orgs = useOrgs();
      const drafts = usePendingPlanDrafts("user-1", true);
      return { tasks, projects, orgs, drafts };
    });
    await waitFor(() => {
      expect(shell.result.current.tasks.loading).toBe(false);
      expect(shell.result.current.projects.loading).toBe(false);
      expect(shell.result.current.orgs.loading).toBe(false);
    });

    // 2. Cold visit Screen A: Head Dashboard / Team Analytics + duplicate Budget Summary mounts
    const screenACold = renderHook(() => {
      const orgs = useOrgs();
      const profiles = useProfiles();
      const team = useDepartmentTeamAnalytics();
      const budget1 = useDepartmentBudget("org-1", 2026);
      const budget2 = useDepartmentBudget("org-1", 2026);
      return { orgs, profiles, team, budget1, budget2 };
    });
    await waitFor(() => {
      expect(screenACold.result.current.orgs.loading).toBe(false);
      expect(screenACold.result.current.profiles.loading).toBe(false);
      expect(screenACold.result.current.team.loading).toBe(false);
      expect(screenACold.result.current.budget1.loading).toBe(false);
      expect(screenACold.result.current.budget2.loading).toBe(false);
    });
    // Concurrent budget1 and budget2 mounts must deduplicate RPC calls to 1
    expect(
      metrics.rpcCalls.filter((fn) => fn === "department_budget_summary"),
    ).toHaveLength(1);
    screenACold.unmount();

    // 3. Cold visit Screen B: Inbox / Action Center
    const screenBCold = renderHook(() => usePersonalFeed("user-1"));
    await waitFor(() => expect(screenBCold.result.current.loading).toBe(false));
    screenBCold.unmount();

    // 4. Cold visit Screen C: Reviews & Collaboration Inbox
    const screenCCold = renderHook(() => {
      const collab = useCollaborationDrafts();
      const orgs = useOrgs();
      const profiles = useProfiles();
      return { collab, orgs, profiles };
    });
    await waitFor(() => {
      expect(screenCCold.result.current.collab.loading).toBe(false);
      expect(screenCCold.result.current.orgs.loading).toBe(false);
    });
    screenCCold.unmount();

    // 5. Cold visit Screen D: Office Budget & General Journal + Office Team
    const screenDCold = renderHook(() => {
      const budget = useDepartmentBudget("org-1", 2026);
      const journal = useGeneralJournal("org-1", 2026, "user-1");
      const officeTeam = useOfficeTeam(officeScope, true);
      const employees = useEmployees();
      const notes = useEmployeeNotes();
      return { budget, journal, officeTeam, employees, notes };
    });
    await waitFor(() => {
      expect(screenDCold.result.current.budget.loading).toBe(false);
      expect(screenDCold.result.current.journal.loading).toBe(false);
      expect(screenDCold.result.current.officeTeam.loading).toBe(false);
      expect(screenDCold.result.current.employees.loading).toBe(false);
      expect(screenDCold.result.current.notes.loading).toBe(false);
    });
    screenDCold.unmount();

    const coldReads = metrics.tableReads.length;
    const coldRpcs = metrics.rpcCalls.length;
    const coldChannels = metrics.channelsCreated.length;

    metrics.reset();

    // REPEAT NAVIGATION across Screen A -> Screen B -> Screen C -> Screen D
    let loadingResetCount = 0;

    const screenAWarm = renderHook(() => {
      const orgs = useOrgs();
      const profiles = useProfiles();
      const team = useDepartmentTeamAnalytics();
      const budget = useDepartmentBudget("org-1", 2026);
      return { orgs, profiles, team, budget };
    });
    if (screenAWarm.result.current.orgs.loading) loadingResetCount++;
    if (screenAWarm.result.current.profiles.loading) loadingResetCount++;
    if (screenAWarm.result.current.team.loading) loadingResetCount++;
    if (screenAWarm.result.current.budget.loading) loadingResetCount++;
    expect(screenAWarm.result.current.orgs.orgs).toHaveLength(1);
    expect(screenAWarm.result.current.profiles.profiles).toHaveLength(1);
    expect(screenAWarm.result.current.budget.summary?.id).toBe("budget-1");
    screenAWarm.unmount();

    const screenBWarm = renderHook(() => usePersonalFeed("user-1"));
    if (screenBWarm.result.current.loading) loadingResetCount++;
    expect(screenBWarm.result.current.rows).toHaveLength(1);
    screenBWarm.unmount();

    const screenCWarm = renderHook(() => {
      const collab = useCollaborationDrafts();
      const orgs = useOrgs();
      const profiles = useProfiles();
      return { collab, orgs, profiles };
    });
    if (screenCWarm.result.current.collab.loading) loadingResetCount++;
    if (screenCWarm.result.current.orgs.loading) loadingResetCount++;
    if (screenCWarm.result.current.profiles.loading) loadingResetCount++;
    expect(screenCWarm.result.current.collab.drafts).toHaveLength(1);
    screenCWarm.unmount();

    const screenDWarm = renderHook(() => {
      const budget = useDepartmentBudget("org-1", 2026);
      const journal = useGeneralJournal("org-1", 2026, "user-1");
      const officeTeam = useOfficeTeam(officeScope, true);
      const employees = useEmployees();
      const notes = useEmployeeNotes();
      return { budget, journal, officeTeam, employees, notes };
    });
    if (screenDWarm.result.current.budget.loading) loadingResetCount++;
    if (screenDWarm.result.current.journal.loading) loadingResetCount++;
    if (screenDWarm.result.current.officeTeam.loading) loadingResetCount++;
    if (screenDWarm.result.current.employees.loading) loadingResetCount++;
    if (screenDWarm.result.current.notes.loading) loadingResetCount++;
    screenDWarm.unmount();

    const warmReads = metrics.tableReads.length;
    const warmRpcs = metrics.rpcCalls.length;
    const warmChannels = metrics.channelsCreated.length;

    console.info(
      "BENCHMARK_METRICS",
      JSON.stringify({
        cold: {
          tableReads: coldReads,
          rpcCalls: coldRpcs,
          totalRequests: coldReads + coldRpcs,
          channelsCreated: coldChannels,
        },
        warm: {
          tableReads: warmReads,
          rpcCalls: warmRpcs,
          totalRequests: warmReads + warmRpcs,
          channelsCreated: warmChannels,
          loadingResetCount,
        },
      }),
    );

    expect(loadingResetCount).toBe(0);
    expect(warmReads + warmRpcs).toBe(0);

    shell.unmount();
  });

  it("deduplicates concurrent requests, ignores late responses after scope/auth reset, and revalidates on Realtime & reconnect", async () => {
    let resolveSlow!: (val: string[]) => void;
    const slowFetcher = vi.fn(
      () =>
        new Promise<string[]>((r) => {
          resolveSlow = r;
        }),
    );
    const scopeA = buildQueryScopeKey({
      userId: "user-1",
      officeId: "org-1",
      fiscalYear: 2026,
    });

    // Two concurrent callers share the exact same in-flight request
    const p1 = loadWithQueryCache({
      domain: "custom-domain",
      scope: scopeA,
      fetcher: slowFetcher,
    });
    const p2 = loadWithQueryCache({
      domain: "custom-domain",
      scope: scopeA,
      fetcher: slowFetcher,
    });
    expect(slowFetcher).toHaveBeenCalledTimes(1);

    // Account logout / auth reset before the slow request resolves
    resetAuthCaches();
    resolveSlow(["stale-secret-data"]);
    await Promise.all([p1, p2]);

    // Late response from pre-logout generation must NOT populate the cache
    expect(readCachedQuery("custom-domain", scopeA).hit).toBe(false);

    // Mount orgs hook and verify Realtime + Reconnect invalidation
    const orgHook = renderHook(() => useOrgs());
    await waitFor(() => expect(orgHook.result.current.loading).toBe(false));
    const readsBefore = metrics.tableReads.filter(
      (t) => t === "organizations",
    ).length;

    // Simulate Realtime reconnect on shared org channel
    const sharedChannel = metrics.channelCallbacks.get("orgs_realtime_shared");
    expect(sharedChannel).toBeDefined();
    await act(async () => {
      sharedChannel?.onStatus?.("SUBSCRIBED");
    });
    await waitFor(() => {
      expect(
        metrics.tableReads.filter((t) => t === "organizations").length,
      ).toBeGreaterThan(readsBefore);
    });
    // Existing orgs remained visible during background refresh
    expect(orgHook.result.current.orgs).toHaveLength(1);
    expect(orgHook.result.current.loading).toBe(false);
    orgHook.unmount();
  });

  it("keeps a previous account's pending profile result out of a new listener", async () => {
    let complete!: (value: unknown) => void;
    metrics.results.set("profiles", new Promise(resolve => { complete = resolve; }));
    const pending = refreshProfiles();
    await waitFor(() => expect(metrics.tableReads).toContain("profiles"));
    resetAuthCaches();
    const listener = vi.fn();
    const unsubscribe = subscribeToProfiles(listener);
    complete({ data: [{ id: "previous", role: "member" }], error: null });
    await pending;
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("preserves My Work through a source outage and removes it on denied access", async () => {
    const view = renderHook(() => useWorkFeed("user-1"));
    await waitFor(() => expect(view.result.current.data?.rows.length).toBeGreaterThan(0));
    const previous = view.result.current.data;
    const sources = ["tasks", "projects", "subtasks", "r3_list_workspaces", "r7_office_work_roots"];
    for (const source of sources) metrics.results.set(source, Promise.resolve({ data: null, error: { message: "Failed to fetch" }, status: 0 }));
    await act(async () => view.result.current.refresh());
    expect(view.result.current.data).toBe(previous);
    expect(view.result.current.error).toBe("Failed to fetch");
    for (const source of sources) metrics.results.set(source, Promise.resolve({ data: null, error: { message: "Permission denied", code: "42501" }, status: 403 }));
    await act(async () => view.result.current.refresh());
    expect(view.result.current.data).toBeUndefined();
    expect(view.result.current.error).toBe("Permission denied");
  });

  it("clears cached query data in Settings -> Storage & cache while preserving drafts and financial retry records", async () => {
    // Populate caches
    await loadWithQueryCache({
      domain: "organizations",
      scope: "all",
      fetcher: async () => [{ id: "org-1" }],
    });
    await loadWithQueryCache({
      domain: "department-budget",
      scope: buildQueryScopeKey({ officeId: "org-1", fiscalYear: 2026 }),
      fetcher: async () => ({ summary: { id: "b-1" } }),
    });

    // Populate protected browser records (nested work draft, review feedback draft, financial retry receipts)
    window.sessionStorage.setItem(
      "eflow:nested-work-draft:v1:user-1:task-1",
      JSON.stringify({ title: "Draft work item" }),
    );
    window.sessionStorage.setItem(
      "eflow:independent-review:user-1:liq-1",
      JSON.stringify({ idempotencyKey: "retry-key-1", uncertain: true }),
    );
    window.sessionStorage.setItem(
      "eflow.office-petty.pending:user-1:org-1",
      JSON.stringify({ idempotencyKey: "petty-retry-1" }),
    );
    writeSubtaskReviewDraft(
      "user-1",
      {
        subtask: { id: "sub-1", taskId: "task-1" } as any,
        submission: {
          id: "subm-1",
          taskId: "task-1",
          subtaskId: "sub-1",
          version: 1,
          status: "pending",
        } as any,
      } as any,
      "Needs receipt attachment before approval",
    );

    expect(inspectStorageAndCache().totalCachedEntries).toBeGreaterThanOrEqual(
      2,
    );

    render(<StorageCacheSettingsPage />);
    expect(screen.getByTestId("protected-work-drafts").textContent).toContain(
      "1 preserved",
    );
    expect(screen.getByTestId("protected-review-drafts").textContent).toContain(
      "1 preserved",
    );
    expect(
      screen.getByTestId("protected-financial-retries").textContent,
    ).toContain("2 preserved");

    fireEvent.click(
      screen.getByRole("button", { name: /Clear cached data/i }),
    );

    expect(screen.getByTestId("cache-entry-count").textContent).toBe("0");
    expect(
      screen.getByText(/Drafts, attachments awaiting submission, and financial retry records were preserved/i),
    ).toBeTruthy();

    // Protected drafts and financial retry records must still exist untouched
    expect(
      window.sessionStorage.getItem("eflow:nested-work-draft:v1:user-1:task-1"),
    ).toContain("Draft work item");
    expect(
      window.sessionStorage.getItem("eflow:independent-review:user-1:liq-1"),
    ).toContain("retry-key-1");
    expect(
      window.sessionStorage.getItem("eflow.office-petty.pending:user-1:org-1"),
    ).toContain("petty-retry-1");
    expect(inspectStorageAndCache().protectedRecords.reviewDraftsCount).toBe(1);

    // Clean up review draft
    writeSubtaskReviewDraft(
      "user-1",
      {
        subtask: { id: "sub-1", taskId: "task-1" } as any,
        submission: {
          id: "subm-1",
          taskId: "task-1",
          subtaskId: "sub-1",
          version: 1,
          status: "pending",
        } as any,
      } as any,
      "",
    );
    purgeAllQueryCaches("manual");
  });
});
