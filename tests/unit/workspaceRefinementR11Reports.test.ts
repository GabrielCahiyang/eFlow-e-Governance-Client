import { financialOfficeUnavailable } from "../../src/app/features/projects/selectors/projectReportAvailability";
import { budgetReportRead } from "../../src/app/features/budget/services/budgetReportReads";
import { describe, it, expect } from "vitest";
import { readAllRows } from "../../src/app/shared/readAllRows";
import {
  selectProjectReportScope,
  EMPTY_REPORT_FILTERS,
} from "../../src/app/features/projects/selectors/projectReportScope";
import { buildProjectExecutionFinancialRows } from "../../src/app/features/projects/selectors/projectFinancialReportSelectors";
import type { ProjectCommandData } from "../../src/app/features/projects/components/project-command/types";
import {buildSubtaskDisplayMetadata,mergeWorkDisplayMetadata} from '../../src/app/features/nested-work';
import {COLUMNS} from '../../src/app/features/projects/selectors/projectReportColumns';
import {buildReportHtml} from '../../src/app/services/reportService';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ReceiptRegister} from '../../src/app/features/projects/components/project-command/ProjectReportRegisters';
function fixture(): ProjectCommandData {
  return {
    project: { title: "Report", status: "active" },
    tasks: [
      {
        id: "root",
        title: "Workshop",
        orgId: "office",
        status: "todo",
        percentComplete: 20,
      },
      {
        id: "other",
        title: "Other Office",
        orgId: "foreign",
        status: "todo",
        percentComplete: 30,
      },
    ],
    facts: {
      subtasks: [
        {
          id: "child",
          taskId: "root",
          title: "Materials",
          status: "todo",
          assignedToIds: [],
          position: 1,
        },
        {
          id: "grandchild",
          parentSubtaskId: "child",
          taskId: "root",
          title: "Receipts",
          status: "in_progress",
          assignedToIds: [],
          position: 0,
        },
      ],
      evidence: [],
      submissions: [],
      progress: [],
      statusHistory: [],
    },
    financial: {
      allocations: [
        { id: "a", taskId: "root", amount: 100, status: "approved" },
        { id: "b", taskId: "other", amount: 200, status: "approved" },
        {
          id: "c",
          taskId: "root",
          subtaskId: "child",
          amount: 20,
          status: "approved",
        },
      ],
      requests: [
        {
          id: "r1",
          taskId: "root",
          status: "settled",
          actualSpent: 50,
          returnedAmount: 5,
        },
        {
          id: "r2",
          taskId: "root",
          subtaskId: "child",
          status: "approved",
          requestedAmount: 10,
        },
      ],
      allocationLines: [],
      requestAttachments: [],
      releases: [],
      liquidations: [],
      ledger: [],
      commitments: [],
    },
  } as unknown as ProjectCommandData;
}
describe("R11 report integrity", () => {
  it('retains original cash recipient and receipt amount while showing the authorized nested path',()=>{
    const data=fixture();
    Object.assign(data.financial.requests[1],{taskTitle:'Recorded task',subtaskTitle:'Recorded node',subtaskId:'grandchild',cashRecipientName:'Original cash recipient',requesterName:'Original requester',purpose:'Original purpose'});
    data.financial.liquidations=[{requestId:'r2',version:2,receipts:[{id:'receipt',amount:12.5,vendor:'Recorded vendor',receiptDate:'2026-10-01',filePath:'protected/receipt.pdf'}]}] as ProjectCommandData['financial']['liquidations'];
    const html=renderToStaticMarkup(createElement(ReceiptRegister,{data}));
    expect(html).toContain('Workshop / Materials / Receipts');
    expect(html).toContain('Original cash recipient');
    expect(html).toContain('12.50');
    expect(html).toContain('Recorded vendor');
    expect(html).not.toContain('protected/receipt.pdf');
    data.facts.subtasks=[];
    const historical=renderToStaticMarkup(createElement(ReceiptRegister,{data}));
    expect(historical).toContain('Recorded task / Recorded node');
    expect(historical).toContain('Original cash recipient');
  });
  it('shares deep permitted paths, explicit Lead/count and own dates with exports while keeping root finance/progress totals',()=>{
    const data=fixture();
    data.tasks[0].deadline='2026-10-30';
    const original=buildProjectExecutionFinancialRows(data.tasks,data.facts.subtasks,data.financial,data.facts);
    const nodes=Array.from({length:8},(_,i)=>({...data.facts.subtasks[0],id:i===0?'child':`n${i}`,parentSubtaskId:i?(i===1?'child':`n${i-1}`):undefined,
      title:'Same',leadId:'appointed',assignedToIds:i===7?['worker','appointed','worker']:[],dueDate:i===7?'2026-10-21':undefined}));
    const contexts=buildSubtaskDisplayMetadata(nodes,{rootId:'root',people:[{id:'appointed',name:'Scoped Lead'},{id:'worker',name:'Scoped worker'}]});
    data.facts.subtasks=nodes.map(node=>mergeWorkDisplayMetadata(node,contexts.get(node.id)));
    const rows=buildProjectExecutionFinancialRows(data.tasks,data.facts.subtasks,data.financial,data.facts);
    expect(rows.filter(row=>row.level==='task')).toEqual(original.filter(row=>row.level==='task'));
    expect(rows[1]).toMatchObject({budgetAmount:20,reservedAmount:10,deadline:'',schedule:'unscheduled',accountability:'Lead: Scoped Lead · Contributors (0): No contributors'});
    const row=rows.find(item=>item.id==='n7')!;
    expect(row.workItem).toBe(['Workshop',...Array(8).fill('Same')].join(' / '));
    expect(row).toMatchObject({deadline:'2026-10-21',accountability:'Lead: Scoped Lead · Contributors (1): Scoped worker',budgetMode:'shared',budgetAmount:0,receiptCount:0,evidenceCount:0});
    const html=buildReportHtml(rows,COLUMNS,{title:'Project register'});
    for(const key of ['hierarchy','accountability','deadline'])expect(html).toContain(String(COLUMNS.find(column=>column.key===key)!.value(row)));
    const scoped=selectProjectReportScope(data,{...EMPTY_REPORT_FILTERS,office:'office',search:'Scoped Lead',from:'2026-10-21',to:'2026-10-21'});
    expect(scoped.tasks.map(task=>task.id)).toEqual(['root']);
    expect(scoped.facts.subtasks).toHaveLength(8);
    expect(scoped.financial.allocations).toHaveLength(2);
  });
  it("preserves task families, recursive paths and funding pools under filters", () => {
    const scoped = selectProjectReportScope(fixture(), {
      ...EMPTY_REPORT_FILTERS,
      office: "office",
      search: "Receipts",
      status: "in_progress",
    });
    expect(scoped.tasks.map((t) => t.id)).toEqual(["root"]);
    expect(scoped.financial.allocations).toHaveLength(2);
    expect(scoped.facts.subtasks).toHaveLength(2);
    const rows = buildProjectExecutionFinancialRows(
      scoped.tasks,
      scoped.facts.subtasks,
      scoped.financial,
      scoped.facts,
    );
    expect(rows.map((r) => r.workItem)).toEqual([
      "Workshop",
      "Workshop / Materials",
      "Workshop / Materials / Receipts",
    ]);
    expect(rows[0]).toMatchObject({
      budgetAmount: 100,
      spentAmount: 50,
      reservedAmount: 10,
      returnedAmount: 5,
      availableAmount: 40,
    });
    expect(rows[1]).toMatchObject({
      budgetMode: "cap",
      budgetAmount: 20,
      reservedAmount: 10,
    });
    expect(rows[2].budgetMode).toBe("shared");
    expect(
      selectProjectReportScope(fixture(), {
        ...EMPTY_REPORT_FILTERS,
        search: "missing",
      }).financial.requests,
    ).toEqual([]);
  });
  it("exhausts exact-count queries even when the server cap is smaller than the requested page", async () => {
    const calls: number[] = [],
      all = Array.from({ length: 1201 }, (_, i) => i);
    const rows = await readAllRows<number>(async (from) => {
      calls.push(from);
      return {
        data: all.slice(from, from + 250),
        count: all.length,
        error: null,
      };
    });
    expect(rows).toEqual(all);
    expect(calls).toEqual([0, 250, 500, 750, 1000]);
  });
  it("rejects failed, truncated or changed-count reads instead of false complete totals", async () => {
    await expect(
      readAllRows(async () => ({
        data: null,
        error: { message: "Evidence denied" },
      })),
    ).rejects.toThrow("Evidence denied");
    let calls = 0;
    await expect(
      readAllRows(async () => ({
        data: calls++ ? [2] : [1],
        count: calls === 1 ? 3 : 4,
        error: null,
      })),
    ).rejects.toThrow("changed during loading");
    await expect(
      readAllRows(async () => ({ data: [], count: 3, error: null })),
    ).rejects.toThrow("incomplete");
  });
  it("marks other Office funding unavailable without treating it as zero", () => {
    const data = fixture();
    data.project.orgId = "office";
    expect(financialOfficeUnavailable(data, "root")).toBe(false);
    expect(financialOfficeUnavailable(data, "other")).toBe(true);
  });
  it("chunks financial identifiers, exhausts small server pages and keeps global ordering", async () => {
    const ids = Array.from({ length: 205 }, (_, i) => String(i));
    const batches: number[] = [];
    const result = await budgetReportRead(
      (selected) => {
        batches.push(selected.length);
        return {
          range: async (from) => ({
            data: selected
              .slice(from, from + 25)
              .map((id) => ({ id, position: Number(id) })),
            count: selected.length,
            error: null,
          }),
        };
      },
      ids,
      "position",
      false,
    );
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(205);
    expect(result.data?.[0].id).toBe("204");
    expect(Math.max(...batches)).toBe(100);
  });
  it("keeps budget source failures explicit through the existing return contract", async () => {
    expect(
      await budgetReportRead(() => ({
        range: async () => ({
          data: null,
          error: { message: "Settlement denied" },
        }),
      })),
    ).toMatchObject({ data: null, error: { message: "Settlement denied" } });
  });
});
