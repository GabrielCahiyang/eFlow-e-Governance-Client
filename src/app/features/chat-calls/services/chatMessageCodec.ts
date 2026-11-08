export interface ParsedMessage {
  text: string;
  replyToName?: string;
  replyToText?: string;
  reactions?: Record<string, string[]>;
}

export function parseMessage(content: string): ParsedMessage {
  try {
    if (content.startsWith("{") && content.endsWith("}")) {
      const parsed = JSON.parse(content);
      if (typeof parsed?.text === 'string') {
        const reactions = parsed.reactions && typeof parsed.reactions === 'object'
          ? Object.fromEntries(Object.entries(parsed.reactions).filter(([, names]) => Array.isArray(names))
            .map(([emoji, names]) => [emoji, (names as unknown[]).filter(name => typeof name === 'string')])) : undefined;
        return { text: parsed.text, replyToName: typeof parsed.replyToName === 'string' ? parsed.replyToName : undefined,
          replyToText: typeof parsed.replyToText === 'string' ? parsed.replyToText : undefined, reactions };
      }
    }
  } catch (e) {
    // Ignore
  }
  return { text: content };
}
