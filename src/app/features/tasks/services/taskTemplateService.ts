import { supabase } from "../../../../lib/supabase";
import type { TaskTemplate, TaskTemplateInput } from "../types";
import {recurringTemplateError} from '../validation/recurringValidation';

function mapTemplate(row: Record<string, unknown>): TaskTemplate {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) || "",
    priority: row.priority as TaskTemplate["priority"],
    tags: (row.tags as string[]) || [],
    acceptanceCriteria: (row.acceptance_criteria as string[]) || [],
    definitionOfDone: (row.definition_of_done as string) || undefined,
    orgId: (row.org_id as string) || undefined,
    assigneeId: (row.assignee_id as string) || undefined,
    reviewerId: (row.reviewer_id as string) || undefined,
    recurrenceRule: row.recurrence_rule as TaskTemplate["recurrenceRule"],
    nextRunAt: new Date(row.next_run_at as string).getTime(),
    isActive: Boolean(row.is_active),
    createdBy: row.created_by as string,
  };
}

export async function fetchTaskTemplates(): Promise<TaskTemplate[]> {
  const { data, error } = await supabase
    .from("task_templates")
    .select("*")
    .order("next_run_at");
  if (error) throw new Error(error.message);
  return (data || []).map(mapTemplate);
}

export async function createTaskTemplate(
  input: TaskTemplateInput,
): Promise<TaskTemplate> {
  const issue=recurringTemplateError(input);if(issue)throw new Error(issue);
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error("You must be signed in.");

  const { data, error } = await supabase
    .from("task_templates")
    .insert({
      title: input.title.trim(),
      description: input.description.trim(),
      priority: input.priority,
      tags: input.tags,
      acceptance_criteria: input.acceptanceCriteria,
      definition_of_done: input.definitionOfDone || null,
      org_id: input.orgId || null,
      assignee_id: input.assigneeId || null,
      reviewer_id: input.reviewerId || null,
      recurrence_rule: input.recurrenceRule,
      next_run_at: new Date(input.nextRunAt).toISOString(),
      is_active: input.isActive,
      created_by: authData.user.id,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapTemplate(data);
}

export async function setTaskTemplateActive(
  templateId: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("task_templates")
    .update({ is_active: isActive })
    .eq("id", templateId);
  if (error) throw new Error(error.message);
}

export async function deleteTaskTemplate(templateId: string): Promise<void> {
  const { error } = await supabase.from("task_templates").delete().eq("id", templateId);
  if (error) throw new Error(error.message);
}
