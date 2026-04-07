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
  Sparkles,
  UserCircle2,
} from 'lucide-react';
import { getCustomerAppUrl } from '../lib/network';

type DashboardRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'KITCHEN' | 'WAITER' | 'UNKNOWN';

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
  onLogout: () => void;
};

const ROUTE_LABELS: Record<string, string> = {
  '/app': 'Menu Builder',
  '/app/tables': 'Tables & QR',
  '/app/orders': 'Overview',
  '/app/billing': 'Billing',
  '/app/analytics': 'Analytics',
  '/app/settings': 'Settings',
};

function roleLabel(role: DashboardRole) {
  switch (role) {
    case 'OWNER':
      return 'Owner';
    case 'MANAGER':
      return 'Manager';
    case 'CASHIER':
      return 'Cashier';
    case 'KITCHEN':
      return 'Kitchen';
    case 'WAITER':
      return 'Waiter';
    default:
      return 'Staff';
  }
}

export function VendorTopNav({
  path,
  role,
  business,
  billing,
  liveOrderCount,
  canAccessSettings,
  canAccessBilling,
  onLogout,
}: VendorTopNavProps) {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const headerLabel = ROUTE_LABELS[path] || 'Overview';
  const formattedNow = format(now, 'MMM d, yyyy | h:mm a').toUpperCase();
  const planName = (billing?.plan || 'FREE').toUpperCase();

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!profileRef.current) return;
      if (profileRef.current.contains(event.target as Node)) return;
      setProfileOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const orderLink = useMemo(() => {
    const slug = business?.slug?.trim();
    if (!slug) return '';
    return `${getCustomerAppUrl()}/order/${slug}`;
  }, [business?.slug]);

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
      className="relative overflow-visible rounded-3xl border border-slate-700/70 p-3 shadow-2xl"
      style={{
        background:
          'radial-gradient(110% 140% at 75% 0%, rgba(37, 99, 235, 0.28), transparent 58%), linear-gradient(135deg, #0b1424 0%, #0f1f3f 48%, #0d1626 100%)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <div className="rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-blue-100">
            Restaurant Ops
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-black leading-none text-white sm:text-5xl">
              Dashboard / {headerLabel}
            </h1>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-200 sm:text-2xl sm:tracking-[0.09em]">
              {formattedNow}
            </p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200">
              Live Orders {liveOrderCount}
            </p>
          </div>
        </div>

        <div className="relative flex items-center gap-2" ref={profileRef}>
          <button
            onClick={() => canAccessSettings && navigate('/app/settings')}
            disabled={!canAccessSettings}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-100 transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-40"
            title="Settings"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={() => navigate('/app/orders')}
            className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-100 transition hover:bg-white/[0.09]"
            title="Notifications"
          >
            <Bell size={18} />
            {liveOrderCount > 0 && (
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-rose-400 ring-2 ring-[#0f1f3f]" />
            )}
          </button>
          <button
            onClick={() => setProfileOpen((prev) => !prev)}
            className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-3 text-slate-100 transition hover:bg-white/[0.09]"
            title="Profile"
          >
            <UserCircle2 size={22} />
            <ChevronDown
              size={16}
              className={profileOpen ? 'rotate-180 transition-transform' : 'transition-transform'}
            />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-[58px] z-50 w-[330px] overflow-hidden rounded-3xl border border-slate-700/80 bg-[#0b1322] shadow-2xl">
              <div className="border-b border-slate-700/70 bg-[#132445]/65 px-5 py-4">
                <p className="text-lg font-black text-white">{business?.businessName || 'Workspace'}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.13em] text-slate-300">
                  {roleLabel(role)} | {planName} Plan
                </p>
              </div>

              <div className="space-y-3 px-5 py-4 text-sm">
                <div className="flex items-center gap-2 text-slate-200">
                  <Mail size={14} className="text-blue-300" />
                  <span className="font-semibold">{business?.email?.trim() || 'No email set'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-200">
                  <Phone size={14} className="text-emerald-300" />
                  <span className="font-semibold">{business?.phone?.trim() || 'No phone set'}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-[#111d34] px-3 py-2">
                  <span className="text-xs font-bold uppercase tracking-[0.11em] text-slate-300">Plan</span>
                  <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-blue-200">
                    {planName}
                  </span>
                </div>
              </div>

              <div className="space-y-2 px-5 pb-4">
                <button
                  onClick={copyOrderLink}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#132445] px-3 py-2.5 text-sm font-black text-slate-100 transition hover:bg-[#17305d]"
                >
                  <Copy size={14} />
                  Copy Ordering Link
                </button>
                <button
                  onClick={() => orderLink && window.open(orderLink, '_blank', 'noopener,noreferrer')}
                  disabled={!orderLink}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#111d34] px-3 py-2.5 text-sm font-black text-slate-100 transition hover:bg-[#1a2d4f] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ExternalLink size={14} />
                  Open Customer View
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => canAccessBilling && navigate('/app/billing')}
                    disabled={!canAccessBilling}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-[#111d34] px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-100 transition hover:bg-[#1a2d4f] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <CreditCard size={13} />
                    Billing
                  </button>
                  <button
                    onClick={() => canAccessSettings && navigate('/app/settings')}
                    disabled={!canAccessSettings}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-[#111d34] px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-100 transition hover:bg-[#1a2d4f] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Sparkles size={13} />
                    Profile
                  </button>
                </div>
                <button
                  onClick={onLogout}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 py-2.5 text-sm font-black text-white transition hover:bg-rose-500"
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
