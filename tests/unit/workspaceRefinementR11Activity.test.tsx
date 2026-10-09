// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../src/lib/supabase", () => ({ supabase: { rpc: api.rpc } }));
vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "reader" } }),
}));
vi.mock("../../src/app/features/workspaces", () => ({
  useWorkspaceScope: () => ({
    workspace: {
      id: "office",
      name: "Office workspace",
      timezone: "Asia/Singapore",
    },
  }),
}));
vi.mock("../../src/app/services/auditService", () => ({
  recordAudit: vi.fn(),
}));
import {
  fetchActivityPage,
  fetchActivityPrint,
} from "../../src/app/features/projects/activity/activityService";
import { activityDateBound } from "../../src/app/features/projects/activity/activityDates";
import { DEFAULT_ACTIVITY_FILTERS } from "../../src/app/features/projects/activity/types";
import { ProjectActivityTab } from "../../src/app/features/projects/components/project-command/ProjectActivityTab";
import type { ProjectCommandData } from "../../src/app/features/projects/components/project-command/types";
const filters = { ...DEFAULT_ACTIVITY_FILTERS, timezone: "Asia/Singapore" };
const source = Array.from({ length: 310 }, (_, index) => ({
  event_id: `progress:task:${String(310 - index).padStart(4, "0")}`,
  kind: index % 2 ? "status" : "progress",
  title: `History event ${310 - index}`,
  detail: "Recorded fact",
  actor_name: "Lead",
  occurred_at: "2026-10-01T10:00:00Z",
  task_id: "task",
}));
let failure = -1,
  snapshots: Record<string, typeof source>,
  sequence = 0;
