import { WorkspaceTooltip } from "./workspace/WorkspaceTooltip";
import { useEffect, useRef, useState } from "react";
import { PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react";
import {
  ActiveCall,
  WebRTCSession,
  getLocalMedia,
  answerCall,
  endCall,
} from "../../services/callService";

export function CallModal({
  call,
  isCaller,
  onClose,
}: {
  call: ActiveCall;
  isCaller: boolean;
  onClose: () => void;
}) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<WebRTCSession | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let localStream: MediaStream;

    const setup = async () => {
      localStream = await getLocalMedia(call.callType);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

      const session = new WebRTCSession(call.id, isCaller);
      sessionRef.current = session;
      session.onRemoteStream = (stream) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
        setConnected(true);
      };
      session.onHangup = () => {
        endCall(call.id);
        onClose();
      };

      await session.start(localStream);
      if (!isCaller) await answerCall(call.id);
    };

    setup();

    return () => {
      localStream?.getTracks().forEach((t) => t.stop());
      sessionRef.current?.hangup();
    };
  }, [call.id]);

  const toggleMute = () => {
    const stream = localVideoRef.current?.srcObject as MediaStream;
    stream?.getAudioTracks().forEach((t) => (t.enabled = muted));
    setMuted(!muted);
  };

  const toggleCamera = () => {
    const stream = localVideoRef.current?.srcObject as MediaStream;
    stream?.getVideoTracks().forEach((t) => (t.enabled = cameraOff));
    setCameraOff(!cameraOff);
  };

  const otherPersonName = isCaller ? call.calleeName : call.callerName;

  return (
    <div className="fixed inset-0 bg-neutral-900 z-[100] flex flex-col items-center justify-center">
      {call.callType === "video" ? (
        <>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-24 right-4 w-28 h-40 rounded-xl object-cover border border-white/20"
          />
        </>
      ) : (
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-neutral-700 text-white flex items-center justify-center text-[28px] font-semibold mb-4">
            {otherPersonName?.[0] || "?"}
          </div>
          <video ref={localVideoRef} autoPlay playsInline muted className="hidden" />
        </div>
      )}

      <div className="absolute top-8 text-white text-center">
        <div className="text-[16px] font-medium">{otherPersonName}</div>
        <div className="text-[12px] text-white/60">{connected ? "Connected" : "Connecting\u2026"}</div>
      </div>

      <div className="absolute bottom-8 flex items-center gap-4">
        <WorkspaceTooltip content={muted ? "Unmute microphone" : "Mute microphone"}><button aria-label={muted ? "Unmute microphone" : "Mute microphone"}
          onClick={toggleMute}
          className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
        >
          {muted ? <MicOff size={20} /> : <Mic size={20} />}
        </button></WorkspaceTooltip>
        {call.callType === "video" && (
          <WorkspaceTooltip content={cameraOff ? "Turn camera on" : "Turn camera off"}><button aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}
            onClick={toggleCamera}
            className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
          >
            {cameraOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button></WorkspaceTooltip>
        )}
        <WorkspaceTooltip content="End call"><button aria-label="End call"
          onClick={() => sessionRef.current?.hangup()}
          className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700"
        >
          <PhoneOff size={20} />
        </button></WorkspaceTooltip>
      </div>
    </div>
  );
}

export default CallModal;
