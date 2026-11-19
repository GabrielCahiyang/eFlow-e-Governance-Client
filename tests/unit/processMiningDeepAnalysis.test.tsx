// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalyticsProject } from "../../src/app/features/analytics";
import type { ProcessMiningProgress, ProcessMiningReport } from "../../src/app/features/process-mining";

const mockRunAnalysis = vi.hoisted(() => vi.fn());
const mockFetchSavedSnapshot = vi.hoisted(() => vi.fn());
const mockSaveSnapshot = vi.hoisted(() => vi.fn());

vi.mock("../../src/app/features/process-mining/services/processMiningService", () => ({
  buildProcessMiningScopeKey: vi.fn(
    (filters: { projectId: string; includeCompleted: boolean; fromDate: string; toDate: string }) =>
      `project=${filters.projectId || "all"}|completed=${filters.includeCompleted ? "1" : "0"}|from=${filters.fromDate || ""}|to=${filters.toDate || ""}`,
  ),
  fetchSavedProcessMiningSnapshot: mockFetchSavedSnapshot,
  saveProcessMiningSnapshot: mockSaveSnapshot,
  startProcessMiningJob: vi.fn(),
  getProcessMiningJob: vi.fn(),
  cancelProcessMiningJob: vi.fn(),
  runProcessMiningAnalysis: mockRunAnalysis,
}));

import { DeepAnalysisPanel } from "../../src/app/features/process-mining";

const projects: AnalyticsProject[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Community Digital Literacy Workshop 2026",
    status: "active",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Community Esports",
    status: "completed",
  },
];

