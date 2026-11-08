import { supabase } from '../../../../lib/supabase';

const bucket = 'conversation-images';
const imageExtensions: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
};

export function validateChatImage(file: File) {
  if (!imageExtensions[file.type]) throw new Error('Choose a JPG, PNG, GIF, or WebP image.');
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('Choose an image up to 10 MB.');
}

export async function uploadChatImage(channel: string, actor: string, file: File) {
  validateChatImage(file);
  const path = channel + '/' + actor + '/' + crypto.randomUUID() + '.' + imageExtensions[file.type];
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw error;
  return path;
}

export async function downloadChatImage(path: string) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw error;
  return data;
}

export async function removeChatImage(path: string) {
  await supabase.storage.from(bucket).remove([path]);
}
