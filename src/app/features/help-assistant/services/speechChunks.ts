import { speakHelpPart } from './helpApi';

/** Keep one chunk ahead while the browser plays. Every part is checked by the server. */
export async function* speechChunks(replyId: string, signal: AbortSignal): AsyncGenerator<Blob> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const fetchPart = (part: number) => speakHelpPart(replyId, controller.signal, part)
    .then(value => ({ value }), error => ({ error }));
  let pending = fetchPart(0);
  try {
    for (let part = 0; ; part++) {
      const result = await pending;
      if ('error' in result) throw result.error;
      if (controller.signal.aborted) return;
      const { audio, parts } = result.value;
      const more = part + 1 < Math.min(parts, 4);
      if (more) pending = fetchPart(part + 1);
      yield audio;
      if (!more) return;
    }
  } finally {
    controller.abort();
    signal.removeEventListener('abort', abort);
  }
}
