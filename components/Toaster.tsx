"use client";
import { useEffect, useState } from "react";
import { subscribeToToasts, type ToastMessage } from "../lib/toast";

const VISIBLE_MS = 3200;

/**
 * Confirmation toasts, shaped like little ticket stubs.
 *
 * Mounted once in the root layout. Actions across the app previously completed
 * in total silence — saving a display name gave no sign it had worked — so this
 * is the shared "yes, that happened" channel.
 *
 * aria-live is polite so a screen reader announces it without interrupting.
 */
export default function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return subscribeToToasts((message) => {
      setToasts((current) => [...current, message]);
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== message.id));
      }, VISIBLE_MS);
    });
  }, []);

  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          <span className="toast-icon" aria-hidden="true">
            {t.tone === "success" ? (
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12.5l5 5L20 6.5" className="toast-check" />
              </svg>
            ) : t.tone === "error" ? (
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <path d="M12 7v6" />
                <path d="M12 17h.01" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M12 11v6" />
                <path d="M12 7h.01" />
              </svg>
            )}
          </span>
          <span className="toast-text">{t.text}</span>
        </div>
      ))}
    </div>
  );
}
