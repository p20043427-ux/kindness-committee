import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { Check, X, Info, AlertTriangle, type LucideIcon } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, action?: ToastAction) => void;
  success: (message: string, action?: ToastAction) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, LucideIcon> = {
  success: Check,
  error: X,
  info: Info,
  warning: AlertTriangle,
};

const STYLES: Record<ToastType, string> = {
  success: "bg-surface-900 text-white",
  error: "bg-red-600 text-white",
  info: "bg-surface-100 text-surface-800 border border-surface-200",
  warning: "bg-amber-50 text-amber-800 border border-amber-200",
};

const ACTION_STYLES: Record<ToastType, string> = {
  success: "text-white/80 hover:text-white border border-white/30 hover:border-white/60",
  error: "text-white/80 hover:text-white border border-white/30 hover:border-white/60",
  info: "text-surface-600 hover:text-surface-900 border border-surface-300 hover:border-surface-500",
  warning: "text-amber-700 hover:text-amber-900 border border-amber-300 hover:border-amber-500",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "success", action?: ToastAction) => {
    const id = ++counterRef.current;
    setToasts(prev => [...prev, { id, message, type, action }]);
    // Action toasts stay longer (5 seconds) to give time for undo
    setTimeout(() => dismiss(id), action ? 5000 : 3500);
  }, [dismiss]);

  const ctx: ToastContextValue = {
    toast,
    success: (m, action) => toast(m, "success", action),
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
              flex items-center gap-3 px-4 py-3 rounded shadow-md text-xs font-medium
              animate-in slide-in-from-bottom-3 fade-in duration-200 pointer-events-auto
              ${STYLES[t.type]}
            `}
          >
            {React.createElement(ICONS[t.type], { className: "w-4 h-4 shrink-0", "aria-hidden": true })}
            <span className="flex-1 leading-snug">{t.message}</span>
            {t.action && (
              <button
                onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${ACTION_STYLES[t.type]}`}
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              aria-label="알림 닫기"
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            ><X className="w-4 h-4" aria-hidden /></button>
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
