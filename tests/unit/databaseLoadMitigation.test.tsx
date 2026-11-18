// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  channelHandlers: [] as Array<{
    name: string;
    table: string;
    callback: (payload: any) => void;
  }>,
  removeChannel: vi.fn(),
}));

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    rpc: api.rpc,
    from: api.from,
    channel: (name: string) => {
      const channel = {
        on: (
          _event: string,
          filter: { table: string },
          callback: (payload: any) => void,
        ) => {
          api.channelHandlers.push({ name, table: filter.table, callback });
          return channel;
        },
        subscribe: () => channel,
      };
      return channel;
    },
    removeChannel: api.removeChannel,
  },
}));

import { resetAuthCaches } from "../../src/app/shared/authCacheReset";
import {
  runTaskMaintenance,
  resetTaskMaintenanceCooldown,
} from "../../src/app/features/tasks/services/taskMaintenanceService";
import {
  runDepartmentBudgetMaintenance,
  resetBudgetMaintenanceCooldown,
} from "../../src/app/features/budget/services/budgetService";
import { usePresentationBranding } from "../../src/app/features/administration/configuration/usePresentationBranding";
import { useAiRuntimeStatus } from "../../src/app/features/ai/hooks/useAiRuntimeStatus";
import { readProjectFlow } from "../../src/app/features/project-setup/services/projectFlow";
import { fetchReadiness } from "../../src/app/features/project-readiness/services/readinessService";
import { fetchProjectCompletionReadiness } from "../../src/app/features/projects/services/projectLifecycleService";
import {
  listWorkspaces,
  selectWorkspace,
} from "../../src/app/features/workspaces/services/workspaceService";

