import { useEffect, useState } from 'react';
import { HELP_STAGES } from '../constants';
import type { ConversationStage } from '../types';

export function HelpProcessingStatus({ stage }: { stage: ConversationStage }) {
  const [seconds, setSeconds] = useState(0);
  const busy = !['idle', 'listening'].includes(stage);
  useEffect(() => {
    setSeconds(0);
    if (!busy) return;
    const start = Date.now(), timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [stage, busy]);
  return <>{HELP_STAGES[stage]}{busy && seconds > 0 ? ` · ${seconds}s` : ''}</>;
}
