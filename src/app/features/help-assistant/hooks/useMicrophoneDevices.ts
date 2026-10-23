import { useCallback, useEffect, useState } from 'react';

export function useMicrophoneDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const refresh = useCallback(async () => {
    try {
      const entries = await navigator.mediaDevices?.enumerateDevices?.();
      if (entries) setDevices(entries.filter(item => item.kind === 'audioinput' && !['default', 'communications'].includes(item.deviceId)));
    } catch { /* Capture reports permission errors; enumeration is optional. */ }
  }, []);
  useEffect(() => {
    void refresh(); navigator.mediaDevices?.addEventListener?.('devicechange', refresh);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', refresh);
  }, [refresh]);
  return { devices, deviceId, setDeviceId, refresh };
}
