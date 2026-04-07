import React, { createContext, useCallback, useContext, useState } from 'react';

type Toast = { id: string; title?: string; message: string; type?: 'info' | 'success' | 'error' };

const NotificationsContext = createContext({
  notify: (_: Omit<Toast, 'id'>) => {},
});

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((t: Omit<Toast, 'id'>) => {
    const id = String(Date.now()) + Math.random().toString(36).slice(2, 8);
    const toast: Toast = { id, ...t };
    setToasts((s) => [toast, ...s].slice(0, 6));
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), 6000);
  }, []);

  return (
    <NotificationsContext.Provider value={{ notify }}>
      {children}
      <div aria-live="polite" className="fixed top-4 right-4 z-60 flex flex-col gap-3">
        {toasts.map((t) => (
          <div key={t.id} className={`max-w-sm w-full rounded-xl p-3 shadow-md border bg-[color:var(--surface-raised)]`}>
            {t.title && <div className="text-sm font-bold mb-1">{t.title}</div>}
            <div className="text-sm" style={{ color: 'var(--text-2)' }}>{t.message}</div>
          </div>
        ))}
      </div>
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationsContext);

export default NotificationsProvider;
