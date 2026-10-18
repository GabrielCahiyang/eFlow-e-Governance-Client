export interface WorkUpdate {
  state: 'in_progress' | 'stuck';
  blocker: string;
  note: string;
  nextStep: string;
  files: File[];
}
