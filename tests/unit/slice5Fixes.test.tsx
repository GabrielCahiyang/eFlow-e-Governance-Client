// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.hoisted(() => vi.fn());
const sealMocks = vi.hoisted(() => ({
  loadSealStatus: vi.fn(),
  loadSealConfiguration: vi.fn(),
}));
const authState = vi.hoisted(() => ({
  user: { id: "head-1" },
  userProfile: { id: "head-1", role: "head" as string, org_id: "office-1", full_name: "Alex Head" },
}));

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    rpc: rpcMock,
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
    storage: { from: vi.fn() },
  },
}));

vi.mock("../../src/app/features/tasks/services/leadershipReviewReadinessService", () => ({
  assertLeadershipReviewReady: vi.fn().mockResolvedValue(undefined),
  assertTaskSubtasksReady: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/app/features/tasks/services/taskRealtimeService", () => ({
  notifyTaskListeners: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/app/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("../../src/app/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("../../src/app/features/staffing", () => ({
  AutoAssignTaskButton: () => null,
}));

vi.mock("../../src/app/features/project-publication/services/publicationService", () => ({
  loadSealStatus: sealMocks.loadSealStatus,
  loadSealConfiguration: sealMocks.loadSealConfiguration,
  prepareSeal: vi.fn(),
  loadSealPreview: vi.fn(),
  approveSeal: vi.fn(),
  discardSeal: vi.fn(),
  retrySeal: vi.fn(),
  downloadPreviewFile: vi.fn(),
  replacePublicationFile: vi.fn(),
}));

import { submitTaskForReview } from "../../src/app/features/tasks/services/taskReviewLifecycleService";
import { WorkStaffingDialog } from "../../src/app/features/nested-work/components/WorkStaffingDialog";
import { ProjectSealDialog } from "../../src/app/features/project-publication/components/ProjectSealDialog";
import type { WorkTreeSnapshot } from "../../src/app/features/nested-work/types";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Slice 5 QA fixes (#14 self-lead reviewer & #15 seal service messages)", () => {
  it("explains self-review conflict clearly when submit_task_for_review reports missing eligible reviewer (#14)", async () => {
    rpcMock.mockResolvedValueOnce({
      error: { message: "Assign an eligible reviewer before submitting" },
    });

    await expect(
      submitTaskForReview("task-1", { note: "Ready for review", attachments: [] }),
    ).rejects.toThrow(/No independent reviewer is available because the task lead is also the Office Head or Project Lead/i);
  });

  it("warns Office Head in WorkStaffingDialog when assigned as task lead on an office task (#14)", () => {
    const snapshot: WorkTreeSnapshot = {
      root: {
        id: "task-1",
        project: "proj-1",
        office: "office-1",
        lead: "head-1",
        kind: "office",
        open: true,
        due: null,
        people: ["head-1"],
      },
      revision: 1,
      can_manage: true,
      can_transfer: true,
      nodes: [],
      people: [{ id: "head-1", name: "Alex Head", office: "office-1", eligible: true }],
      leaf_total: 0,
      leaf_completed: 0,
    };

    render(
      <WorkStaffingDialog
        controller={{
          rootId: "task-1",
          actorId: "head-1",
          data: snapshot,
          loading: false,
          save: vi.fn().mockResolvedValue(snapshot),
        }}
        nodeId={null}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        /assigning yourself as both Office Head and Task Lead means you cannot review your own task submission/i,
      ),
    ).toBeTruthy();
  });

  it("shows :8321 host offline guidance in ProjectSealDialog when worker host is unreachable (#15)", async () => {
    sealMocks.loadSealStatus.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:8321"));
    sealMocks.loadSealConfiguration.mockResolvedValueOnce({
      worker_enabled: false,
      chain_id: null,
      contract_address: null,
      explorer_tx_prefix: null,
      ipfs_gateway_prefix: null,
      allowed_mime_types: [],
    });

    render(<ProjectSealDialog projectId="proj-1" title="Sample Project" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/8321/)).toBeTruthy();
    });
    expect(
      screen.getByText(/blockchain publication worker service is offline or not enabled on this host/i),
    ).toBeTruthy();
  });
});
