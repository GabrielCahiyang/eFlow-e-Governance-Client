import { describe, expect, it } from "vitest";
import type { Employee } from "../../src/app/services/employeeService";
import type { Project } from "../../src/app/features/projects";
import type { Task } from "../../src/app/features/tasks";
import type { TeamWorkflowFacts } from "../../src/app/features/team-management";
import {
  buildDepartmentReportRows,
  filterDepartmentReportRows,
} from "../../src/app/features/reports";

const NOW = new Date("2026-08-17T08:00:00Z").getTime();
const employees: Employee[] = [
  { id: "lead", name: "Lead One", jobTitle: "Head", jobDescription: "Planning", currentWorkload: 0 },
  { id: "member", name: "Member One", jobTitle: "Member", jobDescription: "Writing", currentWorkload: 0 },
];
const tasks: Task[] = [{
  id: "task",
  title: "Prepare plan",
  status: "in_progress",
  assigneeId: "lead",
  assigneeName: "Lead One",
  teamMemberIds: ["lead", "member"],
  teamMemberNames: ["Lead One", "Member One"],
  linkedProjectId: "project",
  percentComplete: 40,
  priority: "high",
  createdAt: NOW - 10_000,
  updatedAt: NOW - 5_000,
}];
const projects: Project[] = [{
  id: "project",
  title: "Development plan",
  description: "Plan the work",
  ownerId: "lead",
  status: "active",
  priority: "high",
  createdAt: NOW - 20_000,
  updatedAt: NOW - 5_000,
}];
const facts: TeamWorkflowFacts = {
  subtasks: [{
    id: "subtask",
    taskId: "task",
    title: "Draft annex",
    isCompleted: false,
    status: "for_review",
    percentComplete: 100,
    assignedTo: "member",
    assignedToIds: ["member"],
    position: 0,
    source: "manual",
    createdAt: NOW - 9_000,
    updatedAt: NOW - 4_000,
  }],
  progress: [],
  submissions: [{
    id: "submission",
    kind: "subtask",
    taskId: "task",
    subtaskId: "subtask",
    version: 1,
    submitterId: "member",
    submitterName: "Member One",
    reviewerId: "lead",
    status: "pending",
    submittedAt: NOW - 3_600_000,
  }],
  statusHistory: [],
  evidence: [{
    id: "evidence",
    kind: "subtask",
    taskId: "task",
    submissionId: "submission",
    fileName: "annex.pdf",
    filePath: "task/submission/annex.pdf",
    fileSize: 2048,
    mimeType: "application/pdf",
    createdAt: NOW - 3_500_000,
  }],
};

