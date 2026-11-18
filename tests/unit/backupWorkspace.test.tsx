// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  controlPanelFetch: vi.fn(),
  signInWithAccountProtection: vi.fn(),
  toast: vi.fn(),
  confirm: vi.fn().mockResolvedValue(true),
  blocker: vi.fn(),
}));

vi.mock("../../src/app/shared/controlPanelClient", () => {
  class AiServiceUnavailableError extends Error {
    constructor(message = "AI unavailable") {
      super(message);
      this.name = "AiServiceUnavailableError";
    }
  }
  class ControlPanelUnavailableError extends Error {
    constructor(message = "Control panel unavailable") {
      super(message);
      this.name = "ControlPanelUnavailableError";
    }
  }
  return {
    AiServiceUnavailableError,
    ControlPanelUnavailableError,
    controlPanelFetch: mocks.controlPanelFetch,
  };
});

vi.mock("../../src/app/features/authentication", () => ({
  signInWithAccountProtection: mocks.signInWithAccountProtection,
}));

vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "admin@example.test" },
    userProfile: { id: "admin-1", role: "admin" },
    can: () => true,
  }),
}));

vi.mock("../../src/app/components/ui/Toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("../../src/app/components/ui/useConfirmation", () => ({
  useConfirmation: () => ({
    confirm: mocks.confirm,
    dialog: null,
  }),
}));

vi.mock("../../src/app/shared/navigationGuard", () => ({
  useNavigationBlocker: mocks.blocker,
  requestNavigation: (fn: () => void) => fn(),
}));

import { ControlPanelUnavailableError } from "../../src/app/shared/controlPanelClient";
import {
  DEFAULT_BACKUP_JOB_FILTERS,
  filterBackupJobs,
  paginateItems,
} from "../../src/app/features/administration/selectors/backupSelectors";
import {
  BackupServiceError,
  isBackupGatewayUnavailableError,
  type BackupJob,
  type BackupOverview,
} from "../../src/app/features/administration/services/backupService";
import { BackupExportWorkspace } from "../../src/app/features/administration/components/data-tools/BackupExportWorkspace";

function makeJob(index: number, overrides: Partial<BackupJob> = {}): BackupJob {
  return {
    id: `job-${index}`,
    actor_id: "admin-1",
    actor_email: "admin@example.test",
    mode: index % 2 === 0 ? "operational" : "disaster_recovery",
    scope: index % 2 === 0 ? "important" : "full",
    export_format: index % 3 === 0 ? "sql_dump" : "archive",
    status: index === 1 ? "failed" : "completed",
    phase: index === 1 ? "Backup failed" : "Backup ready",
    progress: index === 1 ? 0 : 100,
    created_at: `2026-11-${String(10 + index).padStart(2, "0")}T01:00:00Z`,
    completed_at: `2026-11-${String(10 + index).padStart(2, "0")}T01:02:00Z`,
    expires_at: "2099-01-01T00:00:00Z",
    archive_name:
      index % 3 === 0
        ? `eflow-backup-${index}.sql`
        : `eflow-backup-${index}.zip`,
    archive_size: 4096 * index,
    archive_sha256: `sha-${index}`,
    table_count: 12,
    row_count: 120 * index,
    error: index === 1 ? "Synthetic pg_dump timeout" : null,
    ...overrides,
  };
}

function makeOverview(jobs: BackupJob[]): BackupOverview {
  return {
    preflight: {
      configured: true,
      database_url_configured: true,
      pg_dump_available: true,
      encryption_available: true,
      retention_hours: 24,
      tables: ["projects", "tasks", "profiles", "petty_cash_requests", "audit_events"],
      table_count: 5,
      important_tables: ["projects", "tasks", "profiles", "petty_cash_requests", "audit_events"],
      important_table_count: 5,
      safe_excluded_data_tables: ["app_config", "system_config"],
      discovery_error: null,
    },
    jobs,
  };
}

beforeEach(() => {
  mocks.controlPanelFetch.mockReset();
  mocks.signInWithAccountProtection.mockReset();
  mocks.toast.mockReset();
  mocks.confirm.mockClear();
  if (!URL.createObjectURL) {
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      value: vi.fn(() => "blob:mock"),
    });
  }
  if (!URL.revokeObjectURL) {
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      value: vi.fn(),
    });
  }
});

afterEach(() => {
  cleanup();
});

describe("Backup selectors and error classification", () => {
  it("filters backup jobs by status, format, date range, and search query", () => {
    const jobs = [makeJob(1), makeJob(2), makeJob(3), makeJob(4), makeJob(5), makeJob(6)];
    expect(filterBackupJobs(jobs, DEFAULT_BACKUP_JOB_FILTERS)).toHaveLength(6);
    expect(
      filterBackupJobs(jobs, { ...DEFAULT_BACKUP_JOB_FILTERS, status: "failed" }).map(
        (j) => j.id,
      ),
    ).toEqual(["job-1"]);
    expect(
      filterBackupJobs(jobs, {
        ...DEFAULT_BACKUP_JOB_FILTERS,
        exportFormat: "sql_dump",
      }).map((j) => j.id),
    ).toEqual(["job-3", "job-6"]);
    expect(
      filterBackupJobs(jobs, {
        ...DEFAULT_BACKUP_JOB_FILTERS,
        dateFrom: "2026-11-14",
        dateTo: "2026-11-15",
      }).map((j) => j.id),
    ).toEqual(["job-4", "job-5"]);
    expect(
      filterBackupJobs(jobs, {
        ...DEFAULT_BACKUP_JOB_FILTERS,
        search: "sha-5",
      }).map((j) => j.id),
    ).toEqual(["job-5"]);
  });

  it("paginates items safely and clamps out-of-range page numbers", () => {
    const list = ["a", "b", "c", "d", "e", "f", "g"];
    const p2 = paginateItems(list, 2, 3);
    expect(p2.items).toEqual(["d", "e", "f"]);
    expect(p2.startIndex).toBe(4);
    expect(p2.endIndex).toBe(6);
    expect(p2.totalPages).toBe(3);

    const overflow = paginateItems(list, 99, 3);
    expect(overflow.page).toBe(3);
    expect(overflow.items).toEqual(["g"]);
  });

  it("distinguishes gateway outage errors from authorization errors", () => {
    expect(
      isBackupGatewayUnavailableError(
        new ControlPanelUnavailableError("Local gateway offline"),
      ),
    ).toBe(true);
    expect(
      isBackupGatewayUnavailableError(
        new BackupServiceError("Denied", { status: 403, gatewayUnavailable: false }),
      ),
    ).toBe(false);
  });
});

