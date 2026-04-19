import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  CreditCard,
  ExternalLink,
  IndianRupee,
  Mail,
  Phone,
  Settings,
  UserCircle2,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import { getCustomerAppUrl } from '../lib/network';
import { useLanguage } from '../contexts/LanguageContext';

type DashboardRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'KITCHEN' | 'WAITER' | 'UNKNOWN';

export type OpsNotification = {
  id: string;
  title: string;
  message: string;
  level: 'info' | 'warning' | 'success' | 'error';
  createdAt: string;
  read: boolean;
  metadata?: {
    tableId?: string;
    tableName?: string;
    sessionId?: string;
    type?: string;
  };
};

type VendorTopNavProps = {
  path: string;
  role: DashboardRole;
  business?: {
    businessName?: string;
    slug?: string;
    email?: string;
    phone?: string;
    plan?: string;
  } | null;
  billing?: {
    plan?: string;
  } | null;
  liveOrderCount: number;
  canAccessSettings: boolean;
  canAccessBilling: boolean;
  notifications: OpsNotification[];
  unreadNotificationCount: number;
  onMarkNotificationsRead: () => void;
  onClearNotifications: () => void;
  onNotificationClick?: (notification: OpsNotification) => void;
  onLogout: () => void;
};

type AuthMeResponse = {
  tenant?: {
    businessName?: string;
    slug?: string;
    currencySymbol?: string;
  } | null;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    preferredLanguage?: string;
    avatarUrl?: string | null;
    hasSecurityQuestion?: boolean;
    securitySetupPending?: boolean;
    tipsSummary?: {
      today?: { amount: number; sessions: number };
      week?: { amount: number; sessions: number };
      month?: { amount: number; sessions: number };
    };
  } | null;
};

const ROUTE_LABELS: Record<string, string> = {
  '/app': 'Dashboard',
  '/app/menu': 'Menu',
  '/app/tables': 'Tables & QR',
  '/app/orders': 'Live Orders',
  '/app/assisted-ordering': 'Assisted Ordering',
  '/app/waiter': 'Waiter Ops',
  '/app/billing': 'Billing',
  '/app/analytics': 'Analytics',
  '/app/settings': 'Settings',
};

function roleLabel(role: DashboardRole) {
  if (role === 'OWNER') return 'Owner';
  if (role === 'MANAGER') return 'Manager';
  if (role === 'CASHIER') return 'Cashier';
  if (role === 'KITCHEN') return 'Kitchen';
  if (role === 'WAITER') return 'Waiter';
  return 'Staff';
}

function safeDateLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  return format(parsed, 'MMM d, h:mm a');
}

function levelDot(level: OpsNotification['level']) {
  if (level === 'success') return '#10b981';
  if (level === 'warning') return '#f59e0b';
  if (level === 'error') return '#ef4444';
  return '#3b82f6';
}

function formatMoney(symbol: string, amount?: number) {
  const safeAmount = Number(amount || 0);
  return `${symbol}${safeAmount.toFixed(0)}`;
}



