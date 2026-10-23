export interface HelpProject { id: string; title: string; status: string; }
export interface HelpSource { id: string; title: string; text: string; kind: 'guide' | 'project' | 'task'; projectId?: string; taskId?: string; }
export interface HelpReply { answer: string; sources: HelpSource[]; notice: string; model: string; grounded: boolean; replyId: string; observedAt: number; knowledgeVersion: string; }
export interface HelpMessage { id: string; role: 'user' | 'assistant'; text: string; reply?: HelpReply; }
export type ConversationStage = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'preparing' | 'speaking';
export interface MicrophoneSignal { level: number; receiving: boolean; label: string; warning: string; speaking?: boolean; ending?: boolean; }
export const EMPTY_MICROPHONE: MicrophoneSignal = { level: 0, receiving: false, label: '', warning: '' };
