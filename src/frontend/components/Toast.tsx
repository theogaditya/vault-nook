/**
 * Nook Toast Notification System
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type, duration }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const typeStyles: Record<ToastType, { bg: string; border: string; icon: string }> = {
    success: { bg: 'rgba(34,197,94,0.12)', border: '#22c55e', icon: '✓' },
    error: { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', icon: '✕' },
    warning: { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b', icon: '⚠' },
    info: { bg: 'rgba(59,130,246,0.12)', border: '#3b82f6', icon: 'ℹ' },
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px', zIndex: 10000,
        display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '400px',
      }}>
        {toasts.map(toast => {
          const s = typeStyles[toast.type];
          return (
            <div key={toast.id} onClick={() => dismissToast(toast.id)} style={{
              background: s.bg, border: `1px solid ${s.border}`, borderRadius: '10px',
              padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px',
              backdropFilter: 'blur(12px)', cursor: 'pointer', color: '#e2e8f0',
              fontSize: '14px', fontFamily: "'Inter', sans-serif", boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              animation: 'slideInRight 0.3s ease-out',
            }}>
              <span style={{ fontSize: '16px', color: s.border, flexShrink: 0 }}>{s.icon}</span>
              <span style={{ flex: 1 }}>{toast.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
