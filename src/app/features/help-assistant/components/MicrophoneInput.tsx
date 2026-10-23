import { CircleAlert, Mic } from 'lucide-react';
import type { ConversationStage, MicrophoneSignal } from '../types';
import { HELP_STAGES } from '../constants';

export function MicrophoneInput({ devices, deviceId, onChange, signal, active, disabled = false, stage }: {
  devices: MediaDeviceInfo[]; deviceId: string; onChange: (id: string) => void; signal: MicrophoneSignal; active: boolean; disabled?: boolean; stage?: ConversationStage;
}) {
  const processing = stage !== undefined && stage !== 'idle' && stage !== 'listening';
  const level = active && !processing ? Math.round(signal.level * 100) : 0;
  const label = processing ? HELP_STAGES[stage!] : !signal.receiving ? 'Starting microphone…' : signal.ending ? 'Finishing your turn…' : (signal.speaking ?? level > 2) ? 'Hearing speech' : 'Waiting for speech';
  return <div className="eflow-microphone">
    <div className="eflow-microphone__row">
      <label><Mic size={14}/><span className="sr-only">Microphone input</span><select aria-label="Microphone input" value={deviceId} disabled={disabled} onChange={event => onChange(event.target.value)}>
        <option value="">System default microphone</option>
        {devices.filter(device => device.deviceId).map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}
      </select></label>
      {(active || processing) && <><div className="eflow-microphone__meter" role="meter" aria-label="Microphone input level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={level}><span style={{ width: `${level}%` }}/></div><small>{label}</small></>}
    </div>
    {active && signal.label && <small className="eflow-microphone__device">Using: {signal.label}</small>}
    {active && !processing && signal.warning && <p className="eflow-microphone__warning" role="alert"><CircleAlert size={14}/>{signal.warning}</p>}
  </div>;
}