const sampleReport: ProcessMiningReport = {
  scope: { includeCompleted: true },
  summary: {
    projectsAnalyzed: 2,
    totalEvents: 18,
    totalTasks: 4,
    totalCashRequests: 1,
    variantCount: 2,
    bottleneckCount: 1,
    reworkLoops: 3,
    deviationCount: 1,
    conformanceRate: 86.5,
    avgProjectCycleDays: 9.2,
    longestWaitStage: {
      stage: "Work Review & Approval",
      label: "5 days",
      medianHours: 120,
      maxHours: 120,
      meanHours: 120,
    },
    generatedAt: "2026-11-19T00:00:00Z",
  },
  dfg: {
    nodes: [
      {
        id: "Planning & Setup",
        label: "Planning & Setup",
        stage: "Planning & Setup",
        eventCount: 4,
        projectCount: 2,
        reworkCount: 0,
        medianWaitHours: 12,
        maxWaitHours: 24,
        activeWaitingCount: 0,
        isBottleneck: false,
      },
      {
        id: "Work Review & Approval",
        label: "Work Review & Approval",
        stage: "Work Review & Approval",
        eventCount: 8,
        projectCount: 2,
        reworkCount: 3,
        medianWaitHours: 120,
        maxWaitHours: 120,
        activeWaitingCount: 1,
        isBottleneck: true,
      },
    ],
    edges: [
      {
        id: "Planning & Setup->Work Review & Approval",
        source: "Planning & Setup",
        target: "Work Review & Approval",
        count: 2,
        projectCount: 2,
        medianHours: 24,
        meanHours: 24,
        p90Hours: 24,
        maxHours: 24,
        kind: "bottleneck",
      },
    ],
    activityEdges: [
      {
        fromActivity: "Submitted for Review",
        toActivity: "Review Sent Back for Fixes",
        stageFrom: "Work Review & Approval",
        stageTo: "Work Review & Approval",
        count: 3,
        medianHours: 120,
        p90Hours: 120,
        maxHours: 120,
        isRework: true,
        isBottleneck: true,
      },
    ],
  },
  stageBreakdown: [
    {
      stage: "Work Review & Approval",
      eventCount: 8,
      projectCount: 2,
      transitionSamples: 3,
      activeWaitingCount: 1,
      medianWaitHours: 120,
      meanWaitHours: 120,
      p90WaitHours: 120,
      maxWaitHours: 120,
      totalWaitHours: 360,
      reworkCount: 3,
      isBottleneck: true,
    },
  ],
  variants: [
    {
      variantId: "V1",
      stages: ["Planning & Setup", "Work Review & Approval (Sent back)"],
      projectCount: 1,
      sharePercent: 50,
      avgCycleDays: 10,
      medianCycleDays: 10,
      reworkProjectCount: 1,
      projects: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          title: "Community Digital Literacy Workshop 2026",
          status: "active",
          reworkLoops: 3,
          conformanceRate: 78,
        },
      ],
    },
  ],
  projects: [
    {
      projectId: "11111111-1111-4111-8111-111111111111",
      title: "Community Digital Literacy Workshop 2026",
      status: "active",
      eventCount: 14,
      taskCount: 3,
      completedTasks: 2,
      budgetAllocated: 150000,
      cashSpent: 45000,
      cycleDays: 10,
      reworkLoops: 3,
      deviationCount: 1,
      conformanceRate: 78,
      topBottleneckStage: "Work Review & Approval",
      longestWaitHours: 120,
      variantId: "V1",
      tracePreview: ["Planning & Setup", "Work Review & Approval"],
    },
  ],
  reworkAndDeviations: [
    {
      id: "rw-1",
      category: "rework",
      kind: "task_review_rework",
      severity: "high",
      title: "Sent back during review: 'Prepare venue & budget'",
      description: "2 submission attempt(s) (1 returned for changes).",
      projectId: "11111111-1111-4111-8111-111111111111",
      projectTitle: "Community Digital Literacy Workshop 2026",
      taskId: "t-1",
      taskTitle: "Prepare venue & budget",
      entityType: "task",
      entityId: "t-1",
      count: 2,
    },
  ],
  recommendations: [
    {
      id: "rec-1",
      priority: "high",
      stage: "Work Review & Approval",
      title: "Slowest stage: Work Review & Approval",
      finding: "Work typically waited 5 days across 3 completed step(s).",
      recommendation: "Set reviewer turnaround reminders and pre-submission checklists.",
      metricLabel: "Typical wait",
      metricValue: "5 days",
      affectedProjects: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          title: "Community Digital Literacy Workshop 2026",
        },
      ],
      affectedTaskIds: ["t-1"],
      affectedTasks: [{ id: "t-1", title: "Prepare venue & budget" }],
    },
  ],
  recentEvents: [
    {
      id: "ev-1",
      projectId: "11111111-1111-4111-8111-111111111111",
      projectTitle: "Community Digital Literacy Workshop 2026",
      activity: "Review Sent Back for Fixes",
      stage: "Work Review & Approval",
      timestamp: 1792454400000,
      isoTime: "2026-10-20T00:00:00Z",
      actorName: "Cheryl Gallo",
      entityType: "task",
      entityId: "t-1",
      taskId: "t-1",
      taskTitle: "Prepare venue & budget",
      outcome: "changes_requested",
      isRework: true,
      isDeviation: false,
      detail: "Attach signed attendance sheet",
    },
  ],
};

