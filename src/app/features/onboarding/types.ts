export interface OnboardingRecord {
  user_id: string; tour_key: string; tour_version: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'dismissed'; current_step?: string;
  state: { completed_steps?: string[]; interests?: string[]; tour_progress?: unknown };
}
export interface ChecklistStep { id: string; label: string; section?: string; page?: string; action?: 'profile' | 'tour' | 'notifications'; }
