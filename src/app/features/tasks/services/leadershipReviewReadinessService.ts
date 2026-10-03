import { supabase } from "../../../../lib/supabase";
import { resolveLeadershipReviewer } from "../../../shared/organizationLeadership";

export async function assertTaskSubtasksReady(taskId: string): Promise<void> {
  const { data: unfinishedSubtasks, error } = await supabase
    .from("subtasks")
    .select("id")
    .eq("task_id", taskId)
    .eq("is_completed", false)
    .limit(1);
  if (error) throw new Error(error.message);
  if (unfinishedSubtasks && unfinishedSubtasks.length > 0) {
    throw new Error(
      "Every subtask must be approved before the parent task can be submitted.",
    );
  }
}

export async function assertLeadershipReviewReady(taskId: string): Promise<void> {
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("assigned_to,org_id,review_route_mode")
    .eq("id", taskId)
    .single();
  if (taskError) throw new Error(taskError.message);
  if (task.review_route_mode === "governance" || task.review_route_mode === "explicit") return;
  if (!task.org_id) throw new Error("Assign a responsible office before submitting this task.");
  if (!task.assigned_to) return;

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("head_user_id")
    .eq("id", task.org_id)
    .single();
  if (organizationError) throw new Error(organizationError.message);

  const resolution = resolveLeadershipReviewer(
    task.assigned_to,
    organization.head_user_id,
  );
  if (!resolution) return;

  const reviewerLabel = "Head";
  if (!resolution.reviewerId) {
    throw new Error(
      `Assign an active ${reviewerLabel} for this organization before submitting leadership work.`,
    );
  }

  const { data: reviewer, error: reviewerError } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", resolution.reviewerId)
    .single();
  if (reviewerError || !reviewer?.is_active) {
    throw new Error(
      `Assign an active ${reviewerLabel} for this organization before submitting leadership work.`,
    );
  }
}
