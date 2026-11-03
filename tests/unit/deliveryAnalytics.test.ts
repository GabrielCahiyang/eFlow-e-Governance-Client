import { describe, expect, it } from "vitest";
import {
  deliveryRows,
  filterDeliveryRows,
  peopleDelivery,
  completionTrend,
  deadlineBucket,
} from "../../src/app/features/analytics/selectors/deliveryAnalytics";
import {
  EMPTY_ANALYTICS_FILTERS,
  type AnalyticsInput,
} from "../../src/app/features/analytics/types";
const hour = 3600000,
  now = Date.parse("2026-11-03T02:00:00Z"),
  start = now - 72 * hour;
function input(): AnalyticsInput {
  return {
    now,
    people: [
      { id: "lead", name: "Gabriel" },
      { id: "other", name: "Crisostomo" },
    ],
    projects: [{ id: "project", title: "Seminar", status: "active" }],
    tasks: [
      {
        id: "done",
        title: "Venue",
        status: "completed",
        assigneeId: "lead",
        teamMemberIds: ["lead", "other"],
        linkedProjectId: "project",
        deadline: "2026-11-01",
        createdAt: start,
        updatedAt: now,
      },
      {
        id: "late",
        title: "Equipment",
        status: "in_progress",
        assigneeId: "other",
        linkedProjectId: "project",
        deadline: "2026-11-02",
        dependencyIds: ["done", "hidden"],
        createdAt: start,
        updatedAt: now,
      },
      {
        id: "today",
        title: "Cleanup",
        status: "todo",
        assigneeId: "lead",
        linkedProjectId: "project",
        deadline: "2026-11-03",
        createdAt: start,
        updatedAt: now,
      },
    ] as any,
    facts: {
      subtasks: [],
      progress: [],
      evidence: [],
      statusHistory: [
        {
          id: "started",
          taskId: "done",
          toStatus: "in_progress",
          createdAt: start,
        },
      ],
      submissions: [
        {
          id: "s",
          taskId: "done",
          kind: "task",
          status: "approved",
          version: 1,
          submitterId: "lead",
          submitterName: "Gabriel",
          submittedAt: start + 12 * hour,
          decidedAt: start + 60 * hour,
        },
      ],
    },
  };
}
describe("source-backed delivery analytics", () => {
  it("separates working elapsed time from approval waiting and does not count contributors as the completing lead", () => {
    const data = input(),
      rows = deliveryRows(data),
      people = peopleDelivery(rows, data.people);
    expect(rows[0].turnaroundHours).toBe(12);
    expect(rows[0].reviewHours).toBe(48);
    expect(people[0]).toMatchObject({
      completed: 1,
      samples: 1,
      medianHours: 12,
    });
    expect(people[1]).toMatchObject({
      completed: 0,
      contributing: 1,
      samples: 0,
      medianHours: null,
    });
  });
  it("uses Manila end-of-day deadlines and flags hidden prerequisites without exposing a title", () => {
    const rows = deliveryRows(input());
    expect(rows[1]).toMatchObject({
      overdue: true,
      overdueDays: 1,
      missingPrerequisites: 1,
      prerequisites: [],
    });
    expect(deadlineBucket(rows[2], now)).toBe("today");
    expect(deadlineBucket(rows[0], now)).toBe("closed");
  });
  it("attributes on-time work to submission even if approval happens later", () => {
    const rows = deliveryRows(input());
    expect(rows[0].onTime).toBe(true);
    expect(rows[0].overdue).toBe(false);
  });
  it("does not invent a start or completion date from updated_at", () => {
    const data = input();
    data.facts.statusHistory = [];
    data.facts.submissions = [];
    const rows = deliveryRows(data);
    expect(rows[0].turnaroundHours).toBeNull();
    expect(rows[0].completedAt).toBeUndefined();
    expect(completionTrend(rows, now).reduce((n, w) => n + w.count, 0)).toBe(0);
  });
  it("counts approved parent tasks once, excluding cancelled or archived rows and separate subtasks", () => {
    const data = input();
    data.tasks.push(
      { ...data.tasks[0], id: "cancel", status: "cancelled" },
      { ...data.tasks[0], id: "archive", archivedAt: now },
    );
    data.facts.subtasks = [
      { id: "sub", taskId: "done", status: "completed" } as any,
    ];
    const rows = deliveryRows(data);
    expect(rows).toHaveLength(3);
    expect(completionTrend(rows, now).reduce((n, w) => n + w.count, 0)).toBe(1);
  });
  it("filters by project, person, status, overdue and deadline range together", () => {
    const rows = deliveryRows(input());
    expect(
      filterDeliveryRows(rows, {
        ...EMPTY_ANALYTICS_FILTERS,
        project: "project",
        person: "other",
        overdue: true,
        from: "2026-11-02",
        to: "2026-11-02",
      }).map((r) => r.task.id),
    ).toEqual(["late"]);
    expect(
      filterDeliveryRows(rows, {
        ...EMPTY_ANALYTICS_FILTERS,
        query: "Venue",
        status: "completed",
      }),
    ).toHaveLength(1);
  });
  it("shows latest blocker as Stuck without changing saved status and clears it with the latest update", () => {
    const data = input();
    data.facts.progress = [
      {
        id: "old",
        kind: "task",
        taskId: "late",
        authorName: "User",
        blocker: "Wait",
        blockerCategory: "Other",
        createdAt: start,
      },
      {
        id: "new",
        kind: "task",
        taskId: "late",
        authorName: "User",
        blocker: "",
        blockerCategory: "None",
        createdAt: now,
      },
    ];
    expect(deliveryRows(data)[1].state).toBe("in_progress");
  });
  it("does not show an overdue rate without dated submissions", () => {
    const data = input();
    expect(
      peopleDelivery(deliveryRows(data), data.people)[1].lateRate,
    ).toBeNull();
  });
});
