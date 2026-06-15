import React, { createContext, useContext, useState, useCallback, useRef } from "react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  warning: "⚠",
};

const STYLES: Record<ToastType, string> = {
  success: "bg-surface-900 text-white",
  error: "bg-red-600 text-white",
  info: "bg-surface-100 text-surface-800 border border-surface-200",
  warning: "bg-amber-50 text-amber-800 border border-amber-200",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++counterRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => dismiss(id), 3500);
  }, [dismiss]);

  const ctx: ToastContextValue = {
    toast,
    success: (m) => toast(m, "success"),
    error: (m) => toast(m, "error"),
    info: (m) => toast(m, "info"),
    warning: (m) => toast(m, "warning"),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div
        role="region"
        aria-live="polite"
        aria-label="알림"
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none max-w-sm w-full"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            className={`
              flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
              animate-in slide-in-from-bottom-3 fade-in duration-200 pointer-events-auto
              ${STYLES[t.type]}
            `}
          >
            <span className="shrink-0 font-bold">{ICONS[t.type]}</span>
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="알림 닫기"
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
