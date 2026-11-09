import { readChatMentions, type ChatMention } from './chatMentions';

export interface ParsedMessage {
  text: string;
  replyToName?: string;
  replyToText?: string;
  reactions?: Record<string, string[]>;
  mentions?: ChatMention[];
}

export function parseMessage(content: string): ParsedMessage {
  try {
    if (content.startsWith("{") && content.endsWith("}")) {
      const parsed = JSON.parse(content);
      if (typeof parsed?.text === 'string') {
        const reactions = parsed.reactions && typeof parsed.reactions === 'object'
          ? Object.fromEntries(Object.entries(parsed.reactions).filter(([, names]) => Array.isArray(names))
            .map(([emoji, names]) => [emoji, (names as unknown[]).filter(name => typeof name === 'string')])) : undefined;
        const mentions = readChatMentions(parsed.mentions, parsed.text);
        return { text: parsed.text, replyToName: typeof parsed.replyToName === 'string' ? parsed.replyToName : undefined,
          replyToText: typeof parsed.replyToText === 'string' ? parsed.replyToText : undefined, reactions,
          ...(mentions.length ? { mentions } : {}) };
      }
    }
  } catch (e) {
    // Ignore
  }
  return { text: content };
}
