export const PROJECT_FILE_BUCKET='project-library';
export const PROJECT_FILE_LIMIT=10*1024*1024;
export const PROJECT_FILE_TYPES=[
 'application/pdf','text/plain','image/png','image/jpeg',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;
export const PROJECT_FILE_ACCEPT=PROJECT_FILE_TYPES.join(',');
export function validateProjectFile(file:File):string {
 if (!file.size || file.size>PROJECT_FILE_LIMIT) return 'Choose a nonempty file up to 10 MB.';
 if (!PROJECT_FILE_TYPES.some(type=>type===file.type)) return 'Choose PDF, text, PNG, JPEG, DOCX or XLSX.';
 if (!file.name.trim() || file.name.trim().length>200 || /[/\\]/.test(file.name)) return 'Use a file name of 1–200 characters without path separators.';
 return '';
}
