// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchOverview: vi.fn(),
  savePolicy: vi.fn(),
  previewPurge: vi.fn(),
  setHold: vi.fn(),
  executePurge: vi.fn(),
  runMaintenance: vi.fn(),
  fetchCert: vi.fn(),
}));

vi.mock("../../src/app/features/administration/retention/retentionService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/app/features/administration/retention/retentionService")>();
  return {
    ...actual,
    fetchRetentionOverview: mocks.fetchOverview,
    saveRetentionPolicy: mocks.savePolicy,
    fetchProjectPurgePreview: mocks.previewPurge,
    updateProjectLegalHold: mocks.setHold,
    executeProjectPurge: mocks.executePurge,
    runRetentionMaintenanceNow: mocks.runMaintenance,
    fetchDispositionCertificate: mocks.fetchCert,
  };
});

vi.mock("../../src/app/components/ui/Modal", () => ({
  Modal: ({ children, footer, title }: any) => (
    <div role="dialog" aria-label={title}>
      {children}
      {footer}
    </div>
  ),
}));

import { ArchiveRetentionMaintenance } from "../../src/app/features/administration/retention/ArchiveRetentionMaintenance";
import { resolveSupportPage, resolveSupportSubTab } from "../../src/app/features/navigation/administrativePages";

const sampleOverview = {
  policy: {
    project_auto_archive_days: 30,
    archive_retention_days: 1825,
    archive_retention_notice_days: 30,
    archive_retention_require_seal: true,
    archive_retention_auto_purge: false,
    archive_retention_public_mode: "keep_manifest_purge_files" as const,
  },
  archivedProjects: [
    {
      id: "proj-sealed",
      title: "Public Market Drainage Upgrade",
      orgId: "org-1",
      orgName: "LEDIPO",
      archivedAt: "2021-10-01T00:00:00Z",
      isSealed: true,
      latestCertificateId: "cert-1",
      latestSealVersion: 1,
      sealedAt: "2021-10-02T00:00:00Z",
      txHash: "0xabc123",
      blockNumber: 123456,
      manifestHash: "a".repeat(64),
      expiresAt: "2026-10-01T00:00:00Z",
      daysRemaining: -49,
      isExpired: true,
      legalHold: { active: false },
      status: "ready_for_purge" as const,
      taskCount: 8,
      receiptCount: 5,
      storageObjectCount: 12,
      storageBytes: 4_194_304,
    },
    {
      id: "proj-unsealed",
      title: "Unsealed Legacy Initiative",
      orgId: "org-1",
      orgName: "LEDIPO",
      archivedAt: "2021-01-01T00:00:00Z",
      isSealed: false,
      isExpired: false,
      legalHold: { active: false },
      status: "blocked_unsealed" as const,
      taskCount: 3,
      receiptCount: 2,
      storageObjectCount: 4,
      storageBytes: 512_000,
    },
  ],
  dispositions: [],
  storageQueue: { pending: 0, deleted: 0, failed: 0, bytesReclaimed: 0, bytesPending: 0 },
};

beforeEach(() => {
  mocks.fetchOverview.mockResolvedValue(sampleOverview);
  mocks.savePolicy.mockImplementation(async (p) => p);
  mocks.setHold.mockResolvedValue({ projectId: "proj-sealed", legalHold: true, saved: true });
  mocks.previewPurge.mockResolvedValue({
    projectId: "proj-sealed",
    projectTitle: "Public Market Drainage Upgrade",
    orgName: "LEDIPO",
    status: "archived",
    isSealed: true,
    legalHoldActive: false,
    expiresAt: "2026-10-01T00:00:00Z",
    isExpired: true,
    publicArchiveMode: "keep_manifest_purge_files",
    canPurgeNormally: true,
    canPurgeWithEarlyOverride: true,
    rowsToPurge: { tasks: 8, subtasks: 14, cashRequests: 4, liquidations: 4, receipts: 5, taskAttachments: 6, libraryFiles: 1, comments: 10, chatMessages: 22 },
    trailsPreserved: { auditEvents: 41, budgetLedgerEntries: 12, generalJournalEntries: 8, taskStatusHistory: 19, projectFieldHistory: 4, workTreeEvents: 9, projectLibraryEvents: 2, blockchainCertificates: 1 },
    storageSummary: { totalFiles: 12, totalBytes: 4_194_304, byBucket: [{ bucket: "budget-receipts", files: 5, bytes: 2_000_000 }] },
    fiscalRollup: [{ fiscalBudgetId: "fb-1", fiscalYear: 2021, budgetStatus: "closed", committedAmount: 150000, spentAmount: 145000 }],
  });
  mocks.executePurge.mockResolvedValue({ disposition: { dispositionId: "disp-1" }, storageDrain: { claimed: 12, deleted: 12, failed: 0 } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("resolves Archive & Retention admin navigation sub-tab cleanly", () => {
  expect(resolveSupportPage("administration", "Archive & Retention")).toBe("System & Maintenance");
  expect(resolveSupportSubTab("administration", "Archive & Retention")).toBe("retention");
});

it("renders retention policy presets, blocks purging unsealed archives, and saves updated policy", async () => {
  render(<ArchiveRetentionMaintenance embedded />);
  expect(await screen.findByText("Public Market Drainage Upgrade")).toBeVisible();
  expect(screen.getByText("Unsealed Legacy Initiative")).toBeVisible();

  // Unsealed project's Preview Purge button is disabled
  const unsealedRow = screen.getByText("Unsealed Legacy Initiative").closest("tr")!;
  expect(within(unsealedRow).getByRole("button", { name: /Preview Purge/ })).toBeDisabled();

  // Clicking 10-year COA preset enables Save Retention Policy
  fireEvent.click(screen.getByRole("button", { name: "10 years (COA financial)" }));
  const saveBtn = screen.getByRole("button", { name: "Save Retention Policy" });
  expect(saveBtn).toBeEnabled();
  fireEvent.click(saveBtn);
  await waitFor(() =>
    expect(mocks.savePolicy).toHaveBeenCalledWith(
      expect.objectContaining({ archive_retention_days: 3650 }),
    ),
  );
});

it("opens dry-run purge preview, shows preserved trails, and requires exact title confirmation", async () => {
  render(<ArchiveRetentionMaintenance embedded />);
  const sealedRow = (await screen.findByText("Public Market Drainage Upgrade")).closest("tr")!;
  fireEvent.click(within(sealedRow).getByRole("button", { name: /Review & Purge/ }));

  const dialog = await screen.findByRole("dialog", { name: /Purge Archived Project/ });
  expect(await within(dialog).findByText("Preserved Permanently (Never Purged)")).toBeVisible();
  expect(within(dialog).getByText(/FY 2021/)).toBeVisible();

  const confirmBtn = within(dialog).getByRole("button", { name: /Permanently Purge Project/ });
  expect(confirmBtn).toBeDisabled();

  fireEvent.change(within(dialog).getByPlaceholderText("Public Market Drainage Upgrade"), {
    target: { value: "Public Market Drainage Upgrade" },
  });
  fireEvent.change(within(dialog).getByLabelText(/Disposition reason/), {
    target: { value: "Retention expired per COA schedule" },
  });
  expect(confirmBtn).toBeEnabled();

  fireEvent.click(confirmBtn);
  await waitFor(() =>
    expect(mocks.executePurge).toHaveBeenCalledWith(
      "proj-sealed",
      expect.objectContaining({
        confirm_title: "Public Market Drainage Upgrade",
        reason: "Retention expired per COA schedule",
        early_override: false,
      }),
    ),
  );
});
