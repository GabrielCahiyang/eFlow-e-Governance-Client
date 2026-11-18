import { describe, expect, it } from "vitest";
import {
  resolveNotificationDestination,
  resolveNotificationSubitem,
} from "../../src/app/features/notifications";
import type { Notification } from "../../src/app/services/notificationService";

function notification(
  patch: Partial<Notification>,
): Notification {
  return {
    id: "notification-1",
    type: "status_change",
    title: "Task updated",
    message: "Work changed.",
    read: false,
    createdAt: Date.now(),
    ...patch,
  };
}

describe("notification navigation", () => {
  it('opens change alerts for supervisors without treating them as personal assignments or review requests', () => {
    const changed = notification({ type: 'status_change', title: 'Subtask schedule changed', entityType: 'work_change', taskId: 'root', workNodeId: 'node', projectId: 'project' });
    expect(resolveNotificationDestination(changed, 'head')).toMatchObject({ section: 'personal_work', label: 'View subtask changes', intent: { kind: 'leading_task', taskId: 'root', entityId: 'node' } });
    expect(resolveNotificationDestination(changed, 'admin')).toBeNull();
    expect(resolveNotificationDestination({ ...changed, workNodeId: undefined, statusTo: 'for_review' }, 'member')).toMatchObject({ intent: { kind: 'task', taskId: 'root' } });
  });
  it('opens a root contributor submission at its task rather than the project directory', () => {
    expect(resolveNotificationDestination(notification({ type: 'approval_needed', entityType: 'm7_work_proposal', taskId: 'root', projectId: 'project' }), 'member')).toMatchObject({ label: 'Open task submission', intent: { kind: 'leading_task', taskId: 'root' } });
  });
  it('keeps personal review notifications on the personal work access path', () => {
    expect(resolveNotificationDestination(notification({ type: 'approval_needed', entityType: 'm7_personal_work_proposal', taskId: 'personal-root', workNodeId: 'personal-node', projectId: 'personal-project' }), 'member')).toMatchObject({ section: 'personal_work', intent: { kind: 'personal_work', taskId: 'personal-root', entityId: 'personal-node', projectId: 'personal-project' } });
  });
  it('opens the exact subtask from a Lead review notification', () => {
    const review = notification({ type: 'approval_needed', entityType: 'm7_work_proposal', taskId: 'task', workNodeId: 'subtask' });
    expect(resolveNotificationDestination(review, 'member')).toMatchObject({
      section: 'personal_work', page: 'Leading', intent: { kind: 'leading_task', taskId: 'task', entityId: 'subtask' },
    });
  });
  it('links Office Petty Cash and archive blockers to their own records', () => {
    const cash = notification({ type: 'petty_cash_settlement_blocked', financialRecordType: 'office_petty_cash_staffing', financialRecordId: 'cash-id' });
    expect(resolveNotificationDestination(cash, 'head')).toMatchObject({ section: 'budget', intent: { financialRecordId: 'cash-id', financialRecordType: 'office_petty_cash_staffing' } });
    const archive = notification({ type: 'project_archive_blocked', projectId: 'project-id' });
    expect(resolveNotificationDestination(archive, 'head')).toMatchObject({ section: 'projects', intent: { projectId: 'project-id', financialRecordType: 'project_archive_blocker' } });
  });
  it('opens the exact budget review for settlement staffing alerts addressed to the Head', () => {
    const alert = notification({ type: 'petty_cash_settlement_blocked', financialRecordType: 'settlement_staffing', financialRecordId: 'liquidation-id' });
    expect(resolveNotificationDestination(alert, 'head')).toMatchObject({ section: 'reviews', page: 'For Review', label: 'Open budget review', intent: { kind: 'budget', financialRecordId: 'liquidation-id' } });
    expect(resolveNotificationDestination(alert, 'accounting_staff')).toBeNull();
  });
  it('routes Head project invitation notifications directly into Projects without the removed membership tab', () => {
    const invitation = notification({ type: 'system', title: 'Project invitation approval requested', projectId: 'project-one' });
    expect(resolveNotificationDestination(invitation, 'head')).toMatchObject({ section: 'projects', page: 'Projects', label: 'Open project invitations', intent: { kind: 'project', projectId: 'project-one' } });
    expect(resolveNotificationDestination(invitation, 'member')).toMatchObject({ section: 'projects', intent: { kind: 'project' } });
    expect(resolveNotificationDestination(notification({ projectId: 'project-one', title: 'Project changed' }), 'head')).toMatchObject({ section: 'projects', intent: { kind: 'project' } });
  });
  it('routes canonical Subtasks into My Work Subtasks even when the notification copy does not say subtask',()=>{
    expect(resolveNotificationDestination(notification({type:'assignment',title:'New work appointment',message:'Work changed.',taskId:'root',workNodeId:'depth-eight',projectId:'project'}),'member')).toMatchObject({section:'personal_work',page:'Subtasks',intent:{kind:'subtask',taskId:'root',entityId:'depth-eight'}});
    expect(resolveNotificationDestination(notification({type:'approval_needed',title:'Evidence ready for review',message:'Work changed.',taskId:'root',workNodeId:'depth-eight'}),'head')).toMatchObject({section:'reviews',intent:{kind:'subtask_review',entityId:'depth-eight'}});
  });
  it('resolves canonical IDs before stale labels and never redirects a missing ID to a same-title sibling',()=>{
    const rows=[{id:'one',taskId:'root',title:'Same'},{id:'eight',taskId:'root',title:'Same'},{id:'foreign',taskId:'other-root',title:'Same'}];
    const intent={notificationId:'canonical',kind:'subtask' as const,taskId:'root',entityId:'eight',entityLabel:'Old label'};
    expect(resolveNotificationSubitem(intent,rows)).toEqual({status:'resolved',item:rows[1]});
    expect(resolveNotificationSubitem({...intent,entityId:'missing',entityLabel:'Same'},rows)).toEqual({status:'unavailable'});
    expect(resolveNotificationSubitem({...intent,entityId:'foreign'},rows)).toEqual({status:'unavailable'});
    expect(resolveNotificationSubitem({...intent,entityId:undefined,entityLabel:'Same'},rows)).toEqual({status:'ambiguous'});
    expect(resolveNotificationSubitem({...intent,entityId:undefined,entityLabel:undefined},[rows[0]])).toEqual({status:'unavailable'});
    expect(resolveNotificationSubitem({...intent,entityId:undefined,entityLabel:' same '},[rows[1],rows[2]])).toEqual({status:'resolved',item:rows[1]});
  });
  it('opens assigned independent financial reviews in the shared Inbox for Head and Member appointments',()=>{
    for (const role of ['head','member']) expect(resolveNotificationDestination(notification({type:'petty_cash_liquidation_decision',title:'Independent review',financialRecordId:'liq',financialRecordType:'independent_liquidation_review'}),role)).toMatchObject({section:'inbox',page:'Needs action',intent:{financialRecordId:'liq'}});
    expect(resolveNotificationDestination(notification({type:'petty_cash_liquidation_decision',title:'Independent review',financialRecordType:'independent_liquidation_review'}),'admin')).toBeNull();
  });
  it('keeps financial record destinations even when they carry a canonical work node',()=>{
    expect(resolveNotificationDestination(notification({type:'petty_cash_liquidation',title:'Subtask liquidation',taskId:'root',workNodeId:'eight',financialRecordId:'cash',financialRecordType:'petty_cash_liquidation'}),'accounting_staff')).toMatchObject({section:'accounting_releases',intent:{kind:'budget',entityId:'eight',financialRecordId:'cash',financialRecordType:'petty_cash_liquidation'}});
    expect(resolveNotificationDestination(notification({type:'assignment',title:'Subtask assignment',taskId:'root',workNodeId:'eight'}),'admin')).toBeNull();
  });
  it("opens the exact office task review queue", () => {
    expect(resolveNotificationDestination(notification({
      type: "approval_needed",
      title: "Task ready for review",
      message: 'Gabriel submitted "Prepare meeting" for review.',
      taskId: "task-1",
      taskTitle: "Prepare meeting",
      statusTo: "for_review",
    }), "head")).toMatchObject({
      section: "reviews",
      page: "For Review",
      label: "Open task review",
      intent: { kind: "task_review", taskId: "task-1" },
    });
  });

  it("opens subtask evidence in the leader review queue", () => {
    expect(resolveNotificationDestination(notification({
      type: "approval_needed",
      title: "Subtask evidence ready for review",
      message: 'Gabriel submitted "Prepare presentation".',
      taskId: "task-1",
      statusTo: "for_review",
    }), "member")).toMatchObject({
      section: "reviews",
      page: "Leader Reviews",
      intent: {
        kind: "subtask_review",
        taskId: "task-1",
        entityLabel: "Prepare presentation",
      },
    });
  });

  it("opens an assigned employee subtask inside My Work Subtasks rather than the retired checklist", () => {
    expect(resolveNotificationDestination(notification({
      type: "assignment",
      title: "New Subtask Assignment",
      message: 'Crisostomo assigned you to subtask "Prepare snacks" in "Meeting".',
      taskId: "task-2",
    }), "member")).toMatchObject({
      section: "personal_work",
      page: "Subtasks",
      label: "Open subtask",
      intent: { entityLabel: "Prepare snacks" },
    });
  });

  it("opens task deadline reminders at the linked project and exact task rather than old Task Board / My Tasks", () => {
    expect(resolveNotificationDestination(notification({
      type: "reminder",
      title: "Task due soon",
      message: '"Prepare logistics" is due on Nov 20, 2026.',
      taskId: "task-9",
      taskTitle: "Prepare logistics",
      projectId: "proj-1",
    }), "accounting_staff")).toMatchObject({
      section: "projects",
      page: "Projects",
      label: "Open task",
      intent: { kind: "task", taskId: "task-9", projectId: "proj-1" },
    });
  });

  it("opens subtask progress updates in the lead workspace", () => {
    expect(resolveNotificationDestination(notification({
      title: "Subtask progress updated",
      message: 'Maria updated "Invite participants" to 40%.',
      taskId: "task-3",
    }), "head")).toMatchObject({
      section: "personal_work",
      page: "Leading",
      label: "Open leading task",
      intent: { kind: "leading_task", taskId: "task-3" },
    });
  });

  it("opens announcements and ordinary task decisions in their workspaces", () => {
    expect(resolveNotificationDestination(notification({
      type: "assignment",
      title: "New announcement",
      message: "Office closure advisory",
    }), "member")).toMatchObject({
      section: "announcements",
      page: "Announcements",
    });

    expect(resolveNotificationDestination(notification({
      type: "completed",
      title: "Task approved",
      message: 'Your work on "Meeting report" was approved.',
      taskId: "task-4",
      taskTitle: "Meeting report",
      statusTo: "completed",
    }), "member")).toMatchObject({
      section: "personal_work",
      page: "Assigned work",
      label: "Open task",
      intent: { kind: "task", taskId: "task-4" },
    });
  });

  it("opens collaboration requests in Plans & Projects", () => {
    expect(resolveNotificationDestination(notification({
      type: "collaboration_request",
      title: "Inter-office collaboration request",
      message: 'LEDIPO requested review of "OCEDSIPP".',
      proposalId: "draft-1",
      entityType: "collaboration_draft",
    }), "head")).toMatchObject({
      section: "projects",
      page: "Projects",
      label: "Open collaboration review",
      intent: { kind: "collaboration", proposalId: "draft-1" },
    });
  });

  it("routes financial reviews and decisions into their contextual workspaces", () => {
    expect(resolveNotificationDestination(notification({
      type: "petty_cash_request",
      title: "Petty-cash request awaiting approval",
      taskId: "task-5",
      taskTitle: "Prepare workshop",
    }), "head")).toMatchObject({
      section: "reviews",
      page: "For Review",
      label: "Open funding review",
      intent: { kind: "budget", taskId: "task-5" },
    });

    expect(resolveNotificationDestination(notification({
      type: "petty_cash_decision",
      title: "Petty cash approved",
      taskId: "task-5",
    }), "member")).toMatchObject({
      section: "personal_work",
      page: "Assigned work",
      label: "Open task funding",
      intent: { kind: "budget", taskId: "task-5" },
    });

    expect(resolveNotificationDestination(notification({
      type: "petty_cash_decision",
      title: "Fund cash approved and scheduled",
      taskId: "task-5",
      projectId: "project-5",
    }), "member")).toMatchObject({
      section: "projects",
      page: "Projects",
      label: "Open task funding",
      intent: { kind: "budget", taskId: "task-5", projectId: "project-5" },
    });

    expect(resolveNotificationDestination(notification({
      type: "petty_cash_liquidation_accounting_review",
      title: "Liquidation ready for accounting settlement",
      taskId: "task-5",
      financialRecordId: "liquidation-1",
      financialRecordType: "petty_cash_liquidation",
    }), "accounting_staff")).toMatchObject({
      section: "accounting_releases",
      page: "Voucher & Cash Releases",
      label: "Open cash releases",
      intent: { kind: "budget", financialRecordId: "liquidation-1" },
    });
  });

  it("routes a corrected request back to the Team Leader review queue", () => {
    expect(resolveNotificationDestination(notification({
      type: "petty_cash_leader_review",
      title: "Corrected cash request needs your endorsement",
      taskId: "task-6",
      financialRecordId: "request-2",
      financialRecordType: "petty_cash_request",
    }), "member")).toMatchObject({
      section: "reviews",
      page: "Leader Reviews",
      label: "Open funding review",
      intent: { kind: "budget", taskId: "task-6", financialRecordId: "request-2" },
    });
  });
});
