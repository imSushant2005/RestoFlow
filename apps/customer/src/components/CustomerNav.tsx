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
      className="customer-bottom-nav fixed bottom-0 left-0 right-0 z-[100] flex items-center justify-around px-6 pt-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-3xl border-t shadow-[0_-20px_50px_rgba(0,0,0,0.4)] transition-all animate-in slide-in-from-bottom duration-500"
      style={{
        background: 'rgba(13, 15, 20, 0.94)',
        borderColor: 'rgba(255, 255, 255, 0.06)',
        minHeight: 'calc(75px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={`group relative flex flex-col items-center gap-1.5 py-2 transition-all active:scale-95 ${
              item.active ? 'opacity-100' : 'opacity-60 hover:opacity-80'
            }`}
          >
            {item.active && (
              <div 
                className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-[2px] bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]"
              />
            )}
            <div 
              className={`p-2 rounded-2xl transition-all duration-300 ${
                item.active 
                  ? 'scale-110 bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                  : 'bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:scale-105'
              }`}
            >
              <Icon size={21} />
            </div>
            <span 
              className={`text-[9px] font-black uppercase tracking-[0.16em] transition-colors duration-300 ${
                item.active ? 'text-blue-500' : 'text-slate-500'
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
