"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Check, AlertCircle, Info } from "lucide-react";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, kind = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="lg-toast-stack">
        {toasts.map((t) => (
          <div className="lg-toast" key={t.id}>
            {t.kind === "error" ? <AlertCircle size={16} /> : t.kind === "info" ? <Info size={16} /> : <Check size={16} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