describe("BackupExportWorkspace", () => {
  it("shows gateway recovery card when gateway port 8322 is unreachable", async () => {
    mocks.controlPanelFetch.mockRejectedValueOnce(
      new ControlPanelUnavailableError(
        "Local eFlow gateway (port 8322) is offline. Run `npm run dev`.",
      ),
    );

    render(<BackupExportWorkspace />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Backup gateway route unavailable" }),
      ).toBeTruthy();
    });
    expect(screen.getByText(/Local eFlow gateway \(port 8322\) is offline/)).toBeTruthy();
  });

  it("paginates backup job history and supports Important Data Explorer & Database Tables staging", async () => {
    const jobs = Array.from({ length: 7 }, (_, idx) => makeJob(idx + 1));
    mocks.controlPanelFetch.mockImplementation(async (path: string) => {
      if (path === "admin/backups") {
        return new Response(JSON.stringify(makeOverview(jobs)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (path.startsWith("admin/backups/tables/projects/rows")) {
        return new Response(
          JSON.stringify({
            name: "projects",
            domain: "projects_work",
            domain_label: "Projects & Work",
            important: true,
            sensitive: false,
            columns: [
              {
                name: "id",
                type: "string",
                format: "uuid",
                is_date: false,
                is_text: false,
                is_uuid: true,
                is_bool: false,
                is_numeric: false,
                searchable: true,
                filterable: true,
                sortable: true,
                redacted: false,
              },
              {
                name: "title",
                type: "string",
                format: "text",
                is_date: false,
                is_text: true,
                is_uuid: false,
                is_bool: false,
                is_numeric: false,
                searchable: true,
                filterable: true,
                sortable: true,
                redacted: false,
              },
              {
                name: "status",
                type: "string",
                format: "text",
                is_date: false,
                is_text: true,
                is_uuid: false,
                is_bool: false,
                is_numeric: false,
                searchable: true,
                filterable: true,
                sortable: true,
                redacted: false,
              },
            ],
            rows: [
              {
                id: "proj-1",
                title: "Municipal Infrastructure Roadmap",
                status: "active",
              },
            ],
            total: 31,
            page: 1,
            page_size: 25,
            total_pages: 2,
            sort_by: "id",
            sort_dir: "asc",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (path.startsWith("admin/backups/tables/projects/export")) {
        return new Response("id,title,status\nproj-1,Municipal Infrastructure Roadmap,active\n", {
          status: 200,
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": 'attachment; filename="eflow-projects-filtered.csv"',
            "X-Export-Row-Count": "1",
            "X-Export-Total-Matching": "1",
            "X-Export-Truncated": "false",
          },
        });
      }
      if (path.startsWith("admin/backups/tables?")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                name: "petty_cash_requests",
                domain: "finance_budget",
                domain_label: "Budget & Accounting",
                important: true,
                sensitive: false,
                column_count: 14,
                has_date_column: true,
                row_count: 18,
                api_readable: true,
              },
            ],
            total: 1,
            page: 1,
            page_size: 15,
            total_pages: 1,
            domains: [
              { id: "finance_budget", label: "Budget & Accounting", description: "Budgets" },
            ],
            important_count: 5,
            total_discovered: 5,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("{}", { status: 404 });
    });

    const clickRadixTab = (tab: HTMLElement) => {
      fireEvent.mouseDown(tab, { button: 0 });
      fireEvent.click(tab);
    };

    render(<BackupExportWorkspace />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Create backup" })).toBeTruthy();
    });

    // Job history shows first 5 jobs on page 1 and paginates to page 2
    expect(screen.getByText("Showing 1–5 of 7 backups")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Showing 6–7 of 7 backups")).toBeTruthy();

    // Open Important Data Explorer tab and inspect/export rows
    clickRadixTab(screen.getByRole("tab", { name: "Important Data Explorer" }));
    await waitFor(() => {
      expect(screen.getByText("Municipal Infrastructure Roadmap")).toBeTruthy();
    });
    expect(screen.getByText("Showing 1–25 of 31 rows")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    await waitFor(() => {
      expect(mocks.controlPanelFetch).toHaveBeenCalledWith(
        expect.stringContaining("admin/backups/tables/projects/export"),
        {},
        expect.any(Object),
      );
    });

    // Open Database Tables tab, select petty_cash_requests, and stage custom dump
    clickRadixTab(screen.getByRole("tab", { name: /Database Tables/ }));
    await waitFor(() => {
      expect(screen.getByText("petty_cash_requests")).toBeTruthy();
    });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Select petty_cash_requests for custom DB dump",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Dump selected (1)" }));
    await waitFor(() => {
      expect(
        screen.getByText(/Select important presets or individual tables \(1\)/),
      ).toBeTruthy();
    });
  }, 20_000);
});
