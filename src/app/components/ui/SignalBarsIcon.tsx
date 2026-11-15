import type { ConnectivityStatus } from "../../shared/networkConnectivity";

interface SignalBarsIconProps {
  status: Exclude<ConnectivityStatus, "online">;
  size?: number;
}

/** Crisp 4-bar signal icon: 1 active bar for slow, slashed bars for offline. */
export function SignalBarsIcon({ status, size = 15 }: SignalBarsIconProps) {
  const offline = status === "offline";
  return (
    <svg
      aria-hidden="true"
      className="eflow-connectivity-icon"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
    >
      <rect
        x="1.5"
        y="10.5"
        width="2.2"
        height="3.5"
        rx="0.6"
        fill="currentColor"
        opacity={offline ? 0.35 : 1}
      />
      <rect
        x="5.1"
        y="8"
        width="2.2"
        height="6"
        rx="0.6"
        fill="currentColor"
        opacity={0.28}
      />
      <rect
        x="8.7"
        y="5"
        width="2.2"
        height="9"
        rx="0.6"
        fill="currentColor"
        opacity={0.28}
      />
      <rect
        x="12.3"
        y="2"
        width="2.2"
        height="12"
        rx="0.6"
        fill="currentColor"
        opacity={0.28}
      />
      {offline && (
        <path
          d="M2.2 2.2L13.8 13.8"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