beforeEach(() => {
  vi.clearAllMocks();
  failure = -1;
  snapshots = {};
  sequence = 0;
  api.rpc.mockImplementation(async (_name: string, args: any) => {
    if (args.p_page === failure)
      return { data: null, error: { message: "Source unavailable" } };
    let snapshot = args.p_snapshot;
    if (!snapshot) {
      snapshot = `snapshot-${++sequence}`;
      snapshots[snapshot] = source.filter(
        (e) =>
          (args.p_kind === "all" || e.kind === args.p_kind) &&
          `${e.title} ${e.detail} ${e.actor_name}`
            .toLowerCase()
            .includes(args.p_search.toLowerCase()),
      );
    }
    const events = snapshots[snapshot],
      page = Math.min(
        args.p_page,
        Math.max(0, Math.floor((events.length - 1) / args.p_size)),
      );
    return {
      data: {
        snapshot,
        asOf: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        page,
        size: args.p_size,
        total: events.length,
        more: (page + 1) * args.p_size < events.length,
        events: events.slice(page * args.p_size, (page + 1) * args.p_size),
      },
      error: null,
    };
  });
});
afterEach(cleanup);
describe("R11 Activity completeness", () => {
  it("uses the backend contract and reaches every event with stable identities", async () => {
    const first = await fetchActivityPage("project", filters);
    expect(first.total).toBe(310);
    expect(first.events).toHaveLength(25);
    const rows = await fetchActivityPrint("project", filters, first, "all");
    expect(rows).toHaveLength(310);
    expect(new Set(rows.map((e) => e.id)).size).toBe(310);
    expect(rows.at(-1)?.title).toBe("History event 1");
    expect(api.rpc).toHaveBeenLastCalledWith(
      "r11_project_activity",
      expect.objectContaining({
        p_snapshot: first.snapshot,
        p_page: 12,
        p_size: 25,
      }),
    );
  });
  it("revalidates current-page print and never returns a partial all-history result", async () => {
    const first = await fetchActivityPage("project", filters);
    const second = await fetchActivityPage(
      "project",
      filters,
      25,
      1,
      first.snapshot,
    );
    expect(
      await fetchActivityPrint("project", filters, second, "page"),
    ).toHaveLength(25);
    failure = 3;
    await expect(
      fetchActivityPrint("project", filters, first, "all"),
    ).rejects.toThrow("Source unavailable");
  });
  it("rejects missing deployment, malformed counts, duplicates and changed snapshots", async () => {
    api.rpc.mockResolvedValueOnce({
      error: { code: "PGRST202", message: "missing" },
      data: null,
    });
    await expect(fetchActivityPage("p", filters)).rejects.toThrow(
      "not installed",
    );
    api.rpc.mockResolvedValueOnce({
      error: null,
      data: { snapshot: "x", events: [] },
    });
    await expect(fetchActivityPage("p", filters)).rejects.toThrow(
      "completeness",
    );
    const first = await fetchActivityPage("p", filters);
    const raw = {
      snapshot: "x",
      asOf: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10000).toISOString(),
      page: 0,
      size: 25,
      total: 25,
      more: false,
      events: Array(25).fill(source[0]),
    };
    api.rpc.mockResolvedValueOnce({ error: null, data: raw });
    await expect(fetchActivityPage("p", filters)).rejects.toThrow("incomplete");
    api.rpc.mockResolvedValueOnce({
      error: null,
      data: { ...raw, snapshot: "other" },
    });
    await expect(
      fetchActivityPage("p", filters, 25, 0, first.snapshot),
    ).rejects.toThrow("snapshot changed");
  });
  it("honors workspace calendar boundaries including DST and rejects invalid dates", () => {
    expect(activityDateBound("2026-10-01", "Asia/Singapore")).toBe(
      "2026-09-30T16:00:00.000Z",
    );
    const from = Date.parse(
        activityDateBound("2026-03-08", "America/New_York")!,
      ),
      to = Date.parse(
        activityDateBound("2026-03-08", "America/New_York", true)!,
      );
    expect(to - from).toBe(23 * 3600000);
    expect(() => activityDateBound("2026-02-30", "Asia/Singapore")).toThrow(
      "Invalid activity date",
    );
  });
  it("resets filters and page size, prints all by default, and restores modal focus", async () => {
    render(
      <ProjectActivityTab
        data={
          {
            project: { id: "project", title: "Community outreach" },
          } as ProjectCommandData
        }
      />,
    );
    await screen.findByText("1\u201325 of 310 events", { exact: false });
    await fireEvent.click(
      screen.getByRole("button", { name: "Next", exact: true }),
    );
    await screen.findByText("26\u201350 of 310 events", { exact: false });
    fireEvent.change(screen.getByLabelText("Filter activity type"), {
      target: { value: "progress" },
    });
    await screen.findByText("1\u201325 of 155 events", { exact: false });
    fireEvent.change(screen.getByLabelText("Events per page"), {
      target: { value: "50" },
    });
    await screen.findByText("1\u201350 of 155 events", { exact: false });
    fireEvent.click(screen.getByRole("button", { name: "Prepare print" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Activity print preview",
    });
    const frame = within(dialog).getByTitle("Activity print document");
    expect(frame.getAttribute("srcdoc")).toContain("155 row(s)");
    expect(frame.getAttribute("srcdoc")).toContain("History event 2");
    expect(frame.getAttribute("srcdoc")).toContain("Office workspace");
    expect(frame.getAttribute("srcdoc")).toContain("counter(pages)");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Close print preview" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("shows retry on server failures without claiming there are no events", async () => {
    failure = 0;
    render(
      <ProjectActivityTab
        data={
          {
            project: { id: "project", title: "Community outreach" },
          } as ProjectCommandData
        }
      />,
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Source unavailable",
    );
    expect(
      screen.queryByText("0 matching events", { exact: false }),
    ).toBeNull();
    failure = -1;
    fireEvent.click(screen.getByRole("button", { name: "Retry history" }));
    await screen.findByText("1\u201325 of 310 events", { exact: false });
  });
  it("prevents a failed later print page from exposing a partial preview", async () => {
    render(
      <ProjectActivityTab
        data={
          {
            project: { id: "project", title: "Community outreach" },
          } as ProjectCommandData
        }
      />,
    );
    await screen.findByText("1\u201325 of 310 events", { exact: false });
    failure = 2;
    fireEvent.click(screen.getByRole("button", { name: "Prepare print" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "no partial document",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("revalidates the frozen snapshot on focus and clears history on access failure", async () => {
    render(
      <ProjectActivityTab
        data={
          {
            project: { id: "project", title: "Community outreach" },
          } as ProjectCommandData
        }
      />,
    );
    await screen.findByText("1\u201325 of 310 events", { exact: false });
    fireEvent(window, new Event("focus"));
    await waitFor(() =>
      expect(api.rpc).toHaveBeenLastCalledWith(
        "r11_project_activity",
        expect.objectContaining({ p_snapshot: "snapshot-1" }),
      ),
    );
    await screen.findByText("1\u201325 of 310 events", { exact: false });
    failure = 0;
    fireEvent(window, new Event("eflow-project-access-changed"));
    await screen.findByRole("alert");
    expect(screen.queryByText("History event 310")).toBeNull();
  });
});
