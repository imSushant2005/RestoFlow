import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, Info, AlertTriangle, XCircle } from 'lucide-react';

type Toast = { 
  id: string; 
  title?: string; 
  message: string; 
  type?: 'info' | 'success' | 'warning' | 'error' 
};

const NotificationsContext = createContext({
  notify: (_: Omit<Toast, 'id'>) => {},
});

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((t: Omit<Toast, 'id'>) => {
    const id = String(Date.now()) + Math.random().toString(36).slice(2, 8);
    const toast: Toast = { id, type: 'info', ...t };
    setToasts((s) => [toast, ...s].slice(0, 6));
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), 6000);
  }, []);

  const getToastIcon = (type?: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="text-emerald-500" size={20} />;
      case 'warning': return <AlertTriangle className="text-amber-500" size={20} />;
      case 'error': return <XCircle className="text-red-500" size={20} />;
      default: return <Info className="text-blue-500" size={20} />;
    }
  };

  return (
    <NotificationsContext.Provider value={{ notify }}>
      {children}
      <div aria-live="polite" className="fixed top-6 right-6 z-[100] flex flex-col gap-4 max-w-[calc(100vw-48px)] w-80">
        {toasts.map((t) => (
          <div 
            key={t.id} 
            className="flex items-start gap-3 p-4 rounded-2xl shadow-[0_12px_40px_-8px_rgba(0,0,0,0.15)] border backdrop-blur-xl animate-in fade-in slide-in-from-right-4 duration-300"
            style={{ 
              background: 'var(--surface-raised)', 
              borderColor: 'var(--border)'
            }}
          >
            <div className="flex-shrink-0 mt-0.5">
              {getToastIcon(t.type)}
            </div>
            <div className="flex-1 min-w-0">
              {t.title && <div className="text-sm font-black mb-0.5" style={{ color: 'var(--text-1)' }}>{t.title}</div>}
              <div className="text-xs font-medium leading-relaxed" style={{ color: 'var(--text-2)' }}>{t.message}</div>
            </div>
          </div>
        ))}
      </div>
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationsContext);

export default NotificationsProvider;
