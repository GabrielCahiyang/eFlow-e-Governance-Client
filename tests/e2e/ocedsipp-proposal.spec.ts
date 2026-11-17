import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";

test("New menu imports the real OCEDSIPP PDF into a review draft", async ({ page }) => {
  test.setTimeout(120_000);
  const pdf = resolve("Project-Proposal-OCEDSIPP-Final-Version.pdf");
  test.skip(!existsSync(pdf), "Local acceptance PDF is unavailable.");
  const { org, id } = await projectWorkspaceFixture(page, "head");
  await page.getByRole("button", { name: "← All projects", exact: true }).click();
  await page.route("**/controlpanelEflow/api/ai/status", route => route.fulfill({ json: {
    ai_endpoint: "http://127.0.0.1:5190/controlpanelEflow/api",
    ai_endpoint_status: "online",
    ai_endpoint_heartbeat: new Date().toISOString(),
  } }));
  await page.route("**/controlpanelEflow/api/proposals/validate", route => route.fulfill({ json: { is_proposal: true, score: 100 } }));
  await page.route("**/controlpanelEflow/api/ai/jobs", route => {
    const table = route.request().postDataJSON().pdf_table_enrichment;
    expect(table.tasks).toHaveLength(10);
    expect(table.tasks[0].title).toBe("Kick Off Meeting");
    expect(table.costs).toHaveLength(16);
    return route.fulfill({ status: 202, json: {
      job_id: "pdf-enrichment", status: "completed", jobs_ahead: 0, result: { message: { content: JSON.stringify({
        // Reverse the suggestions to prove that IDs, rather than position, link them.
        tasks: table.tasks.map(({ key }: { key: string }) => ({ key, priority: "high", estimatedHours: 8 })).reverse(),
        allocations: table.costs.map(({ sourceId }: { sourceId: string }, index: number) => ({ sourceId, taskId: table.tasks[index % 10].key })),
      }) } },
    } });
  });
  const draftId = "d106989e-f550-45e1-b1d7-0291a301a473";
  let created = 0;
  await page.route("**/rest/v1/rpc/create_collaboration_draft", route => {
    const { p_snapshot: snapshot, p_title: title } = route.request().postDataJSON();
    const { tasks } = snapshot;
    expect(tasks).toHaveLength(10);
    expect(tasks[0]).toMatchObject({ title: "Kick Off Meeting", assignedMemberIds: [], leadMemberId: null });
    expect(tasks[0].subtasks).toContain("Prepare presentation");
    expect(tasks.flatMap((task: { budgetLines: { amount: number }[] }) => task.budgetLines).reduce((sum: number, line: { amount: number }) => sum + line.amount, 0)).toBe(2_156_500);
    created++;
    return route.fulfill({ json: { id: draftId, title, owner_org_id: org, owner_user_id: id, source_type: "ai_pdf", status: "draft", working_snapshot: snapshot } });
  });
  await page.route("**/storage/v1/object/proposal-drafts/**", route => route.fulfill({ json: { Key: `proposal-drafts/${draftId}/source.pdf` } }));
  await page.route("**/rest/v1/rpc/set_collaboration_source_document", route => route.fulfill({ json: null }));

  await page.getByRole("button", { name: "+ New", exact: true }).click();
  await page.getByRole("menuitem", { name: "Import AI PDF", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Import AI PDF" });
  await dialog.getByRole("checkbox", { name: /Suggest people/ }).uncheck();
  await dialog.locator('input[type="file"]').setInputFiles(pdf);
  expect(created).toBe(0);
  await dialog.getByRole("button", { name: "Start import", exact: true }).click();
  await expect(dialog.getByRole("region", { name: "Work-plan draft review" })).toBeVisible({ timeout: 40_000 });
  expect(created).toBe(1);
});

for (const uncertain of [false, true])
  test(`PDF imports into the current project table${uncertain ? " with a safe retry" : ""}`, async ({
    page,
  }, info) => {
    test.setTimeout(150000);
    const pdf = resolve("Project-Proposal-OCEDSIPP-Final-Version.pdf");
    test.skip(!existsSync(pdf), "Local acceptance PDF is unavailable.");
    await page.setViewportSize({ width: 1600, height: 1000 });
    const r = await projectWorkspaceFixture(page, "head", false, {
      compactLayout: true,
    });
    const originalTasks=structuredClone(r.tasks);
    let targetProject=r.project;
    if(!uncertain){
      await page.getByRole('button',{name:'+ New',exact:true}).click();
      await page.getByRole('menuitem',{name:'Create project',exact:true}).click();
      const create=page.getByRole('dialog',{name:'Let’s start working together',exact:true});
      await create.getByLabel('Project name').fill('PDF project acceptance');
      await create.getByRole('button',{name:'Create project →',exact:true}).click();
      await page.getByRole('region',{name:'Add people to project',exact:true}).getByRole('button',{name:'Back to project',exact:true}).click();
      targetProject=new URL(page.url()).searchParams.get('project')!;
      const people=await page.getByRole('button',{name:'+ Add people',exact:true}).boundingBox();
      const pdfButton=await page.getByRole('button',{name:'Import PDF',exact:true}).boundingBox();
      expect(pdfButton!.x).toBeGreaterThan(people!.x);expect(Math.abs(pdfButton!.y-people!.y)).toBeLessThan(3);
    }
    let jobs = 0,
      writes = 0;
    let captured: any;
    let savedSession:any=null;
    await page.route('**/rest/v1/project_pdf_import_sessions?**',route=>route.fulfill({json:savedSession&&!savedSession.result?[savedSession]:[]}));
    await page.route('**/rest/v1/rpc/save_pdf_import_session',route=>{
      const body=route.request().postDataJSON();
      savedSession={id:body.p_id,project_id:body.p_project,actor_id:r.id,revision:(savedSession?.revision||0)+1,state:body.p_state,result:null,runner:body.p_runner,lease_until:new Date(Date.now()+90000).toISOString()};
      return route.fulfill({json:savedSession});
    });
    await page.route('**/rest/v1/rpc/touch_pdf_import_session',route=>route.fulfill({json:null}));
    const ids: string[] = [];
    await page.route("**/controlpanelEflow/api/ai/status", (route) =>
      route.fulfill({
        json: {
          ai_endpoint: "http://127.0.0.1:5190/controlpanelEflow/api",
          ai_endpoint_status: "online",
          ai_endpoint_heartbeat: new Date().toISOString(),
        },
      }),
    );
    await page.route("**/controlpanelEflow/api/ai/jobs", (route) => {
      const body = route.request().postDataJSON();
      expect(body.pdf_table_enrichment?.schemaVersion).toBe(1);
      expect(body.pdf_table_enrichment.tasks).toHaveLength(10);
      expect(body.pdf_table_enrichment.costs).toHaveLength(16);
      jobs++;
      return route.fulfill({
        status: 202,
        json: {
          job_id: "direct-pdf",
          status: "completed",
          jobs_ahead: 0,
          result: {
            message: {
              content: JSON.stringify({
                tasks: Array.from({ length: 10 }, (_, index) => ({
                  key: `task-${index + 1}`,
                  priority: "high",
                  estimatedHours: 8,
                })),
                allocations: Array.from({ length: 16 }, (_, index) => ({
                  sourceId: `budget-${index + 1}`,
                  taskId: `task-${(index % 10) + 1}`,
                })),
              }),
            },
          },
        },
      });
    });
    await page.route("**/rest/v1/rpc/complete_pdf_import_session", (route) => {
      writes++;
      const body = route.request().postDataJSON();
      ids.push(body.p_id);
      captured = savedSession.state.review;
      expect(savedSession.project_id).toBe(targetProject);
      if (uncertain && writes === 1)
        return route.fulfill({
          status: 503,
          json: { message: "Connection interrupted" },
        });
      const taskIds: Record<string, string> = {},
        groupIds: string[] = [];
      captured.groups.forEach((group: any, groupIndex: number) => {
        const id = crypto.randomUUID();
        groupIds.push(id);
        r.groups.push({
          id,
          project_id: targetProject,
          title: group.title,
          color: group.color,
          position: groupIndex + 1,
          is_default: false,
        });
        group.tasks.forEach((task: any, index: number) => {
          const id = crypto.randomUUID();
          taskIds[task.key] = id;
          const budget = captured.taskBudgets.find(
            (budget: any) => budget.key === task.key,
          );
          r.tasks.push({
            id,
            title: task.title,
            description: task.description,
            org_id: r.org,
            linked_project_id: targetProject,
            project_id: targetProject,
            group_id: groupIds[groupIndex],
            workspace_position: index,
            status: "pending_assignment",
            assigned_to: null,
            team_member_ids: [],
            priority: task.priority,
            estimated_hours: task.estimatedHours,
            start_date: task.startDate,
            deadline: task.dueDate,
            due_date: task.dueDate,
            budget_impact: budget.lines.reduce(
              (sum: number, line: any) => sum + line.amount,
              0,
            ),
            created_by: r.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        });
      });
      const result={
          taskCount: 10,
          subitemCount: 0,
          groupCount: 8,
          taskIds,
          groupIds,
        };
      savedSession.result=result;
      return route.fulfill({json:result});
    });
    await page.getByRole("button", { name: "Import PDF", exact: true }).click();
    const panel = page.getByRole("region", { name: "Import PDF into project" });
    await panel.getByLabel("PDF schedule starts").fill("2099-10-20");
    await panel.getByRole('checkbox',{name:/Choose people during import/}).uncheck();
    await page.screenshot({path:info.outputPath('project-header-before-import.png')});
    await panel.getByLabel("Import project PDF").setInputFiles(pdf);
    if (uncertain) {
      await expect(panel.getByRole("alert")).toContainText(
        "Connection interrupted",
        { timeout: 90000 },
      );
      await panel
        .getByRole("button", { name: /Resume import/ })
        .click();
    }
    await expect(panel.getByRole("status")).toContainText(
      "10 tasks imported",
      { timeout: 90000 },
    );
    expect(jobs).toBe(1);
    expect(writes).toBe(uncertain ? 2 : 1);
    if (uncertain) expect(ids[0]).toBe(ids[1]);
    expect(captured.applyProjectDetails).toBe(false);
    expect(captured.sourceBudgetTotal).toBe(2156500);
    for(const task of originalTasks)expect(r.tasks.find(row=>row.id===task.id)).toEqual(task);
    expect(
      captured.taskBudgets.flatMap((budget: any) => budget.lines),
    ).toHaveLength(16);
    const first = captured.groups[0];
    expect(first.title).toBe("Part 1 — Inception and Planning Framework");
    expect(first.tasks[0]).toMatchObject({
      title: "Kick Off Meeting",
      priority: "high",
      dueDate: "2099-11-19",
    });
    expect(first.tasks[0].description).not.toContain(
      "Document Review and Gap Analysis",
    );
    expect(first.tasks[1].description).toContain(
      "Document Review and Gap Analysis",
    );
    await page.getByRole('button',{name:'Open project table',exact:true}).click();
    const table = page.getByRole("region", { name: "Project main table" });
    await expect(
      table.getByRole("button", { name: /^Edit group Part 1 / }),
    ).toBeVisible();
    await expect(
      table.getByRole("button",{name:"Budget for Kick Off Meeting",exact:true}),
    ).toContainText("350,000");
    await expect(
      table.getByRole("button", {
        name: "Edit task Kick Off Meeting",
        exact: true,
      }),
    ).toBeVisible();
    expect(await table.getByRole('button',{name:'Edit dates for Kick Off Meeting',exact:true}).evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
    await page.screenshot({
      path: info.outputPath("pdf-in-main-table-desktop.png"),
    });
    await page.getByRole("button", { name: "+ New", exact: true }).click();
    await expect(
      page.getByRole("menuitem", { name: "Import proposal", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("menuitem", { name: "Create a work plan", exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
  });

test("favorited project appears once in Favorites and returns to Projects when unstarred", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await projectWorkspaceFixture(page, "head");
  const rail = page.getByRole("region", {
    name: "Workspace content",
    exact: true,
  });
  await rail
    .getByRole("button", {
      name: "Add Community outreach to favorites",
      exact: true,
    })
    .click();
  await expect(
    rail.getByRole("button", { name: "Community outreach", exact: true }),
  ).toHaveCount(1);
  const favorite = rail.getByRole("button", {
    name: "Remove Community outreach from favorites",
    exact: true,
  });
  await expect(favorite).toHaveCount(1);
  await favorite.click();
  await expect(
    rail.getByRole("button", { name: "Community outreach", exact: true }),
  ).toHaveCount(1);
  await expect(
    rail.getByRole("button", {
      name: "Add Community outreach to favorites",
      exact: true,
    }),
  ).toHaveCount(1);
});
