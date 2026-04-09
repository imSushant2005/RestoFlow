import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Utensils, History, LayoutDashboard } from 'lucide-react';
import { getActiveSessionForTenant } from '../lib/tenantStorage';
import { useMemo } from 'react';

export function CustomerNav() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const activeSessionId = useMemo(() => getActiveSessionForTenant(tenantSlug), [tenantSlug]);

  const navItems = [
    {
      label: 'Menu',
      icon: Utensils,
      path: `/order/${tenantSlug}`,
      active: location.pathname === `/order/${tenantSlug}` || location.pathname.includes('/menu'),
    },
    ...(activeSessionId ? [{
      label: 'Tracker',
      icon: LayoutDashboard,
      path: `/order/${tenantSlug}/session/${activeSessionId}`,
      active: location.pathname.includes('/session/'),
    }] : []),
    {
      label: 'History',
      icon: History,
      path: `/order/${tenantSlug}/history`,
      active: location.pathname.includes('/history'),
    },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-[60] pb-safe pt-2 px-6 flex items-center justify-around backdrop-blur-xl border-t shadow-[0_-10px_20px_rgba(0,0,0,0.05)]"
      style={{ 
        background: 'rgba(255, 255, 255, 0.85)', 
        borderColor: 'rgba(0, 0, 0, 0.05)',
      }}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-1 py-1.5 transition-all active:scale-90 ${
              item.active ? 'opacity-100' : 'opacity-40 grayscale'
            }`}
          >
            <div 
              className={`p-1.5 rounded-xl transition-all ${
                item.active ? 'scale-110 shadow-lg' : ''
              }`}
              style={{ 
                background: item.active ? 'var(--brand)' : 'transparent',
                color: item.active ? '#fff' : 'var(--text-3)'
              }}
            >
              <Icon size={20} />
            </div>
            <span 
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: item.active ? 'var(--brand)' : 'var(--text-3)' }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
