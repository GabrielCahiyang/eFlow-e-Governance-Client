import { useEffect, useState } from 'react';
import { downloadChatImage } from '../services/chatImages';

export function ConversationImage({ path, thumbnail = false }: { path: string; thumbnail?: boolean }) {
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    setUrl(undefined);
    setError(false);
    downloadChatImage(path).then(image => {
      if (!active) return;
      objectUrl = URL.createObjectURL(image);
      setUrl(objectUrl);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path]);

  if (error || !url) return <span className="messages-image-state">{error ? 'Image unavailable' : 'Loading image…'}</span>;
  return <a className="messages-image" href={url} target="_blank" rel="noreferrer" aria-label="Open shared image">
    <img src={url} alt="Shared image" loading="lazy" data-thumbnail={thumbnail || undefined} onError={() => setError(true)} />
  </a>;
}