export function VendorTopNav({
  path,
  role,
  business,
  billing,
  liveOrderCount,
  canAccessSettings,
  canAccessBilling,
  notifications,
  unreadNotificationCount,
  onMarkNotificationsRead,
  onClearNotifications,
  onNotificationClick,
  onLogout,
}: VendorTopNavProps) {
  const navigate = useNavigate();
  const { lang, setLang, t } = useLanguage();
  const [now, setNow] = useState(() => new Date());
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const headerLabel = ROUTE_LABELS[path] || 'Overview';
  const formattedNow = format(now, 'MMM d, yyyy | h:mm a');
  const planName = (billing?.plan || business?.plan || 'FREE').toUpperCase();

  const { data: authMe } = useQuery<AuthMeResponse>({
    queryKey: ['auth-me'],
    queryFn: async () => (await api.get('/auth/me?includeTips=true')).data,
    enabled: profileOpen,
    staleTime: 1000 * 60,
    retry: false,
  });

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    document.title = `${headerLabel} | Restoflow Dashboard`;
  }, [headerLabel]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  useEffect(() => {
    if (!notificationsOpen || unreadNotificationCount === 0) return;
    onMarkNotificationsRead();
  }, [notificationsOpen, onMarkNotificationsRead, unreadNotificationCount]);

  const orderLink = useMemo(() => {
    const slug = business?.slug?.trim() || authMe?.tenant?.slug?.trim();
    if (!slug) return '';
    return `${getCustomerAppUrl()}/order/${slug}`;
  }, [authMe?.tenant?.slug, business?.slug]);

  const visibleNotifications = useMemo(() => notifications.slice(0, 20), [notifications]);
  const currencySymbol = authMe?.tenant?.currencySymbol || '₹';
  const workspaceName = business?.businessName?.trim() || authMe?.tenant?.businessName?.trim() || 'Workspace';
  const workspaceEmail = authMe?.user?.email?.trim() || business?.email?.trim() || 'No email set';
  const workspacePhone = business?.phone?.trim() || 'No phone set';
  const securityPending = Boolean(authMe?.user?.securitySetupPending);

  return (
    <header
      className="relative z-[100] flex flex-wrap items-center justify-between gap-2 rounded-xl px-2 py-1.5 sm:px-3 sm:py-2 shadow-sm backdrop-blur-md"
      style={{ border: '1px solid var(--border)', background: 'var(--sidebar-bg)' }}
    >
      <div className="min-w-0 py-0.5">
        <h1
          className="truncate text-base font-black tracking-tight sm:text-xl leading-tight"
          style={{ color: 'var(--text-1)', fontFamily: 'var(--font-main)' }}
        >
          {headerLabel}
        </h1>
        <p
          className="mt-0 flex flex-wrap items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.1em]"
          style={{ color: 'var(--text-3)' }}
        >
          <span className="hidden xs:inline">{formattedNow}</span>
          <span className="rounded-full px-1.5 py-0.5" style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}>
            LIVE: {liveOrderCount}
          </span>
          {role === 'WAITER' && (
            <span className="rounded-full px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              WAITER
            </span>
          )}
        </p>
      </div>

      <div className="relative flex items-center gap-2">
        <div className="relative" ref={notificationRef}>
          <button
            id="nav-notifications-btn"
            onClick={() => setNotificationsOpen((prev) => !prev)}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border transition"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-2)' }}
            title="Notifications"
          >
            <Bell size={17} />
            {unreadNotificationCount > 0 && (
              <span
                className="absolute -right-1 -top-1 min-w-[18px] rounded-full px-1 text-center text-[10px] font-black"
                style={{ background: '#ef4444', color: '#ffffff' }}
              >
                {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div
              className="absolute right-0 top-12 z-50 w-[min(340px,calc(100vw-1rem))] overflow-hidden rounded-2xl border shadow-xl"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <p className="text-xs font-black uppercase tracking-[0.12em]" style={{ color: 'var(--text-2)' }}>
                  Notifications
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={onMarkNotificationsRead}
                    className="rounded-md px-2 py-1 text-[10px] font-bold uppercase"
                    style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}
                  >
                    Mark Read
                  </button>
                  <button
                    onClick={onClearNotifications}
                    className="rounded-md px-2 py-1 text-[10px] font-bold uppercase"
                    style={{ background: 'var(--surface-3)', color: '#ef4444' }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
                {visibleNotifications.length === 0 && (
                  <p className="px-3 py-4 text-sm font-semibold" style={{ color: 'var(--text-3)' }}>
                    No notifications yet.
                  </p>
                )}
                {visibleNotifications.map((entry) => (
                  <div
                    key={entry.id}
                    onClick={() => onNotificationClick?.(entry)}
                    className="flex gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50/5 transition-colors"
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: entry.read ? 'transparent' : 'var(--surface-2)',
                    }}
                  >
                    <span
                      className="mt-1 h-2 w-2 rounded-full"
                      style={{ background: levelDot(entry.level), boxShadow: `0 0 0 3px ${levelDot(entry.level)}22` }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-black" style={{ color: 'var(--text-1)' }}>
                        {entry.title}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium" style={{ color: 'var(--text-2)' }}>
                        {entry.message}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--text-3)' }}>
                        {safeDateLabel(entry.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => canAccessSettings && navigate('/app/settings')}
          disabled={!canAccessSettings}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-50"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-2)' }}
          title="Settings"
        >
          <Settings size={17} />
        </button>

        <div className="relative" ref={profileRef}>
          <button
            id="nav-profile-btn"
            onClick={() => setProfileOpen((prev) => !prev)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-2.5 transition"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-2)' }}
            title="Profile"
          >
            <UserCircle2 size={18} />
            <ChevronDown size={14} className={profileOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>

          {profileOpen && (
            <div
              className="absolute right-0 top-12 z-50 w-[min(380px,calc(100vw-1rem))] overflow-y-auto max-h-[calc(100vh-80px)] rounded-2xl border shadow-xl custom-scrollbar"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black" style={{ color: 'var(--text-1)' }}>
                      {workspaceName}
                    </p>
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-3)' }}>
                      {roleLabel(role)} | {planName} Plan
                    </p>
                  </div>
                  {securityPending && (
                    <span
                      className="inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em]"
                      style={{ background: '#fef3c7', color: '#92400e' }}
                    >
                      Security Pending
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-4 px-5 py-4">


                <div className="space-y-2 rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-2)' }}>
                    <Mail size={14} />
                    <span className="truncate font-semibold">{workspaceEmail}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-2)' }}>
                    <Phone size={14} />
                    <span className="truncate font-semibold">{workspacePhone}</span>
                  </div>
                </div>

                {role === 'WAITER' && (
                  <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                    <div className="mb-3 flex items-center gap-2">
                      <IndianRupee size={15} className="text-emerald-600" />
                      <p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: 'var(--text-3)' }}>
                        Tip Summary
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Today', value: authMe?.user?.tipsSummary?.today?.amount, sessions: authMe?.user?.tipsSummary?.today?.sessions },
                        { label: 'Week', value: authMe?.user?.tipsSummary?.week?.amount, sessions: authMe?.user?.tipsSummary?.week?.sessions },
                        { label: 'Month', value: authMe?.user?.tipsSummary?.month?.amount, sessions: authMe?.user?.tipsSummary?.month?.sessions },
                      ].map((entry) => (
                        <div key={entry.label} className="rounded-xl border p-2.5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                          <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--text-3)' }}>
                            {entry.label}
                          </p>
                          <p className="mt-2 text-base font-black" style={{ color: 'var(--text-1)' }}>
                            {formatMoney(currencySymbol, entry.value)}
                          </p>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--text-3)' }}>
                            {Number(entry.sessions || 0)} sessions
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => orderLink && window.open(orderLink, '_blank', 'noopener,noreferrer')}
                  disabled={!orderLink}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' }}
                >
                  <ExternalLink size={14} />
                  Open Public Ordering
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => canAccessBilling && navigate('/app/billing')}
                    disabled={!canAccessBilling}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] transition disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' }}
                  >
                    <CreditCard size={13} />
                    Invoices
                  </button>
                  <button
                    onClick={() => canAccessBilling && navigate('/app/subscription')}
                    disabled={!canAccessBilling}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] transition disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--brand)' }}
                  >
                    <Zap size={13} />
                    Plans
                  </button>
                </div>
                <div className="px-5 pb-2">
                  <p className="mb-2 text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>Language / Bhasha</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLang('en')}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-black transition-all ${
                        lang === 'en' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' : ''
                      }`}
                      style={lang !== 'en' ? { borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' } : {}}
                    >
                      🇬🇧 English
                    </button>
                    <button
                      onClick={() => setLang('hi')}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-black transition-all ${
                        lang === 'hi' ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20' : ''
                      }`}
                      style={lang !== 'hi' ? { borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' } : {}}
                    >
                      🙏 Hinglish
                    </button>
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  className="mx-5 mb-5 inline-flex w-[calc(100%-2.5rem)] items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-black text-white transition"
                  style={{ background: '#ef4444' }}
                >
                  {t('nav.logout')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