describe("office reports", () => {
  it("attributes task and subtask contributions instead of counting only the lead", () => {
    const rows = buildDepartmentReportRows("contributions", tasks, projects, employees, facts, [], NOW);
    expect(rows.filter((row) => row.personId === "member").map((row) => row.role)).toEqual([
      "Task member",
      "Subtask contributor",
    ]);
    expect(rows.some((row) => row.personId === "lead" && row.role === "Team Lead")).toBe(true);
  });

  it("links evidence to the submitter, work item, project, and approval state", () => {
    const rows = buildDepartmentReportRows("evidence", tasks, projects, employees, facts, [], NOW);
    expect(rows[0]).toMatchObject({
      title: "annex.pdf",
      parent: "Prepare plan / Draft annex",
      project: "Development plan",
      person: "Member One",
      status: "pending",
      taskId: "task",
    });
  });

  it("exports the same exact rows selected by report filters", () => {
    const rows = buildDepartmentReportRows("contributions", tasks, projects, employees, facts, [], NOW);
    const filtered = filterDepartmentReportRows(rows, {
      search: "annex",
      personId: "member",
      projectId: "project",
      status: "for review",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe("Prepare plan / Draft annex");
  });
});

describe('NW9.3 report attribution',()=>{
  it('restores Lead-only attribution and counts the distinct Lead plus contributors without mutating workers',()=>{
    for(const workers of [[],['member','lead','member','lead']]){
      const node={...facts.subtasks[0],leadId:'lead',assignedToIds:workers,dueDate:'2026-10-21'};
      const rows=buildDepartmentReportRows('contributions',[{...tasks[0],deadline:'2026-10-30'}],projects,employees,{...facts,subtasks:[node]},[],NOW)
        .filter(row=>row.id.startsWith('subtask-contribution:'));
      expect(rows.map(row=>[row.personId,row.role])).toEqual(workers.length?[['lead','Subitem Lead'],['member','Subtask contributor']]:[['lead','Subitem Lead']]);
      expect(rows.every(row=>row.dueAt===Date.parse('2026-10-21'))).toBe(true);
      expect(node.assignedToIds).toBe(workers);
    }
  });
  it('keeps original submitter/evidence and decision authors distinct from changed staffing and reviewer assignment',()=>{
    const changed={...facts,subtasks:[{...facts.subtasks[0],leadId:'lead',dueDate:'2026-10-21'}],submissions:[{
      ...facts.submissions[0],status:'approved' as const,submitterName:'Original submitter',reviewerId:'lead',
      decisionAuthorId:'member',decisionAuthorName:'Original decision actor',decidedAt:NOW,
    }]};
    const rows=buildDepartmentReportRows('reviews',tasks,projects,employees,changed,[],NOW);
    expect(rows[0]).toMatchObject({person:'Original submitter',assignedReviewer:'Lead One',decisionAuthor:'Original decision actor',dueAt:Date.parse('2026-10-21')});
    expect(rows[0].detail).toContain('Recorded decision author: Original decision actor');
    expect(buildDepartmentReportRows('evidence',tasks,projects,employees,changed,[],NOW)[0]).toMatchObject({person:'Original submitter',parent:'Prepare plan / Draft annex',dueAt:Date.parse('2026-10-21')});
    expect(buildDepartmentReportRows('reviews',tasks,projects,employees,{...facts,submissions:[{...facts.submissions[0],status:'approved'}]},[],NOW)[0].decisionAuthor).toBe('Not recorded');
    expect(buildDepartmentReportRows('reviews',tasks,projects,employees,facts,[],NOW)[0].decisionAuthor).toBe('Not decided');
  });
  it('uses full depth-eight paths with duplicate titles, item dates and the same exported reviewer fields',async()=>{
    const nodes=Array.from({length:8},(_,i)=>({...facts.subtasks[0],id:`n${i}`,parentSubtaskId:i?`n${i-1}`:undefined,title:'Same',leadId:'lead',dueDate:`2026-10-${String(20+i).padStart(2,'0')}`}));
    const deep={...facts,subtasks:nodes,submissions:[{...facts.submissions[0],subtaskId:'n7'}]};
    const row=buildDepartmentReportRows('reviews',tasks,projects,employees,deep,[],NOW)[0];
    expect(row.title).toBe(['Prepare plan',...Array(8).fill('Same')].join(' / '));
    expect(row.dueAt).toBe(Date.parse('2026-10-27'));
    const risk=buildDepartmentReportRows('risks',tasks,projects,employees,deep,[{id:'risk',taskId:'task',taskTitle:'Prepare plan',subtaskId:'n7',kind:'overdue',severity:'warning',title:'Item overdue',detail:'Recorded risk',employeeIds:['lead']}],NOW)[0];
    expect(risk).toMatchObject({parent:row.title,dueAt:row.dueAt});
    const {departmentReportColumns}=await import('../../src/app/features/reports/exportColumns');
    const {buildReportHtml}=await import('../../src/app/services/reportService');
    const html=buildReportHtml([row],departmentReportColumns,{title:'Reviews'});
    for(const key of ['title','detail','due'])expect(html).toContain(String(departmentReportColumns.find(column=>column.key===key)!.value(row)));
    expect(html).toContain('Assigned reviewer: Lead One');
    expect(html).toContain('Recorded decision author: Not decided');
    const filtered=filterDepartmentReportRows([row],{search:'lead one',personId:'all',projectId:'all',status:'all'});
    expect(filtered).toEqual([row]);
    const foreign={...nodes[0],id:'foreign',taskId:'denied',title:'SECRET'};
    const orphan={...nodes[7],parentSubtaskId:'foreign'};
    const denied=buildDepartmentReportRows('reviews',tasks,projects,employees,{...deep,subtasks:[foreign,orphan]},[],NOW)[0];
    expect(denied.title).toBe('Parent context unavailable / Same');
    expect(denied.title).not.toContain('SECRET');
  });
});

