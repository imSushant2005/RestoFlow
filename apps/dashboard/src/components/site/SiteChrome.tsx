import { ReactNode, useState } from 'react';
import { ArrowRight, Menu, UtensilsCrossed, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

type SiteChromeProps = {
  children: ReactNode;
  onLoginClick: () => void;
  onSignupClick: () => void;
  onContactClick: () => void;
};

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Product', to: '/product' },
  { label: 'Setup Flow', to: '/setup-flow' },
  { label: 'Billing', to: '/billing' },
  { label: 'Demo', to: '/demo' },
  { label: 'Contact', to: '/contact' },
];

export function SiteChrome({ children, onLoginClick, onSignupClick }: SiteChromeProps) {
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: 'var(--shell-bg)', color: 'var(--text-1)' }}>
      <div className="pointer-events-none fixed inset-0 z-0" style={{ background: 'radial-gradient(circle at top, rgba(59,130,246,0.12), transparent 42%), linear-gradient(180deg, rgba(15,23,42,0.28), rgba(15,23,42,0))' }} />

      {mobileNavOpen ? (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden animate-in fade-in duration-300"
        />
      ) : null}

      <div className="relative z-10 mx-auto max-w-[1240px] px-4 py-4 sm:px-6 sm:py-6">
        <header
          className="mb-10 rounded-[28px] border px-4 py-3 sm:px-5 transition-all shadow-lg"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-opaque, rgba(15, 23, 42, 0.78))', backdropFilter: 'blur(16px)' }}
        >
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="inline-flex min-w-0 items-center gap-3 rounded-full px-1 py-1 transition" style={{ color: 'var(--text-1)' }}>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-[0_0_24px_rgba(59,130,246,0.35)]" style={{ background: 'var(--brand)' }}>
                <UtensilsCrossed size={18} />
              </span>
              <span className="min-w-0 text-left">
                <span className="block truncate text-base font-black tracking-tight">RestoFlow</span>
                <span className="block truncate text-xs font-semibold" style={{ color: 'var(--brand)' }}>
                  Core OS
                </span>
              </span>
            </Link>

            <nav className="hidden items-center gap-2 lg:flex">
              {navItems.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="rounded-full px-4 py-2 text-sm font-bold transition-all hover:brightness-110 active:scale-95"
                    style={{
                      color: active ? 'var(--text-1)' : 'var(--text-3)',
                      background: active ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onLoginClick}
                className="hidden lg:block rounded-full px-5 py-2.5 text-sm font-black transition-all hover:brightness-105 active:scale-95"
                style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-1)' }}
              >
                Login
              </button>
              <button
                type="button"
                onClick={onSignupClick}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-black text-white shadow-xl shadow-blue-500/20 transition-all hover:brightness-110 active:scale-95 whitespace-nowrap"
                style={{ background: 'var(--brand)' }}
              >
                <span className="hidden sm:inline">Start free</span>
                <span className="sm:hidden text-[10px] uppercase tracking-wider">Join</span>
                <ArrowRight size={14} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border lg:hidden transition-all active:scale-90 shadow-sm flex-shrink-0"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-2)' }}
            >
              <Menu size={18} />
            </button>
          </div>
        </header>

        <div
          className={`fixed inset-y-0 right-0 z-40 w-[min(320px,88vw)] border-l px-6 py-8 transition-transform duration-300 lg:hidden shadow-[-10px_0_40px_rgba(0,0,0,0.1)] ${
            mobileNavOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', backdropFilter: 'blur(12px)' }}
        >
          <div className="mb-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center text-white" style={{ background: 'var(--brand)' }}>
                <UtensilsCrossed size={14} />
              </div>
              <div>
                <p className="text-sm font-black tracking-tight leading-none" style={{ color: 'var(--text-1)' }}>
                  RestoFlow
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#5bc0be]" style={{ color: 'var(--brand)' }}>
                  PREMIUM
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition-all active:scale-90"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' }}
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileNavOpen(false)}
                  className={`flex items-center justify-between rounded-2xl px-5 py-4 text-sm font-black transition-all active:scale-[0.98] ${
                    active ? 'shadow-lg shadow-blue-500/10' : ''
                  }`}
                  style={{
                    color: active ? 'var(--text-1)' : 'var(--text-2)',
                    background: active ? 'rgba(59, 130, 246, 0.12)' : 'var(--surface-2)',
                    border: '1px solid',
                    borderColor: active ? 'rgba(59, 130, 246, 0.25)' : 'var(--border)',
                  }}
                >
                  {item.label}
                  <ArrowRight size={14} className={active ? 'opacity-100 translate-x-0' : 'opacity-40 -translate-x-2 transition-transform'} />
                </Link>
              );
            })}
          </div>

          <div className="mt-12 space-y-3">
             <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                onLoginClick();
              }}
              className="w-full rounded-2xl px-4 py-4 text-sm font-black transition-all active:scale-[0.98]"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-1)' }}
            >
              Login to Workspace
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                onSignupClick();
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-black text-white shadow-xl shadow-blue-600/20 transition-all active:scale-[0.98]"
              style={{ background: 'var(--brand)' }}
            >
              Start RestoFlow Free
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {children}

        <footer className="mt-32 rounded-[32px] border p-8 sm:p-12 mb-10 overflow-hidden relative" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
          
          <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr] relative z-10">
            <div className="flex flex-col items-start gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/40" style={{ background: 'var(--brand)' }}>
                  <UtensilsCrossed size={20} />
                </div>
                <div>
                  <p className="text-xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>RestoFlow</p>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--brand)' }}>Operating System</p>
                </div>
              </div>
              <p className="mt-2 max-w-sm text-sm font-medium leading-relaxed" style={{ color: 'var(--text-2)' }}>
                The calm, connected way to manage restaurant floors, staff, and billing. Built for businesses that value operational clarity and customer trust.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">System Live & Stable</span>
              </div>
            </div>

            <div className="space-y-6">
              <p className="text-sm font-black uppercase tracking-widest" style={{ color: 'var(--text-1)' }}>Product</p>
              <nav className="flex flex-col gap-3">
                {['Product overview', 'Setup workflow', 'Billing engine', 'Live demo'].map((link) => (
                  <Link key={link} to={`/${link.toLowerCase().replace(' ', '-')}`} className="text-sm font-semibold transition-all hover:translate-x-1 hover:text-[var(--brand)]" style={{ color: 'var(--text-3)' }}>{link}</Link>
                ))}
              </nav>
            </div>

            <div className="space-y-6">
              <p className="text-sm font-black uppercase tracking-widest" style={{ color: 'var(--text-1)' }}>Trust</p>
              <nav className="flex flex-col gap-3">
                {['Contact Support', 'Privacy Policy', 'Terms of Service'].map((link) => (
                  <Link key={link} to={`/${link.toLowerCase().replace(' ', '-')}`} className="text-sm font-semibold transition-all hover:translate-x-1 hover:text-[var(--brand)]" style={{ color: 'var(--text-3)' }}>{link}</Link>
                ))}
              </nav>
            </div>

            <div className="rounded-3xl p-6 border flex flex-col gap-4" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
              <p className="text-sm font-black" style={{ color: 'var(--text-1)' }}>Ready to transform?</p>
              <p className="text-xs font-medium leading-relaxed" style={{ color: 'var(--text-2)' }}>
                Join restaurants already running calmer operations.
              </p>
              <button 
                type="button" 
                onClick={onSignupClick}
                className="w-full py-3 rounded-2xl bg-white text-black text-xs font-black shadow-lg transition-all active:scale-95 hover:bg-slate-50"
              >
                Create Workspace
              </button>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
             <span>&copy; {new Date().getFullYear()} RestoFlow Architecture.</span>
             <span className="flex items-center gap-2 opacity-60">
                <span className="h-1 w-1 rounded-full bg-current" />
                Designed for Performance
                <span className="h-1 w-1 rounded-full bg-current" />
             </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
