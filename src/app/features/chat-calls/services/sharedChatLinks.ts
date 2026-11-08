const linkPattern = /https?:\/\/[^\s<>"']+/gi;

export function splitMessageLinks(text: string) {
  const parts: { text: string; href?: string }[] = [];
  let cursor = 0;
  for (const match of text.matchAll(linkPattern)) {
    const start = match.index;
    const href = match[0].replace(/[.,;!?)\]]+$/, '');
    try {
      const url = new URL(href);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) continue;
      if (start > cursor) parts.push({ text: text.slice(cursor, start) });
      parts.push({ text: href, href: url.href });
      cursor = start + href.length;
    } catch { /* Keep malformed links as text. */ }
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

export function sharedLinkType(href: string) {
  const path = new URL(href).pathname;
  if (/\.(png|jpe?g|gif|webp|svg|mp4|webm|mp3|wav)$/i.test(path)) return 'Media';
  if (/\.(pdf|docx?|xlsx?|csv|zip|pptx?)$/i.test(path)) return 'Files';
  return 'Links';
}
