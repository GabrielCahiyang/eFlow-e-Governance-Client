const types: Record<string, string[]> = {
  jpg: ['image/jpeg'], jpeg: ['image/jpeg'], png: ['image/png'], webp: ['image/webp'], pdf: ['application/pdf'],
  doc: ['application/msword'], docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls: ['application/vnd.ms-excel'], xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};
export const EVIDENCE_ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx';
export const PHOTO_ACCEPT = '.jpg,.jpeg,.png,.webp';
export function attachmentError(files: File[], { maxMb = 25, maxCount = 10, extensions = Object.keys(types) } = {}) {
  const unsupported = extensions.every(ext => ['jpg', 'jpeg', 'png', 'webp'].includes(ext))
    ? 'Choose a JPEG, PNG or WebP image.'
    : 'Choose a supported image, PDF, Word or Excel file.';
  if (files.length > maxCount) return `Choose up to ${maxCount} files.`;
  for (const file of files) {
    if (file.size > maxMb * 1024 * 1024) return `Each file must be ${maxMb} MB or smaller.`;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!extensions.includes(ext) || !types[ext] || file.type && file.type !== 'application/octet-stream' && !types[ext].includes(file.type.toLowerCase())) return unsupported;
  }
  return '';
}
