// ─── Global Toast Notification System ────────────────────────────
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

import { createPortal } from "react-dom";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

let idCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast stack */}
      {typeof document !== "undefined" && createPortal(<div aria-live="polite" aria-atomic="false" className="eflow-toast-stack fixed top-4 right-4 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastNotification key={t.id} item={t} onDismiss={() => removeToast(t.id)} />
        ))}
      </div>, document.body)}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const typeIcons: Record<ToastType, string> = {
  success: "M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z",
  error: "M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z",
  warning: "M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM6.5 7h3l-.5 5h-2L6.5 7z",
  info: "M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm-1.5 4h1V12h1V8h1V7h-3v1z",
};

function ToastNotification({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {

  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      role={item.type === "error" ? "alert" : "status"}
      data-tone={item.type}
      className={`eflow-toast eflow-feedback pointer-events-auto max-w-sm rounded-[10px] border px-4 py-3 shadow-[0_4px_8px_rgba(0,0,0,0.20)] flex items-start gap-3 animate-[toast-in_0.18s_ease-out] `}
    >
      <svg viewBox="0 0 16 16" className={`w-4 h-4 shrink-0 mt-0.5 `} fill="currentColor">
        <path d={typeIcons[item.type]} />
      </svg>
      <span className="flex-1 text-[13px] font-normal">
        {item.message}
      </span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onDismiss}
        className="shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
        </svg>
      </button>
      <style>{`
        @keyframes toast-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
