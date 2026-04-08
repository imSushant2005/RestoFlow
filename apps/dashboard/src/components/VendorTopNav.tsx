import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Bell,
  ChevronDown,
  Copy,
  CreditCard,
  ExternalLink,
  LogOut,
  Mail,
  Phone,
  Settings,
  UserCircle2,
} from 'lucide-react';
import { getCustomerAppUrl } from '../lib/network';

type DashboardRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'KITCHEN' | 'WAITER' | 'UNKNOWN';

export type OpsNotification = {
  id: string;
  title: string;
  message: string;
  level: 'info' | 'warning' | 'success';
  createdAt: string;
  read: boolean;
};

type VendorTopNavProps = {
  path: string;
  role: DashboardRole;
  business?: {
    businessName?: string;
    slug?: string;
    email?: string;
    phone?: string;
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
  onLogout: () => void;
};

const ROUTE_LABELS: Record<string, string> = {
  '/app': 'Dashboard',
  '/app/menu': 'Menu',
  '/app/tables': 'Tables & QR',
  '/app/orders': 'Live Orders',
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
  return '#3b82f6';
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
  onLogout,
}: VendorTopNavProps) {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const headerLabel = ROUTE_LABELS[path] || 'Overview';
  const formattedNow = format(now, 'MMM d, yyyy | h:mm a');
  const planName = (billing?.plan || 'FREE').toUpperCase();

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

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
    const slug = business?.slug?.trim();
    if (!slug) return '';
    return `${getCustomerAppUrl()}/order/${slug}`;
  }, [business?.slug]);

  const visibleNotifications = useMemo(() => notifications.slice(0, 20), [notifications]);

  const copyOrderLink = async () => {
    if (!orderLink) {
      alert('Ordering link unavailable. Complete business setup first.');
      return;
    }
    try {
      await navigator.clipboard?.writeText(orderLink);
      alert('Ordering link copied.');
    } catch {
      alert('Could not copy link on this browser.');
    }
  };

  return (
    <header
      className="relative flex flex-wrap items-center justify-between gap-3 rounded-2xl px-2 py-2 sm:px-3 shadow-sm backdrop-blur-md"
      style={{ border: '1px solid var(--border)', background: 'var(--sidebar-bg)' }}
    >
      <div className="min-w-0">
        <h1
          className="truncate text-lg font-black tracking-tight sm:text-xl"
          style={{ color: 'var(--text-1)', fontFamily: 'var(--font-display)' }}
        >
          Dashboard / {headerLabel}
        </h1>
        <p
          className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em]"
          style={{ color: 'var(--text-3)' }}
        >
          <span>{formattedNow}</span>
          <span className="rounded-full px-2 py-0.5" style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}>
            Live Orders {liveOrderCount}
          </span>
        </p>
      </div>

      <div className="relative flex items-center gap-2">
        <div className="relative" ref={notificationRef}>
          <button
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
              className="absolute right-0 top-12 z-50 w-[340px] overflow-hidden rounded-2xl border shadow-xl"
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
                    className="flex gap-2 px-3 py-2"
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
              className="absolute right-0 top-12 z-50 w-[320px] overflow-hidden rounded-2xl border shadow-xl"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                <p className="truncate text-base font-black" style={{ color: 'var(--text-1)' }}>
                  {business?.businessName?.trim() || 'Workspace'}
                </p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-3)' }}>
                  {roleLabel(role)} | {planName} Plan
                </p>
              </div>

              <div className="space-y-2 px-4 py-3">
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-2)' }}>
                  <Mail size={14} />
                  <span className="truncate font-semibold">{business?.email?.trim() || 'No email set'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-2)' }}>
                  <Phone size={14} />
                  <span className="truncate font-semibold">{business?.phone?.trim() || 'No phone set'}</span>
                </div>
              </div>

              <div className="space-y-2 px-4 pb-4">
                <button
                  onClick={copyOrderLink}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' }}
                >
                  <Copy size={14} />
                  Copy Ordering Link
                </button>
                <button
                  onClick={() => orderLink && window.open(orderLink, '_blank', 'noopener,noreferrer')}
                  disabled={!orderLink}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' }}
                >
                  <ExternalLink size={14} />
                  Open Customer View
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => canAccessBilling && navigate('/app/billing')}
                    disabled={!canAccessBilling}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.08em] transition disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' }}
                  >
                    <CreditCard size={13} />
                    Billing
                  </button>
                  <button
                    onClick={() => canAccessSettings && navigate('/app/settings')}
                    disabled={!canAccessSettings}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.08em] transition disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' }}
                  >
                    <Settings size={13} />
                    Profile
                  </button>
                </div>
                <button
                  onClick={onLogout}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-black text-white transition"
                  style={{ background: '#ef4444' }}
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
