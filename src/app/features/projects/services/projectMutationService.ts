import { supabase } from '../../../../lib/supabase';
import { recordAudit } from '../../../services/auditService';
import { rowToProject } from './projectMappers';
import { notifyProjectListeners } from './projectQueryService';
import type { CreateProjectInput, Project } from './types';
import { archiveCompletedProject } from './projectLifecycleService';
import { ProjectMetadataConflict } from './projectMetadata';

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const title = input.title.trim();
  if (!title) throw new Error('Project title is required.');

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Your sign-in session has expired. Sign in again, then retry creating the project.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('org_id, is_active')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile?.is_active) {
    throw new Error('Your active eFlow profile could not be verified. Contact an administrator if this continues.');
  }

  let orgId = input.orgId ?? null;
  if (orgId === null) {
    orgId = (profile.org_id as string) || null;
  }

  const { data, error } = await supabase.rpc('create_project_with_details', {
    p_payload: {
      title,
      description: input.description || '',
      org_id: orgId,
      owner_id: input.ownerId || user.id,
      proposal_id: input.proposalId || null,
      proposal_title: input.proposalTitle || null,
      program_id: input.programId || null,
      program_title: input.programTitle || null,
      source_type: input.sourceType || 'standalone',
      source_file_name: input.sourceFileName || null,
      status: input.status || 'planning',
      priority: input.priority || 'medium',
      start_date: input.startDate || null,
      target_date: input.targetDate || null,
      member_ids: input.memberIds || [],
      milestones: (input.milestones || [])
        .filter((milestone) => milestone.title.trim())
        .map((milestone, sortOrder) => ({
          title: milestone.title.trim(),
          due_date: milestone.dueDate || null,
          sort_order: sortOrder,
        })),
    },
  });
  if (error) {
    if (error.code === 'PGRST202' || error.message.includes('create_project_with_details')) {
      throw new Error('The project database upgrade has not been applied yet. Apply the atomic project creation migration, then retry.');
    }
    throw error;
  }

  const projectRow = Array.isArray(data) ? data[0] : data;
  if (!projectRow) throw new Error('The database did not return the created project.');
  const project = rowToProject(projectRow as Record<string, unknown>);

  await recordAudit({
    entityType: 'project',
    entityId: project.id,
    action: 'project.created',
    afterData: { title: project.title, status: project.status, priority: project.priority },
    orgId,
  });

  await notifyProjectListeners();
  return project;
}

// ─── updateProject ───────────────────────────────────────────────
export async function updateProject(
  id: string,
  changes: Partial<Pick<Project, 'title' | 'description' | 'status' | 'priority' | 'startDate' | 'targetDate' | 'ownerId'>>,
  expectedVersion?: string,
): Promise<void> {
  const { data: before, error: readError } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
  if(readError)throw readError;
  if(!before)throw new Error('Project unavailable or access removed.');

  const row: Record<string, unknown> = {};
  if (changes.title !== undefined) row.title = changes.title;
  if (changes.description !== undefined) row.description = changes.description;
  if (changes.status !== undefined) row.status = changes.status;
  if (changes.priority !== undefined) row.priority = changes.priority;
  if (changes.startDate !== undefined) row.start_date = changes.startDate || null;
  if (changes.targetDate !== undefined) row.target_date = changes.targetDate || null;
  if (changes.ownerId !== undefined) row.owner_id = changes.ownerId || null;

  // Compatibility callers may still supply unchanged lifecycle/owner values.
  // They cannot change either through a generic metadata save.
  if(changes.status!==undefined&&changes.status!==before.status || changes.ownerId!==undefined&&(changes.ownerId||null)!==(before.owner_id||null))throw new Error('Use the project lifecycle or ownership workflow for this change.');
  delete row.status;delete row.owner_id;
  if(!expectedVersion)throw new Error('Refresh project details before saving.');
  const { error } = await supabase.rpc('update_project_metadata', {p_project_id:id,p_expected_updated_at:expectedVersion,p_changes:row});
  if(error){if(error.code==='40001')throw new ProjectMetadataConflict();throw error;}

  await recordAudit({
    entityType: 'project',
    entityId: id,
    action: 'project.updated',
    beforeData: before ? { title: before.title, status: before.status, priority: before.priority } : undefined,
    afterData: changes,
    orgId: (before?.org_id as string) || null,
  });
  await notifyProjectListeners();
}

// ─── archiveProject / restoreProject ─────────────────────────────
export async function archiveProject(id: string, reason?: string): Promise<void> {
  await archiveCompletedProject(id, reason);
}

export async function restoreProject(id: string, reason?: string): Promise<void> {
  const { data: before } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
  const { error } = await supabase
    .from('projects')
    .update({ status: 'active', archived_at: null })
    .eq('id', id);
  if (error) throw error;

  await recordAudit({
    entityType: 'project',
    entityId: id,
    action: 'project.restored',
    reason,
    beforeData: before ? { status: before.status } : undefined,
    afterData: { status: 'active' },
    orgId: (before?.org_id as string) || null,
  });
  await notifyProjectListeners();
}

/**
 * Permanently removes only the operational project container. Database foreign
 * keys retain task history and clear their project/milestone links; project
 * members and milestones are removed with the project.
 */
export async function deleteProject(
  id: string,
  expectedTitle: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc('delete_project_permanently', {
    p_project_id: id,
    p_expected_title: expectedTitle.trim(),
    p_reason: reason.trim(),
  });
  if (error) {
    if (error.code === 'PGRST202' || error.message.includes('delete_project_permanently')) {
      throw new Error('The project deletion database upgrade has not been applied yet.');
    }
    if (
      error.code === '23514'
      && error.message.includes('milestone link requires a canonical project link')
    ) {
      throw new Error('The project deletion task-link fix has not been applied yet. Apply migration 20260819000003, then retry.');
    }
    const details = [error.message, error.details, error.hint]
      .filter((value): value is string => Boolean(value && value !== error.message))
      .join(' ');
    throw new Error(details ? `${error.message} ${details}` : error.message);
  }
  await notifyProjectListeners();
}

// ─── Members ─────────────────────────────────────────────────────
