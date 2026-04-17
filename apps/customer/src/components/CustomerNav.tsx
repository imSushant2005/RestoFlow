import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Utensils, LayoutDashboard, History } from 'lucide-react';
import { getActiveSessionForTenant } from '../lib/tenantStorage';

export function CustomerNav() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const activeSessionId = getActiveSessionForTenant(tenantSlug);

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
      className="customer-bottom-nav fixed bottom-0 left-0 right-0 z-[40] flex items-center justify-around px-6 pt-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-3xl border-t shadow-[0_-15px_40px_rgba(0,0,0,0.3)] transition-all animate-in slide-in-from-bottom"
      style={{
        background: 'rgba(10, 11, 15, 0.96)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        minHeight: 'calc(72px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-1 py-1.5 transition-all active:scale-90 ${
              item.active ? 'opacity-100' : 'opacity-70'
            }`}
          >
            <div 
              className={`p-1.5 rounded-xl transition-all ${
                item.active ? 'scale-110 shadow-lg shadow-blue-500/20' : ''
              }`}
              style={{ 
                background: item.active ? 'var(--brand)' : 'rgba(148, 163, 184, 0.12)',
                color: item.active ? '#fff' : '#e2e8f0'
              }}
            >
              <Icon size={20} />
            </div>
            <span 
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: item.active ? '#fff' : '#cbd5f5' }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
