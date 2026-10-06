import { extractTextFromPdf } from '../../proposal-import';

export async function readProjectDocument(file: File): Promise<string> {
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose a document smaller than 20 MB.');
  const extension = file.name.toLowerCase().split('.').pop();
  let text: string;
  if (extension === 'pdf') text = await extractTextFromPdf(file);
  else if (['txt', 'md'].includes(extension || '')) text = await file.text();
  else throw new Error('Choose a PDF, text, or Markdown project document.');
  if (text.trim().split(/\s+/).length < 20) throw new Error('This document has too little readable text. For a scanned PDF, paste its extracted text instead.');
  if (text.length > 500000) throw new Error('Import this document in smaller sections (up to 500000 characters).');
  return text;
}
