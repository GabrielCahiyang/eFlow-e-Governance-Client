import type { ConversationStage } from './types';

export const HELP_STAGES: Record<ConversationStage, string> = {
  idle: 'Ready when you are', listening: 'Listening', transcribing: 'Understanding your words',
  thinking: 'Checking eFlow', preparing: 'Preparing your spoken reply', speaking: 'Speaking',
};
