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
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <div className="relative z-10 mx-auto max-w-[1240px] px-4 py-4 sm:px-6 sm:py-6">
        <header
          className="mb-10 rounded-[28px] border px-4 py-3 sm:px-5"
          style={{ borderColor: 'var(--border)', background: 'rgba(15, 23, 42, 0.78)', backdropFilter: 'blur(22px)' }}
        >
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="inline-flex min-w-0 items-center gap-3 rounded-full px-1 py-1 transition" style={{ color: 'var(--text-1)' }}>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-[0_0_24px_rgba(59,130,246,0.35)]" style={{ background: 'var(--brand)' }}>
                <UtensilsCrossed size={18} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-base font-black tracking-tight">RestoFlow</span>
                <span className="block truncate text-xs font-medium" style={{ color: 'var(--text-3)' }}>
                  Restaurant operating system
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
                    className="rounded-full px-4 py-2 text-sm font-semibold transition"
                    style={{
                      color: active ? 'var(--text-1)' : 'var(--text-2)',
                      background: active ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                      border: active ? '1px solid rgba(59, 130, 246, 0.25)' : '1px solid transparent',
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="hidden items-center gap-2 lg:flex">
              <button
                type="button"
                onClick={onLoginClick}
                className="rounded-full px-4 py-2 text-sm font-semibold transition hover:brightness-105"
                style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-1)' }}
              >
                Login
              </button>
              <button
                type="button"
                onClick={onSignupClick}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                style={{ background: 'var(--brand)' }}
              >
                Create Workspace
                <ArrowRight size={14} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border lg:hidden"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-2)' }}
            >
              <Menu size={18} />
            </button>
          </div>
        </header>

        <div
          className={`fixed inset-y-0 right-0 z-40 w-[min(360px,92vw)] border-l px-5 py-5 transition-transform duration-300 lg:hidden ${
            mobileNavOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{ background: 'rgba(9, 14, 26, 0.96)', borderColor: 'var(--border)', backdropFilter: 'blur(22px)' }}
        >
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-sm font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
                RestoFlow
              </p>
              <p className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>
                Explore the product
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-2)' }}
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-2">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileNavOpen(false)}
                  className="flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-bold"
                  style={{
                    color: active ? 'var(--text-1)' : 'var(--text-2)',
                    background: active ? 'rgba(59, 130, 246, 0.12)' : 'var(--surface)',
                    borderColor: active ? 'rgba(59, 130, 246, 0.25)' : 'var(--border)',
                  }}
                >
                  {item.label}
                  <ArrowRight size={14} />
                </Link>
              );
            })}
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                onLoginClick();
              }}
              className="rounded-2xl px-4 py-3 text-sm font-bold"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-1)' }}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                onSignupClick();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white"
              style={{ background: 'var(--brand)' }}
            >
              Create Workspace
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {children}

        <footer className="mt-20 border-t py-10" style={{ borderColor: 'var(--border)' }}>
          <div className="grid gap-10 md:grid-cols-[1.1fr_0.9fr_0.9fr_0.9fr]">
            <div>
              <p className="text-lg font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
                RestoFlow
              </p>
              <p className="mt-3 max-w-sm text-sm leading-6" style={{ color: 'var(--text-2)' }}>
                Premium restaurant software that connects QR ordering, kitchen operations, staff coordination, and
                billing inside one calmer control system.
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                Product
              </p>
              <div className="mt-3 space-y-2 text-sm" style={{ color: 'var(--text-2)' }}>
                <Link to="/product" className="block transition hover:brightness-110">Product</Link>
                <Link to="/setup-flow" className="block transition hover:brightness-110">Setup flow</Link>
                <Link to="/billing" className="block transition hover:brightness-110">Billing</Link>
                <Link to="/demo" className="block transition hover:brightness-110">Demo</Link>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                Company
              </p>
              <div className="mt-3 space-y-2 text-sm" style={{ color: 'var(--text-2)' }}>
                <Link to="/contact" className="block transition hover:brightness-110">Contact</Link>
                <Link to="/privacy" className="block transition hover:brightness-110">Privacy policy</Link>
                <Link to="/terms" className="block transition hover:brightness-110">Terms & conditions</Link>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                Access
              </p>
              <div className="mt-3 space-y-2 text-sm" style={{ color: 'var(--text-2)' }}>
                <button type="button" onClick={onLoginClick} className="block transition hover:brightness-110">Login</button>
                <button type="button" onClick={onSignupClick} className="block transition hover:brightness-110">Create workspace</button>
                <span className="block" style={{ color: 'var(--text-3)' }}>support@restoflow.com</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
