import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  matchesWorkDate,
  workDateLabel,
  workDay,
} from "../../src/app/shared/workCalendar";
import {
  selectWorkRows,
  workspaceSummary,
} from "../../src/app/features/personal-work/workSelectors";
import type {
  WorkRow,
  WorkSnapshot,
} from "../../src/app/features/personal-work/types";
import { readWorkFilters } from "../../src/app/features/personal-work/workLocation";
const api = vi.hoisted(() => ({
  range: vi.fn(),
  calls: [] as unknown[][],
  list: vi.fn(),
  select: vi.fn(),
  personal: vi.fn(),
  roots: vi.fn(),
  tree: vi.fn(),
}));
vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      const chain: any = {};
      for (const method of ["select", "order", "is"])
        chain[method] = (...args: unknown[]) => {
          api.calls.push([table, method, ...args]);
          return chain;
        };
      chain.range = (first: number, last: number) =>
        api.range(table, first, last);
      return chain;
    },
  },
}));
vi.mock("../../src/app/features/nested-work", async () => ({
  ...await import("../../src/app/features/nested-work/selectors/workDisplayContext"),
  fetchOfficeWorkRoots: api.roots,
  fetchWorkTree: api.tree,
  WorkTreeUnavailable: class extends Error {},
}));
vi.mock("../../src/app/features/workspaces", () => ({
  listWorkspaces: api.list,
  selectWorkspace: api.select,
  fetchPersonalProject: api.personal,
  WorkspaceApiUnavailable: class extends Error {},
}));
import {
  loadWorkFeed,
  readWorkTable,
} from "../../src/app/features/personal-work/services/workFeedService";
const office = {
  id: "office",
  office_id: "org",
  name: "Planning Office",
  kind: "office" as const,
  owner_id: null,
  state: "active" as const,
  timezone: "Asia/Singapore",
};
const privateWorkspace = {
  ...office,
  id: "private",
  office_id: null,
  owner_id: "me",
  name: "Private research",
  kind: "personal" as const,
  timezone: "America/New_York",
};
const now = new Date("2026-10-08T16:30:00Z");
const row = (id: string, patch: Partial<WorkRow> = {}): WorkRow => ({
  id,
  key: id,
  rootId: "root",
  title: id,
  kind: "office-task",
  projectTitle: "Plan",
  workspaceId: "office",
  workspaceName: "Planning Office",
  timezone: "Asia/Singapore",
  status: "todo",
  progress: 0,
  mine: true,
  leading: true,
  actionable: true,
  history: false,
  relation: "Task Lead",
  ...patch,
});
const snapshot = (rows: WorkRow[]): WorkSnapshot => ({
  rows,
  projects: [],
  workspaces: [],
  issues: [],
  unavailable: [],
  loadedAt: 0,
});
beforeEach(() => {
  vi.resetAllMocks();
  api.calls = [];
  api.range.mockResolvedValue({ data: [], error: null });
  api.roots.mockResolvedValue([]);
  api.list.mockResolvedValue([office]);
  api.select.mockResolvedValue({ workspace: office, projects: [] });
});
describe("R10 workspace calendars and discovery", () => {
  it("retains old date and recent bucket bookmarks while explicit filters override them", () => {
    expect(readWorkFilters("?page=Due%20today").date).toBe("Today");
    expect(readWorkFilters("?page=Due%20this%20week").date).toBe("This week");
    expect(readWorkFilters("?page=Recently%20completed").recent).toBe(true);
    expect(readWorkFilters("?page=Recently%20completed&recent=0").recent).toBe(
      false,
    );
    expect(readWorkFilters("?page=Due%20today&date=All%20my%20work").date).toBe(
      "All my work",
    );
  });
  it("keeps date-only deadlines stable and converts timestamps at workspace midnight", () => {
    expect(workDay("2026-10-09", "America/New_York")).toBe(
      workDay("2026-10-09", "Asia/Singapore"),
    );
    expect(matchesWorkDate("2026-10-09", "Today", now, "Asia/Singapore")).toBe(
      true,
    );
    expect(
      matchesWorkDate("2026-10-09", "Today", now, "America/New_York"),
    ).toBe(false);
    expect(workDateLabel("2026-10-08T23:30:00Z", "Asia/Singapore")).toBe(
      "9 Oct 2026",
    );
    expect(workDay("2026-02-30")).toBeNull();
    expect(workDay("bad")).toBeNull();
    expect(workDay(now, "Invalid/Zone")).toBeNull();
  });
  it("uses Monday–Sunday across DST without counting undated work as overdue", () => {
    const dst = new Date("2026-11-01T06:30:00Z");
    expect(
      matchesWorkDate("2026-10-26", "This week", dst, "America/New_York"),
    ).toBe(true);
    expect(
      matchesWorkDate("2026-11-02", "This week", dst, "America/New_York"),
    ).toBe(false);
    expect(matchesWorkDate(null, "Overdue", dst, "America/New_York")).toBe(
      false,
    );
  });
  it("separates roots, descendants, effective leads and permitted history", () => {
    const rows = [
      row("lead"),
      row("contributor", { leading: false }),
      row("recommended", { leading: false, relation: "Recommended lead" }),
      row("child", { kind: "office-node" }),
      row("closed", {
        history: true,
        status: "completed",
        updatedAt: now.getTime(),
      }),
      row("ended", { actionable: false }),
      row("other", { mine: false }),
    ];
    expect(
      selectWorkRows(rows, "Assigned work", "All my work").map((r) => r.id),
    ).toEqual(["contributor", "lead", "recommended"]);
    expect(
      selectWorkRows(rows, "Leading", "All my work").map((r) => r.id),
    ).toEqual(["child", "lead"]);
    expect(
      selectWorkRows(rows, "Subtasks", "All my work").map((r) => r.id),
    ).toEqual(["child"]);
    expect(
      selectWorkRows(rows, "History", "All my work", "", "", true, now).map(
        (r) => r.id,
      ),
    ).toEqual(["closed"]);
    expect(
      selectWorkRows(
        [
          row("personal-done", {
            kind: "personal-task",
            history: true,
            status: "completed",
          }),
        ],
        "History",
        "All my work",
        "",
        "",
        true,
        now,
      ),
    ).toEqual([]);
  });
  it("searches context and scopes totals without widening personal assignments", () => {
    const rows = [
      row("mine", { due: "2026-10-08" }),
      row("private", { workspaceId: "private", projectTitle: "Research" }),
      row("unassigned", {
        mine: false,
        relation: "Needs reassignment",
        status: "for_review",
      }),
      row("archived", { history: true }),
    ];
    expect(
      selectWorkRows(
        rows,
        "Assigned work",
        "All my work",
        "research",
        "private",
      ).map((r) => r.id),
    ).toEqual(["private"]);
    const totals = workspaceSummary(snapshot(rows), now);
    expect(totals.active).toHaveLength(3);
    expect(totals.overdue).toHaveLength(1);
    expect(totals.unassigned).toHaveLength(1);
    expect(totals.review).toHaveLength(1);
  });
});
describe("R10 source coverage and authorization refresh", () => {
  it('NW9.2 discovers Lead-only depth-eight work with searchable authorized context and independent dates', async () => {
    api.roots.mockResolvedValue([{id:'root',title:'Task',orgId:'org',linkedProjectId:'project',assigneeId:'other',status:'todo'}]);
    const nodes=Array.from({length:8},(_,index)=>({id:`level-${index+1}`,task_id:'root',title:index===3?'Permitted ancestor':'Same',
      parent_subtask_id:index?`level-${index}`:null,sibling_order:0,depth:index+1,lead_id:index===7?'me':'other',
      assigned_to_ids:['other','other'],status:'todo',due_date:index===7?'2026-10-21':'2026-10-20',percent_complete:10}));
    api.tree.mockResolvedValue({root:{id:'root',open:true},people:[{id:'me',name:'Appointed Lead',eligible:true},{id:'other',name:'Contributor',eligible:true}],nodes});
    const data=await loadWorkFeed('me');
    const mine=selectWorkRows(data.rows,'Subtasks','All my work');
    expect(mine.map(row=>row.id)).toEqual(['level-8']);
    expect(selectWorkRows(data.rows,'Leading','All my work').map(row=>row.id)).toEqual(['level-8']);
    expect(selectWorkRows(data.rows,'Assigned work','All my work')).toEqual([]);
    expect(mine[0]).toMatchObject({due:'2026-10-21',leading:true,mine:true,subtask:undefined,
      workContext:{nodeId:'level-8',parentId:'level-7',leadId:'me',leadName:'Appointed Lead',dueDate:'2026-10-21',contributors:[{id:'other',name:'Contributor'}]}});
    expect(mine[0].workContext?.path.map(part=>part.id)).toEqual(['root',...nodes.map(node=>node.id)]);
    expect(selectWorkRows(data.rows,'Subtasks','All my work','permitted ancestor').map(row=>row.id)).toEqual(['level-8']);
    expect(selectWorkRows(data.rows,'Subtasks','All my work',mine[0].workContext!.pathLabel)).toEqual(mine);
    expect(nodes[7].assigned_to_ids).toEqual(['other','other']);
    expect(data.rows.find(row=>row.id==='root')?.mine).toBe(false);
  });
  it('NW9.2 merges only the existing authorized Subtask and never borrows foreign history or fabricates fields', async () => {
    api.roots.mockResolvedValue([{id:'root',title:'Task',orgId:'org',linkedProjectId:'project',assigneeId:'other',status:'todo'}]);
    const raw={id:'deep',task_id:'root',title:'Recorded',assigned_to:'worker',assigned_to_ids:['worker'],lead_id:'me',status:'todo',
      created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-02T00:00:00Z',created_by:'original-author',reviewer_id:'original-reviewer',source:'template',position:1};
    api.range.mockImplementation(async(table:string)=>({data:table==='subtasks'?[raw]:[],error:null}));
    api.tree.mockResolvedValue({root:{id:'root',open:true},people:[{id:'me',name:'Lead',eligible:true}],nodes:[{
      id:'deep',task_id:'root',title:'Current title',parent_subtask_id:'denied',sibling_order:1,lead_id:'me',assigned_to_ids:['worker'],due_date:null,status:'todo',percent_complete:0},
      {id:'denied',task_id:'foreign',title:'SECRET sibling',parent_subtask_id:null,sibling_order:0,lead_id:'other',assigned_to_ids:[],due_date:null,status:'todo',percent_complete:0}]});
    const data=await loadWorkFeed('me'),row=data.rows.find(row=>row.id==='deep')!;
    expect(row.subtask).toMatchObject({createdBy:'original-author',reviewerId:'original-reviewer',source:'template',assignedTo:'worker',assignedToIds:['worker'],
      createdAt:Date.parse(raw.created_at),updatedAt:Date.parse(raw.updated_at)});
    expect(row.workContext).toMatchObject({parentId:'denied',context:'missing_parent',pathLabel:'Parent context unavailable / Current title'});
    expect(row.subtask?.workContext).toEqual(row.workContext);
    expect(data.rows.some(row=>row.id==='denied')).toBe(false);
    expect(JSON.stringify(data.rows.map(row=>row.workContext))).not.toContain('SECRET sibling');
    api.range.mockImplementation(async(table:string)=>({data:table==='subtasks'?[{...raw,task_id:'foreign'}]:[],error:null}));
    const foreign=(await loadWorkFeed('me')).rows.find(row=>row.id==='deep');
    expect(foreign?.subtask).toBeUndefined();expect(foreign?.updatedAt).toBeUndefined();
  });
  it('NW9.2 includes personal Lead-only and contributor items without promoting their root or unrelated siblings', async () => {
    api.select.mockResolvedValue({projects:[{id:'personal',kind:'personal',title:'Research',status:'active',home_workspace_id:'private'}]});
    api.personal.mockResolvedValue({owner:'other',project:{id:'personal',workspace_id:'private',status:'active'},
      members:[{user_id:'me',name:'Personal Lead',eligible:true,state:'active'}],
      tasks:[{id:'personal-root',title:'Private task',lead_id:'other',status:'todo',progress:0}]});
    const nodes=Array.from({length:8},(_,index)=>({id:`private-${index+1}`,task_id:'personal-root',title:'Same',parent_subtask_id:index?`private-${index}`:null,
      sibling_order:0,depth:index+1,lead_id:index===7?'me':'other',assigned_to_ids:['other'],status:'todo',due_date:'2026-10-22',percent_complete:10}));
    nodes.push({...nodes[0],id:'assigned',parent_subtask_id:'private-7',lead_id:'other',assigned_to_ids:['me'],sibling_order:1});
    api.tree.mockResolvedValue({root:{id:'personal-root',open:true},people:[{id:'me',name:'Personal Lead',eligible:true},{id:'other',name:'Other member',eligible:true}],nodes});
    const data=await loadWorkFeed('me',{workspace:privateWorkspace});
    expect(selectWorkRows(data.rows,'Subtasks','All my work').map(row=>row.id)).toEqual(['assigned','private-8']);
    expect(selectWorkRows(data.rows,'Leading','All my work').map(row=>row.id)).toEqual(['private-8']);
    expect(selectWorkRows(data.rows,'Assigned work','All my work')).toEqual([]);
    expect(data.rows.find(row=>row.id==='private-8')?.workContext?.path).toHaveLength(9);
    api.tree.mockRejectedValue(new Error('Personal access revoked'));
    const denied=await loadWorkFeed('me',{workspace:privateWorkspace});
    expect(denied.rows).toEqual([]);expect(denied.issues.join()).toContain('Personal access revoked');
    expect(api.range).not.toHaveBeenCalled();
  });
  it("pages in stable ID order and rejects later-page failures rather than publishing a truncated total", async () => {
    api.range
      .mockResolvedValueOnce({
        data: Array.from({ length: 500 }, (_, id) => ({ id })),
        error: null,
      })
      .mockResolvedValueOnce({ data: [{ id: 500 }], error: null });
    expect(await readWorkTable("tasks")).toHaveLength(501);
    expect(api.range).toHaveBeenLastCalledWith("tasks", 500, 999);
    expect(api.calls).toContainEqual([
      "tasks",
      "order",
      "id",
      { ascending: true },
    ]);
    expect(api.calls).toContainEqual(["tasks", "is", "deleted_at", null]);
    api.range
      .mockResolvedValueOnce({ data: Array(500).fill({}), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "Page denied" } });
    await expect(readWorkTable("tasks")).rejects.toThrow("Page denied");
  });
  it("makes the safety ceiling and invalid source response explicit", async () => {
    api.range.mockResolvedValue({ data: Array(500).fill({}), error: null });
    await expect(readWorkTable("projects")).rejects.toThrow("20,000");
    api.range.mockResolvedValue({ data: null, error: null });
    await expect(readWorkTable("projects")).rejects.toThrow(
      "Invalid projects response",
    );
  });
  it("loads only authorized personal content for personal Overview and omits Office shortcuts", async () => {
    api.select.mockResolvedValue({
      projects: [
        {
          id: "personal",
          kind: "personal",
          title: "Research",
          status: "active",
          home_workspace_id: "private",
        },
        { id: "office-link", kind: "office", shortcut: true },
      ],
    });
    api.personal.mockResolvedValue({
      owner: "me",
      project: { id: "personal", workspace_id: "private", status: "active" },
      tasks: [],
      members: [],
    });
    const result = await loadWorkFeed("me", {
      workspace: privateWorkspace,
      projectIds: ["personal"],
    });
    expect(api.range).not.toHaveBeenCalled();
    expect(api.roots).not.toHaveBeenCalled();
    expect(api.list).not.toHaveBeenCalled();
    expect(result.projects.map((p) => p.id)).toEqual(["personal"]);
    expect(result.issues).toEqual([]);
  });
  it("discovers assigned depth-eight descendants without promoting their root to Assigned work", async () => {
    const task = {
      id: "root",
      title: "Office root",
      org_id: "org",
      linked_project_id: "project",
      assigned_to: "other",
      status: "todo",
    };
    api.roots.mockResolvedValue(
      [task].map((t) => ({
        ...t,
        id: t.id,
        title: t.title,
        orgId: "org",
        linkedProjectId: "project",
        assigneeId: "other",
        status: "todo",
      })),
    );
    api.tree.mockResolvedValue({
      root: { id: "root", open: true },
      people: [{ id: "me", eligible: true }],
      nodes: [
        {
          id: "deep",
          task_id: "root",
          parent_subtask_id: null,
          sibling_order: 0,
          title: "Deep work",
          depth: 8,
          lead_id: "me",
          assigned_to_ids: ["me"],
          status: "todo",
          due_date: "2026-10-09",
        },
      ],
    });
    const data = await loadWorkFeed("me");
    expect(selectWorkRows(data.rows, "Assigned work", "All my work")).toEqual(
      [],
    );
    expect(
      selectWorkRows(data.rows, "Subtasks", "All my work")[0],
    ).toMatchObject({
      id: "deep",
      rootTitle: "Office root",
      node: { depth: 8 },
    });
    api.tree.mockRejectedValue(new Error("Current access denied"));
    const denied = await loadWorkFeed("me");
    expect(denied.rows).toEqual([]);
    expect(denied.issues.join()).toContain("Current access denied");
  });
  it("excludes ended assignments from active feeds but retains still-authorized closed history", async () => {
    api.range.mockImplementation(async (table: string) => ({
      error: null,
      data:
        table === "tasks"
          ? [
              {
                id: "root",
                title: "Old work",
                org_id: "org",
                linked_project_id: "project",
                assigned_to: "me",
                status: "completed",
              },
            ]
          : [],
    }));
    api.tree.mockResolvedValue({
      root: { id: "root", open: false },
      people: [{ id: "me", eligible: false }],
      nodes: [],
    });
    const data = await loadWorkFeed("me");
    expect(selectWorkRows(data.rows, "Assigned work", "All my work")).toEqual(
      [],
    );
    expect(selectWorkRows(data.rows, "History", "All my work")).toHaveLength(1);
    api.range.mockResolvedValue({ data: [], error: null });
    expect((await loadWorkFeed("me")).rows).toEqual([]);
  });
  it("keeps independent fulfilled sources when Office task reads fail", async () => {
    api.range.mockResolvedValue({
      data: null,
      error: { message: "Office read denied" },
    });
    api.list.mockResolvedValue([privateWorkspace]);
    api.select.mockResolvedValue({
      projects: [
        {
          id: "p",
          kind: "personal",
          title: "Research",
          status: "active",
          home_workspace_id: "private",
        },
      ],
    });
    api.personal.mockResolvedValue({
      owner: "me",
      project: { workspace_id: "private", status: "active" },
      members: [],
      tasks: [
        {
          id: "private-task",
          title: "Read",
          lead_id: "me",
          status: "todo",
          progress: 0,
        },
      ],
    });
    api.tree.mockResolvedValue({
      root: { id: "private-task", open: true, due: null },
      nodes: [],
      people: [{ id: "me", eligible: true }],
    });
    const data = await loadWorkFeed("me");
    expect(data.rows.map((r) => r.id)).toEqual(["private-task"]);
    expect(data.issues.join()).toContain("Office read denied");
  });
});
