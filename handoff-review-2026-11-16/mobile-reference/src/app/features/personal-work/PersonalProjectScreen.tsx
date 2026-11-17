import { useWorkStatus } from "../../shared/workStatusPresentation";
import { createLiveRefreshController } from "../../shared/liveUpdates";
import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Empty,
  ErrorState,
  LabelValue,
  Loading,
  Notice,
  Row,
  Screen,
  SearchField,
  Status,
  Tabs,
} from "../../components/ui";
import { NavigationRow } from "../../components/ui/NavigationRow";
import { Text } from "../../components/ui/Typography";
import { useAuth } from "../authentication";
import { useWorkspace } from "../workspaces";
import { ProjectFiles, ProjectActivity } from "../projects";
import { useFacts } from "../../shared/useFacts";
import { PublicMessageError } from "../../shared/userMessages";
import { confirmAction } from "../../shared/confirm";
import { useSnapshotPage } from "../../shared/useSnapshotPage";
import type { Navigate } from "../../shared/routes";
import { fetchPersonalProject } from "../../../core/web/app/features/workspaces/services/workspaceService";
import type { PersonalTask } from "../../../core/web/app/features/workspaces/types";
import { usePersonalActions } from "./usePersonalActions";
import { PersonalTaskSheet } from "./PersonalTaskSheet";
import { PersonalNestedWork } from "./PersonalNestedWork";
import { nativeWindow } from "../../../platform/webRuntime";
import { branchCompletion } from "../tasks/branchInspector";
import { completionPercent } from "../../shared/completion";
import { fetchWorkTree } from "../../../core/web/app/features/nested-work/services/workTreeService";
export function PersonalProjectScreen({
  id,
  navigate,
  initialTaskId,
}: {
  id: string;
  navigate: Navigate;
  initialTaskId?: string;
}) {
  const resolveStatus = useWorkStatus();
  const { profile } = useAuth(),
    workspace = useWorkspace(),
    facts = useFacts("personal-project:" + profile?.id + ":" + id, () =>
      fetchPersonalProject(id),
    );
  const action = usePersonalActions(profile?.id || "", id, async () => {
    nativeWindow.dispatchEvent({ type: "eflow:work-updated" });
    await Promise.all([facts.refresh(), workspace.refresh(), tree.refresh()]);
  });
  useEffect(() => {
    const live = createLiveRefreshController({
      onRefresh: () => void facts.refresh(),
    });
    return () => live.dispose();
  }, [facts.refresh]);
  const [view, setView] = useState("tasks"),
    [search, setSearch] = useState(""),
    [editor, setEditor] = useState<{
      mode: "create" | "staff" | "progress" | "submit" | "review";
      task?: PersonalTask;
    }>(),
    [expanded, setExpanded] = useState(
      new Set<string>(initialTaskId ? [initialTaskId] : []),
    ),
    [fileTask, setFileTask] = useState<string>();
  const data = facts.data,
    owner = data?.owner === profile?.id,
    eligible =
      owner ||
      !!data?.members.some(
        (member) =>
          member.user_id === profile?.id &&
          member.state === "active" &&
          member.eligible,
      ),
    active = data?.project.status === "active",
    blocked =
      action.busy ||
      action.loading ||
      action.recoveryBlocked ||
      !!action.pending;
  const availablePeople = (data?.members || []).filter(
    (member) => member.state === "active" && member.eligible,
  );
  const manageFiles = () =>
    navigate({
      name: "personal_project",
      id,
      view: "file_management",
      title: "File management",
    });
  const name = (id: string | null) =>
    data?.members.find((member) => member.user_id === id)?.name || "Unassigned";
  const task = initialTaskId
    ? data?.tasks.find((item) => item.id === initialTaskId)
    : undefined;
  const tree = useFacts(
    `personal-tree:${profile?.id}:${id}:${task?.id}`,
    async () => {
      const snapshot = await fetchWorkTree(task!.id);
      if (snapshot.root.kind !== "personal" || snapshot.root.project !== id)
        throw new PublicMessageError("The task hierarchy could not be verified.");
      return snapshot;
    },
    !!task && !facts.error,
  );
  const taskCompletion =
    tree.data && !tree.error && task
      ? branchCompletion(tree.data, task.status)
      : undefined;
  const projectCompleted =
    data?.tasks.filter((item) => item.status === "done").length ?? 0;
  const browseTasks =
    !!data && !facts.error && view === "tasks" && !initialTaskId;
  const needle = search.trim().toLowerCase();
  const matchingTasks = browseTasks
    ? data.tasks.filter(
        (task) => !needle || task.title.toLowerCase().includes(needle),
      )
    : [];
  const page = useSnapshotPage(
    JSON.stringify([profile?.id, id, needle]),
    matchingTasks.length,
  );
  return (
    <Screen<PersonalTask>
      compact
      title={task?.title || data?.project.title || "Personal project"}
      description="Personal workspace"
      onRefresh={async () => {
        await Promise.all([facts.refresh(), tree.refresh()]);
      }}
      list={
        browseTasks
          ? {
              data: matchingTasks.slice(0, page.limit),
              keyExtractor: (task) => task.id,
              onEndReached: page.onEndReached,
              renderItem: ({ item: task }) => (
                <NavigationRow
                  title={task.title}
                  description={`${resolveStatus(task.status).label} · ${name(task.lead_id)}`}
                  onPress={() =>
                    navigate({
                      name: "personal_project",
                      id,
                      taskId: task.id,
                      title: task.title,
                    })
                  }
                />
              ),
            }
          : undefined
      }

      actions={
        owner && active && !initialTaskId ? (
          <Button
            disabled={blocked || !availablePeople.length}
            onPress={() => setEditor({ mode: "create" })}
          >
            Add personal task
          </Button>
        ) : undefined
      }
    >
      {facts.error ? (
        <ErrorState error={facts.error} retry={() => void facts.refresh()} />
      ) : !data ? (
        <Loading label="Loading personal project" layout="personalProject" />
      ) : (
        <>
          <Row>
            <Status value={data.project.status} work />
            <Text>Owner: {name(data.owner)}</Text>
          </Row>
          {!initialTaskId && (
            <>
              <LabelValue
                label="Tasks completed"
                value={`${projectCompleted} of ${data.tasks.length} · ${completionPercent(projectCompleted, data.tasks.length, data.project.status)}%`}
              />
              <Tabs
                value={view}
                onChange={setView}
                items={[
                  { id: "tasks", label: "Tasks" },
                  { id: "members", label: "People" },
                  { id: "files", label: "Project files" },
                  { id: "activity", label: "Activity history" },
                ]}
              />
            </>
          )}
          {!!action.error && (
            <ErrorState context="action" error={action.error} />
          )}
          {!!action.notice && <Notice>{action.notice}</Notice>}
          {!!(active && owner && !availablePeople.length) && (
            <Notice>
              No eligible project members are available for assignment. Check
              People and refresh the project before creating a task.
            </Notice>
          )}
          {!!action.pending && (
            <Card title="Saved request needs verification">
              <Button busy={action.busy} onPress={() => void action.retry()}>
                Check previous changes
              </Button>
              {!!action.canDiscard && (
                <Button variant="outline" onPress={() => void action.discard()}>
                  Discard rejected request
                </Button>
              )}
              <Button variant="outline" onPress={() => void facts.refresh()}>
                Refresh current work
              </Button>
            </Card>
          )}
          {!!(view === "tasks") && (
            <>
              {browseTasks && (
                <>
                  <SearchField
                    value={search}
                    onChange={setSearch}
                    placeholder="Search personal tasks"
                  />
                  <Text accessibilityLiveRegion="polite">
                    {matchingTasks.length}{" "}
                    {matchingTasks.length === 1 ? "task" : "tasks"}
                  </Text>
                </>
              )}
              {browseTasks && !data.tasks.length && (
                <Empty kind="work" title="No personal tasks yet" />
              )}
              {browseTasks &&
                !!needle &&
                !!data.tasks.length &&
                !matchingTasks.length && (
                  <Empty
                    kind="work"
                    title="No personal tasks match"
                    action={
                      <Button variant="outline" onPress={() => setSearch("")}>
                        Clear search
                      </Button>
                    }
                  />
                )}
              {initialTaskId && !task && (
                <Empty title="This personal task is no longer available" />
              )}
              {task && (
                <Card key={task.id} title={task.title}>
                  <Row>
                    <Status value={task.status} work />
                  </Row>
                  <LabelValue
                    label="Progress"
                    value={
                      taskCompletion
                        ? taskCompletion.total
                          ? `${taskCompletion.completed}/${taskCompletion.total} complete · ${taskCompletion.percent}%`
                          : `${taskCompletion.percent}%`
                        : tree.loading
                          ? "Loading…"
                          : "Unavailable"
                    }
                  />
                  <LabelValue label="Lead" value={name(task.lead_id)} />
                  <LabelValue
                    label="Review"
                    value={
                      task.reviewer_id
                        ? name(task.reviewer_id)
                        : "No review required"
                    }
                  />
                  {!!task.note && <Text selectable>{task.note}</Text>}
                  {!!task.review_note && <Notice>{task.review_note}</Notice>}
                  {!!(active && eligible) && (
                    <Row>
                      {task.lead_id === profile?.id && task.status === "todo" && (
                        <Button
                          variant="outline"
                          disabled={blocked}
                          busy={action.busy}
                          onPress={() => void (async () => {
                            if (!(await confirmAction("Start this task?", "Ready to begin this work?", "Start work"))) return;
                            await action.run("start_task", { task_id: task.id, revision: task.revision });
                          })()}
                        >
                          Start work
                        </Button>
                      )}
                      {!!(
                        task.lead_id === profile?.id &&
                        task.status === "in_progress"
                      ) && (
                        <>
                          <Button
                            variant="outline"
                            disabled={blocked}
                            onPress={() =>
                              setEditor({ mode: "progress", task })
                            }
                          >
                            Record progress
                          </Button>
                          <Button
                            disabled={blocked}
                            onPress={() => setEditor({ mode: "submit", task })}
                          >
                            {task.reviewer_id
                              ? "Submit for review"
                              : "Complete personal task"}
                          </Button>
                        </>
                      )}
                      {!!(
                        task.reviewer_id === profile?.id &&
                        task.lead_id !== profile?.id &&
                        task.status === "submitted"
                      ) && (
                        <Button
                          disabled={blocked}
                          onPress={() => setEditor({ mode: "review", task })}
                        >
                          Review work
                        </Button>
                      )}
                      {!!(owner && task.status !== "done") && (
                        <Button
                          variant="outline"
                          disabled={blocked}
                          onPress={() => setEditor({ mode: "staff", task })}
                        >
                          Choose people
                        </Button>
                      )}
                    </Row>
                  )}
                  <Row>
                    <Button
                      variant="ghost"
                      onPress={() =>
                        setFileTask(fileTask === task.id ? undefined : task.id)
                      }
                    >
                      Task files
                    </Button>
                    <Button
                      variant="ghost"
                      onPress={() =>
                        setExpanded((previous) => {
                          const next = new Set(previous);
                          next.has(task.id)
                            ? next.delete(task.id)
                            : next.add(task.id);
                          return next;
                        })
                      }
                    >
                      {expanded.has(task.id) ? "Hide" : "Show"} subtasks
                    </Button>
                  </Row>
                  {!!(fileTask === task.id) && (
                    <ProjectFiles
                      projectId={id}
                      taskId={task.id}
                      onManage={manageFiles}
                    />
                  )}
                  {!!expanded.has(task.id) && (
                    <PersonalNestedWork
                      tree={tree}
                      navigate={navigate}
                      readOnly={!active || !eligible || facts.loading}
                    />
                  )}
                </Card>
              )}
            </>
          )}
          {!!(view === "members") && (
            <>
              {data.members.map((member) => (
                <Row key={member.user_id}>
                  <Text style={{ flex: 1 }}>{member.name}</Text>
                  <Status value={member.state} />
                  <Text>
                    {member.user_id === data.owner ? "Owner" : member.access}
                  </Text>
                </Row>
              ))}
            </>
          )}
          {!!(view === "files") && (
            <ProjectFiles projectId={id} onManage={manageFiles} />
          )}
          {view === "activity" && (
            <ProjectActivity ids={[id, ...data.tasks.map((t) => t.id)]} />
          )}
          {!!editor && (
            <PersonalTaskSheet
              key={editor.mode + ":" + (editor.task?.id || "new")}
              {...editor}
              actor={profile!.id}
              members={data.members}
              busy={action.busy}
              run={async (command, payload) => {
                const saved = await action.run(command, payload);
                setEditor(undefined);
                return saved;
              }}
              onClose={() => setEditor(undefined)}
            />
          )}
        </>
      )}
    </Screen>
  );
}
