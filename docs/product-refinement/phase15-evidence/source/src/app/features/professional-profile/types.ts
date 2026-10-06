export const professionalFields = ['skills', 'education', 'trainings', 'certifications', 'work_experience', 'specializations'] as const;
export type ProfessionalField = typeof professionalFields[number];
export type ProfessionalValues = Record<ProfessionalField, string[]> & { competency_summary: string };
export type ProfessionalProfile = ProfessionalValues & { user_id: string; confirmed_by_user: boolean; confirmed_at: string | null; source: string; updated_at: string };
export interface PdsDocument { id: string; original_filename: string; processing_status: 'pending' | 'processing' | 'completed' | 'failed'; processing_error?: string; processed_at?: string; }
