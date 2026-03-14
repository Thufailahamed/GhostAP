"use client";

import {
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
  useRef,
} from "react";
import { X, CheckCircle, AlertCircle, Info, ShieldAlert } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ConfirmState {
  message: string;
  resolve: (value: boolean) => void;
}

interface ToastContextType {
  showToast: (message: string, variant?: ToastVariant) => void;
  showConfirm: (message: string) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  showConfirm: async () => false,
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    [],
  );

  const showConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ message, resolve });
    });
  }, []);

  const handleConfirm = (result: boolean) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  const dismiss = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 border-2 font-mono text-sm font-bold uppercase tracking-widest shadow-[4px_4px_0px_0px] animate-in slide-in-from-right duration-300 ${
              toast.variant === "success"
                ? "bg-black border-terminal-green text-terminal-green shadow-terminal-green/30"
                : toast.variant === "error"
                  ? "bg-black border-terminal-red text-terminal-red shadow-terminal-red/30"
                  : "bg-black border-terminal-cyan text-terminal-cyan shadow-terminal-cyan/30"
            }`}
          >
            <span className="mt-0.5 flex-shrink-0">
              {toast.variant === "success" ? (
                <CheckCircle size={16} />
              ) : toast.variant === "error" ? (
                <AlertCircle size={16} />
              ) : (
                <Info size={16} />
              )}
            </span>
            <span className="flex-1 leading-snug normal-case">
              {toast.message}
            </span>
            <button
              onClick={() => dismiss(toast.id)}
              className="opacity-60 hover:opacity-100 flex-shrink-0 mt-0.5 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Themed Confirm Dialog */}
      {confirmState && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-black border-2 border-terminal-amber w-[420px] shadow-[0_0_40px_rgba(255,176,0,0.15)] font-mono animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="border-b-2 border-terminal-amber px-5 py-3 flex items-center gap-2">
              <ShieldAlert size={16} className="text-terminal-amber" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-terminal-amber">
                System Confirmation
              </span>
            </div>
            {/* Body */}
            <div className="px-5 py-5">
              <p className="text-sm text-terminal-green leading-relaxed">
                {confirmState.message}
              </p>
            </div>
            {/* Actions */}
            <div className="border-t border-terminal-amber/30 px-5 py-3 flex justify-end gap-3">
              <button
                onClick={() => handleConfirm(false)}
                className="px-5 py-2 border border-terminal-green/50 text-terminal-green text-xs font-bold uppercase tracking-widest hover:bg-terminal-green/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirm(true)}
                className="px-5 py-2 bg-terminal-amber text-black text-xs font-bold uppercase tracking-widest hover:bg-yellow-400 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
