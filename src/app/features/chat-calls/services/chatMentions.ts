export const CHAT_TEXT_LIMIT = 1000;

export type ChatMention = { id: string; label: string; start: number };
export type ChatDraft = { text: string; mentions: ChatMention[] };
export type MentionQuery = { start: number; end: number; term: string };

export function findMentionQuery(text: string, caret: number): MentionQuery | undefined {
  const match = /(?:^|[\s([{])@([\p{L}\p{M}\p{N}_.’'-]+(?: [\p{L}\p{M}\p{N}_.’'-]+)*|)$/u.exec(text.slice(0, caret));
  if (match) return { start: caret - match[1].length - 1, end: caret, term: match[1] };
}

export function editChatDraft(draft: ChatDraft, text: string): ChatDraft {
  let start = 0;
  while (start < text.length && text[start] === draft.text[start]) start++;
  let previousEnd = draft.text.length;
  let nextEnd = text.length;
  while (previousEnd > start && nextEnd > start && draft.text[previousEnd - 1] === text[nextEnd - 1]) {
    previousEnd--;
    nextEnd--;
  }
  return {
    text,
    mentions: draft.mentions.flatMap(mention => {
      if (mention.start + mention.label.length <= start) return [mention];
      if (mention.start >= previousEnd) return [{ ...mention, start: mention.start + nextEnd - previousEnd }];
      return [];
    }).filter(mention => isMentionAt(text, mention)),
  };
}

function isMentionAt(text: string, mention: ChatMention) {
  const end = mention.start + mention.label.length;
  return mention.start >= 0
    && text.slice(mention.start, end) === mention.label
    && (mention.start === 0 || /[\s([{]/.test(text[mention.start - 1]))
    && !/[\p{L}\p{M}\p{N}_@/-]/u.test(text[end] ?? '');
}

export function insertChatMention(draft: ChatDraft, query: MentionQuery, label: string, id?: string) {
  const suffix = draft.text.slice(query.end);
  const separator = /^\s/.test(suffix) ? '' : ' ';
  const text = draft.text.slice(0, query.start) + label + separator + suffix;
  if (text.length > CHAT_TEXT_LIMIT) return;
  const next = editChatDraft(draft, text);
  if (id) next.mentions.push({ id, label, start: query.start });
  return { draft: next, caret: query.start + label.length + 1 };
}

export function readChatMentions(value: unknown, text: string): ChatMention[] {
  if (!Array.isArray(value)) return [];
  return value.filter((mention): mention is ChatMention =>
    typeof mention?.id === 'string' && typeof mention.label === 'string'
    && mention.label.startsWith('@') && Number.isInteger(mention.start) && isMentionAt(text, mention),
  ).sort((a, b) => a.start - b.start);
}

export function mentionHighlights(text: string, mentions: ChatMention[], group: boolean) {
  const ranges = mentions.map(({ start, label }) => ({ start, label }));
  if (group) {
    for (const match of text.matchAll(/(^|[\s([{])(@everyone)(?![\p{L}\p{M}\p{N}_@/-])/giu)) {
      ranges.push({ start: match.index + match[1].length, label: match[2] });
    }
  }
  return ranges.sort((a, b) => a.start - b.start);
}
