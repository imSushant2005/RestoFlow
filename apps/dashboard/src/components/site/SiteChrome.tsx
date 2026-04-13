import { ReactNode } from 'react';
import { ArrowRight, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';

type SiteChromeProps = {
  children: ReactNode;
  onLoginClick: () => void;
  onSignupClick: () => void;
  onContactClick: () => void;
};

export function SiteChrome({ children, onLoginClick, onSignupClick, onContactClick }: SiteChromeProps) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--shell-bg)', color: 'var(--text-1)' }}>
      <div className="mx-auto max-w-[1180px] px-6 py-6">
        <header className="mb-12 rounded-full border px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link to="/" className="inline-flex items-center gap-3 rounded-full px-2 py-1 transition" style={{ color: 'var(--text-1)' }}>
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl text-white" style={{ background: 'var(--brand)' }}>
                <UtensilsCrossed size={18} />
              </span>
              <span>
                <span className="block text-base font-black tracking-tight">RestoFlow</span>
                <span className="block text-xs font-medium" style={{ color: 'var(--text-3)' }}>Restaurant operating system</span>
              </span>
            </Link>

            <nav className="hidden items-center gap-6 text-sm font-medium lg:flex" style={{ color: 'var(--text-2)' }}>
              <a href="/#features" className="transition hover:brightness-110">Product</a>
              <a href="/#setup" className="transition hover:brightness-110">Setup</a>
              <a href="/#compliance" className="transition hover:brightness-110">Billing</a>
              <button type="button" onClick={onContactClick} className="transition hover:brightness-110">Contact</button>
            </nav>

            <div className="flex flex-wrap items-center gap-2">
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
          </div>
        </header>

        {children}

        <footer className="mt-20 border-t py-10" style={{ borderColor: 'var(--border)' }}>
          <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
            <div>
              <p className="text-lg font-black tracking-tight" style={{ color: 'var(--text-1)' }}>RestoFlow</p>
              <p className="mt-3 max-w-sm text-sm leading-6" style={{ color: 'var(--text-2)' }}>
                Operations, ordering, billing, and access control for restaurants that want a calmer and reliable system.
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Product</p>
              <div className="mt-3 space-y-2 text-sm" style={{ color: 'var(--text-2)' }}>
                <a href="/#features" className="block transition hover:brightness-110">Features</a>
                <a href="/#setup" className="block transition hover:brightness-110">Setup flow</a>
                <a href="/#compliance" className="block transition hover:brightness-110">Billing identity</a>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Company</p>
              <div className="mt-3 space-y-2 text-sm" style={{ color: 'var(--text-2)' }}>
                <button type="button" onClick={onContactClick} className="block transition hover:brightness-110">Contact</button>
                <Link to="/privacy" className="block transition hover:brightness-110">Privacy policy</Link>
                <Link to="/terms" className="block transition hover:brightness-110">Terms & conditions</Link>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Access</p>
              <div className="mt-3 space-y-2 text-sm" style={{ color: 'var(--text-2)' }}>
                <button type="button" onClick={onLoginClick} className="block transition hover:brightness-110">Login</button>
                <button type="button" onClick={onSignupClick} className="block transition hover:brightness-110">Signup</button>
                <span className="block" style={{ color: 'var(--text-3)' }}>support@restoflow.com</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
