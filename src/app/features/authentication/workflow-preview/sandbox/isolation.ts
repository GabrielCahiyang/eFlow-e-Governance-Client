/** Each preview document owns its records, storage and connections. */
export function installPreviewIsolation() {
  function memoryStorage(): Storage {
    const values = new Map<string, string>();
    return {
      get length() { return values.size; },
      clear: () => values.clear(),
      getItem: key => values.get(key) ?? null,
      key: index => [...values.keys()][index] ?? null,
      removeItem: key => { values.delete(key); },
      setItem: (key, value) => { values.set(String(key), String(value)); },
    };
  }
  Object.defineProperty(window, "localStorage", { value: memoryStorage() });
  Object.defineProperty(window, "sessionStorage", { value: memoryStorage() });
  // The sample document cannot broadcast auth or navigation into the real app.
  Object.defineProperty(window, "BroadcastChannel", { value: undefined });
  Object.defineProperty(navigator, "sendBeacon", { value: () => false });
  Object.defineProperty(window, "WebSocket", { value: PreviewSocket });
}

class PreviewSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 0;
  binaryType = "arraybuffer";
  onopen?: (event: Event) => void;
  onmessage?: (event: MessageEvent) => void;
  onclose?: (event: CloseEvent) => void;
  onerror?: (event: Event) => void;
  constructor() {
    super();
    window.setTimeout(() => {
      if (this.readyState !== 0) return;
      this.readyState = 1;
      this.onopen?.(new Event("open"));
    }, 0);
  }
  send(raw: string) {
    const [join, ref, topic, event, payload] = JSON.parse(raw);
    if (event !== "phx_join" && event !== "heartbeat") return;
    const changes = (payload?.config?.postgres_changes || []).map((binding: object, index: number) => ({ ...binding, id: index + 1 }));
    window.setTimeout(() => {
      if (this.readyState === 1) this.onmessage?.(new MessageEvent("message", { data: JSON.stringify([join, ref, topic, "phx_reply", { status: "ok", response: { postgres_changes: changes } }]) }));
    }, 0);
  }
  close() { this.readyState = 3; }
}