describe("DeepAnalysisPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockFetchSavedSnapshot.mockResolvedValue(null);
    mockSaveSnapshot.mockResolvedValue(null);
  });
  afterEach(cleanup);

  it("shows live step-by-step server progress loader and renders plain-language tabbed results", async () => {
    let resolveRun!: (value: ProcessMiningReport) => void;
    mockRunAnalysis.mockImplementation((_filters, opts: { onProgress?: (p: ProcessMiningProgress) => void }) => {
      opts.onProgress?.({
        stage: "extracting_logs",
        message: "Collecting status histories, review submissions, and budget requests…",
        current: 2,
        total: 4,
        history: [
          { stage: "loading_scope", message: "Verifying Office scope and loading permitted projects…" },
          { stage: "extracting_logs", message: "Collecting status histories, review submissions, and budget requests…" },
        ],
      });
      return new Promise<ProcessMiningReport>((resolve) => {
        resolveRun = resolve;
      });
    });

    const onOpenProject = vi.fn();
    const onOpenTaskId = vi.fn();
    render(
      <DeepAnalysisPanel
        projects={projects}
        cacheScopeKey="test-org-1"
        onOpenProject={onOpenProject}
        onOpenTaskId={onOpenTaskId}
      />,
    );

    expect(screen.getByRole("status", { name: "Running Deep Process Analysis" })).toBeTruthy();
    expect(screen.getByText("Verifying Office scope and loading permitted projects…")).toBeTruthy();
    expect(
      screen.getByText(/Collecting status histories, review submissions, and budget requests… \(2\/4\)/),
    ).toBeTruthy();

    resolveRun(sampleReport);

    await waitFor(() => {
      expect(screen.getByLabelText("Process mining summary")).toBeTruthy();
    });

    expect(screen.getByText("86.5%")).toBeTruthy();
    expect(screen.getByText("Sent back for fixes")).toBeTruthy();
    expect(screen.getByText("Slowest stage: Work Review & Approval")).toBeTruthy();

    // Direct named task link on recommendation
    fireEvent.click(screen.getByRole("button", { name: "Open: Prepare venue & budget" }));
    expect(onOpenTaskId).toHaveBeenCalledWith("t-1");

    // Default breakdown tab shows Projects
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(onOpenProject).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");

    // Switch sub-tab to Sent back & alerts
    fireEvent.click(screen.getByRole("tab", { name: /Sent back & alerts/i }));
    expect(screen.getByText("Sent back during review: 'Prepare venue & budget'")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open task: Prepare venue & budget" }));
    expect(onOpenTaskId).toHaveBeenCalledWith("t-1");

    // Switch sub-tab to Workflow paths
    fireEvent.click(screen.getByRole("tab", { name: /Workflow paths/i }));
    expect(screen.getByText("Work Review & Approval (Sent back)")).toBeTruthy();

    // Right-click a stage box to inspect its recorded actions modal
    const graphArea = screen.getByLabelText("Discovered workflow graph");
    fireEvent.contextMenu(within(graphArea).getByText("Work Review & Approval"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("list", { name: "Stage action details" })).toBeTruthy();
    expect(within(dialog).getByText("Review Sent Back for Fixes")).toBeTruthy();
    expect(within(dialog).getByText("Attach signed attendance sheet")).toBeTruthy();
  });

  it("falls back to database snapshot with full date and time when live server is offline", async () => {
    mockFetchSavedSnapshot.mockResolvedValueOnce({
      report: sampleReport,
      savedAt: "2026-11-18T21:45:00Z", // Nov 19, 2026, 5:45 AM in Asia/Manila
      savedByName: "Cheryl Gallo",
    });
    mockRunAnalysis.mockRejectedValueOnce(
      new Error("The Process Mining analysis service (:8321) is offline."),
    );

    render(
      <DeepAnalysisPanel
        projects={projects}
        cacheScopeKey="test-org-db"
        orgId="org-ledipo"
        userId="head-1"
        userName="Cheryl Gallo"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Saved report · May be outdated\./)).toBeTruthy();
    });
    expect(
      screen.getByText(/Last saved update: Nov 19, 2026, 5:45 AM \(by Cheryl Gallo\)/),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry live analysis" })).toBeTruthy();
    expect(screen.getByText("86.5%")).toBeTruthy();
  });

  it("shows saved snapshot with clear offline notice when server is unreachable after a prior run", async () => {
    mockRunAnalysis
      .mockResolvedValueOnce(sampleReport)
      .mockRejectedValueOnce(new Error("The Process Mining analysis service (:8321) is offline."));

    const { unmount } = render(
      <DeepAnalysisPanel projects={projects} cacheScopeKey="test-org-cached" />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Process mining summary")).toBeTruthy();
    });
    unmount();

    render(
      <DeepAnalysisPanel projects={projects} cacheScopeKey="test-org-cached" />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Saved report · May be outdated\./)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Retry live analysis" })).toBeTruthy();
    expect(screen.getByText("86.5%")).toBeTruthy();
  });

  it("surfaces offline error with Retry when no saved report exists for the selected scope", async () => {
    mockRunAnalysis
      .mockResolvedValueOnce(sampleReport)
      .mockRejectedValueOnce(new Error("The Process Mining analysis service (:8321) is offline."));

    render(<DeepAnalysisPanel projects={projects} cacheScopeKey="test-org-2" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Process mining summary")).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText("Analysis project scope"), {
      target: { value: "11111111-1111-4111-8111-111111111111" },
    });

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(":8321");
    });

    expect(mockRunAnalysis).toHaveBeenLastCalledWith(
      expect.objectContaining({ projectId: "11111111-1111-4111-8111-111111111111" }),
      expect.any(Object),
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});
