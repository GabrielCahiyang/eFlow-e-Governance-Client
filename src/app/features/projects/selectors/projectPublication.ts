import type { Project } from '../services/types';
/** Missing marker is historical published data, never inferred from planning status. */
export const isProjectDraft = (project: Project) => project.publicationState === 'draft';
export const isOpenProject = (project: Project) => !isProjectDraft(project) && project.status !== 'archived';