beforeEach(() => {
  vi.clearAllMocks();
  api.channelHandlers = [];
  resetTaskMaintenanceCooldown();
  resetBudgetMaintenanceCooldown();
  resetAuthCaches();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Database load mitigation", () => {
  it("throttles task and budget maintenance RPCs across repeated triggers until auth reset", async () => {
    api.rpc.mockResolvedValue({ data: 0, error: null });

    await Promise.all([runTaskMaintenance(), runTaskMaintenance()]);
    expect(api.rpc).toHaveBeenCalledTimes(2);
    expect(api.rpc).toHaveBeenCalledWith("dispatch_task_reminders");
    expect(api.rpc).toHaveBeenCalledWith("materialize_due_task_templates");

    // Repeated call within cooldown does not re-trigger write RPCs.
    await runTaskMaintenance();
    expect(api.rpc).toHaveBeenCalledTimes(2);

    await Promise.all([
      runDepartmentBudgetMaintenance(),
      runDepartmentBudgetMaintenance(),
    ]);
    expect(api.rpc).toHaveBeenCalledTimes(3);
    expect(api.rpc).toHaveBeenCalledWith("run_department_budget_maintenance");

    await runDepartmentBudgetMaintenance();
    expect(api.rpc).toHaveBeenCalledTimes(3);

    // Auth cache reset clears the cooldowns for the next user session.
    resetAuthCaches();
    await runTaskMaintenance();
    await runDepartmentBudgetMaintenance();
    expect(api.rpc).toHaveBeenCalledTimes(6);
  });

  it("ignores AI heartbeat Realtime updates in usePresentationBranding and shares one query across concurrent consumers", async () => {
    let configCalls = 0;
    let orgName = "LEDIPO";
    api.from.mockImplementation((table: string) => ({
      select: () => ({
        in: () => {
          if (table === "system_config") configCalls += 1;
          return Promise.resolve({
            data: [{ key: "organization_name", value: orgName }],
            error: null,
          });
        },
      }),
    }));

    const shell = renderHook(() => usePresentationBranding("user-1"));
    const topBar = renderHook(() => usePresentationBranding("user-1"));

    await waitFor(() =>
      expect(shell.result.current.organization_name).toBe("LEDIPO"),
    );
    expect(topBar.result.current.organization_name).toBe("LEDIPO");
    // In-flight deduplication and shared channel keep initial mount to 1 query and 1 channel.
    expect(configCalls).toBe(1);
    const brandingChannels = api.channelHandlers.filter((h) =>
      h.name.startsWith("system-config:branding:"),
    );
    expect(brandingChannels).toHaveLength(1);

    // AI heartbeat update must not trigger a branding refetch.
    act(() => {
      brandingChannels[0].callback({
        new: {
          key: "ai_endpoint_heartbeat",
          value: new Date().toISOString(),
        },
      });
    });
    expect(configCalls).toBe(1);

    // Actual branding key update refreshes both consumers.
    orgName = "Ormoc LGU";
    act(() => {
      brandingChannels[0].callback({
        new: { key: "organization_name", value: "Ormoc LGU" },
      });
    });
    await waitFor(() =>
      expect(shell.result.current.organization_name).toBe("Ormoc LGU"),
    );
    expect(topBar.result.current.organization_name).toBe("Ormoc LGU");
    expect(configCalls).toBe(2);
  });

  it("skips redundant AI status refetches when a fresh heartbeat arrives for an already-online endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ai_endpoint: "https://tunnel.example.test/controlpanelEflow/api",
        ai_endpoint_status: "online",
        ai_endpoint_heartbeat: new Date().toISOString(),
        local_ai: false,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const hook = renderHook(() => useAiRuntimeStatus());
    await waitFor(() => expect(hook.result.current.status).toBe("online"));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const aiHandler = api.channelHandlers.find((h) =>
      h.name.startsWith("ai_runtime_"),
    );
    expect(aiHandler).toBeDefined();

    // Fresh heartbeat while already online should not trigger another HTTP/DB read.
    act(() => {
      aiHandler!.callback({
        new: {
          key: "ai_endpoint_heartbeat",
          value: new Date().toISOString(),
        },
      });
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Status change still triggers an immediate refresh.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ai_endpoint: "https://tunnel.example.test/controlpanelEflow/api",
        ai_endpoint_status: "offline",
        ai_endpoint_heartbeat: new Date().toISOString(),
        local_ai: false,
      }),
    });
    act(() => {
      aiHandler!.callback({
        new: { key: "ai_endpoint_status", value: "offline" },
      });
    });
    await waitFor(() => expect(hook.result.current.status).toBe("offline"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent in-flight RPC calls for project flow, readiness, completion, and workspaces", async () => {
    api.rpc.mockImplementation(async (name: string, args?: any) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (name === "project_flow_snapshot") {
        return {
          data: {
            project: {
              id: args.p_project,
              title: "P",
              description: "D",
              scope: "S",
              project_lead_id: "L",
              start_date: "2026-11-01",
              target_date: "2026-11-10",
              funding_not_required: true,
            },
            total: 0,
            ready: true,
          },
          error: null,
        };
      }
      if (name === "phase7_project_readiness") {
        return {
          data: {
            projectId: args.p_project,
            governed: false,
            ready: true,
            canActivate: true,
            checks: [],
          },
          error: null,
        };
      }
      if (name === "get_project_completion_readiness") {
        return {
          data: {
            projectId: args.p_project_id,
            title: "P",
            status: "active",
            canComplete: true,
            blockers: [],
          },
          error: null,
        };
      }
      if (name === "r3_list_workspaces") {
        return {
          data: [{ id: "ws-1", name: "Office", kind: "office" }],
          error: null,
        };
      }
      if (name === "r3_select_workspace") {
        return {
          data: {
            workspace: { id: args.p_workspace, name: "Office", kind: "office" },
            projects: [],
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    await Promise.all([
      readProjectFlow("proj-1"),
      readProjectFlow("proj-1"),
      fetchReadiness("proj-1"),
      fetchReadiness("proj-1"),
      fetchProjectCompletionReadiness("proj-1"),
      fetchProjectCompletionReadiness("proj-1"),
      listWorkspaces(),
      listWorkspaces(),
      selectWorkspace("ws-1"),
      selectWorkspace("ws-1"),
    ]);

    const callsByName = api.rpc.mock.calls.reduce<Record<string, number>>(
      (acc, [name]) => {
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      },
      {},
    );
    expect(callsByName.phase7_project_readiness).toBe(1);
    expect(callsByName.get_project_completion_readiness).toBe(1);
    expect(callsByName.r3_list_workspaces).toBe(1);
    expect(callsByName.r3_select_workspace).toBe(1);
  });
});
