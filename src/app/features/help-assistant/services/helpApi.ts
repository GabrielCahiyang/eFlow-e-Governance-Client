import { controlPanelFetch } from '../../../shared/controlPanelClient';
import type { HelpProject, HelpReply } from '../types';

export async function helpRequest<T>(operation: string, signal: AbortSignal, payload?: unknown): Promise<T> {
  const deadline = new AbortController();
  const abort = () => deadline.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) deadline.abort();
  const timer = window.setTimeout(abort, 210_000);
  try {
  const response = await controlPanelFetch(`/help-assistant/${operation}`, {
    method: payload === undefined ? 'GET' : 'POST', signal: deadline.signal, cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  }, { timeoutMs: 210_000, retryOnEndpointChange: false });
  const body = await response.json().catch(() => { throw new Error('The help service is temporarily unavailable. Please try again.'); });
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'eFlow AI could not finish. Please try again.');
  return body as T;
  } finally { window.clearTimeout(timer); signal.removeEventListener('abort', abort); }
}

export const loadHelpProjects = (signal: AbortSignal) => helpRequest<{ projects: HelpProject[] }>('projects', signal);
export const askHelp = (question: string, projectId: string, history: string[], signal: AbortSignal, mode: 'chat' | 'live' = 'chat') =>
  helpRequest<HelpReply>('chat', signal, { question, projectId: projectId || null, history: history.slice(-3), requestId: crypto.randomUUID(), mode });

export async function audioBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  return btoa(binary);
}

export async function transcribeHelp(blob: Blob, signal: AbortSignal) {
  return helpRequest<{ text: string }>('transcribe', signal, { audio: await audioBase64(blob) });
}

export async function speakHelpPart(replyId: string, signal: AbortSignal, part?: number): Promise<{ audio: Blob; parts: number }> {
  const result = await helpRequest<{ audio: string; mimeType: string; parts?: number }>('speech', signal, { replyId, ...(part === undefined ? {} : { part }) });
  const binary = atob(result.audio);
  return { audio: new Blob([Uint8Array.from(binary, character => character.charCodeAt(0))], { type: 'audio/wav' }), parts: result.parts || 1 };
}
export const speakHelp = async (replyId: string, signal: AbortSignal): Promise<Blob> => (await speakHelpPart(replyId, signal)).audio;
