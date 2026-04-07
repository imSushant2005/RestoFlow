import { ReactNode } from 'react';
import { ArrowRight, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';

type SiteChromeProps = {
  children: ReactNode;
  onLoginClick: () => void;
  onSignupClick: () => void;
  onContactClick: () => void;
  onLaunchClick?: () => void;
};

export function SiteChrome({ children, onLoginClick, onSignupClick, onContactClick, onLaunchClick }: SiteChromeProps) {
  return (
    <div className="min-h-screen bg-[#07101d] text-slate-100">
      <div className="bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.14),transparent_32%),linear-gradient(180deg,#07101d_0%,#081220_42%,#07101d_100%)]">
        <div className="mx-auto max-w-[1180px] px-6 py-6">
          <header className="mb-12 rounded-full border border-white/10 bg-[#0b1524]/92 px-4 py-3 shadow-[0_18px_60px_rgba(2,6,23,0.28)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Link to="/" className="inline-flex items-center gap-3 rounded-full px-2 py-1 text-slate-50 transition hover:text-white">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_10px_30px_rgba(37,99,235,0.35)]">
                  <UtensilsCrossed size={18} />
                </span>
                <span>
                  <span className="block text-base font-black tracking-tight">RestoFlow</span>
                  <span className="block text-xs font-medium text-slate-400">Restaurant operating system</span>
                </span>
              </Link>

              <nav className="hidden items-center gap-6 text-sm font-medium text-slate-400 lg:flex">
                <a href="/#features" className="transition hover:text-white">
                  Product
                </a>
                <a href="/#setup" className="transition hover:text-white">
                  Setup
                </a>
                <a href="/#compliance" className="transition hover:text-white">
                  Billing
                </a>
                {onLaunchClick ? (
                  <button type="button" onClick={onLaunchClick} className="transition hover:text-white">
                    Launch Plan
                  </button>
                ) : (
                  <Link to="/launch-plan" className="transition hover:text-white">
                    Launch Plan
                  </Link>
                )}
                <button type="button" onClick={onContactClick} className="transition hover:text-white">
                  Contact
                </button>
              </nav>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onLoginClick}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/[0.06]"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={onSignupClick}
                  className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  Create Workspace
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </header>

          {children}

          <footer className="mt-20 border-t border-white/10 py-10">
            <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
              <div>
                <p className="text-lg font-black tracking-tight text-white">RestoFlow</p>
                <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
                  Operations, ordering, billing, and access control for restaurants that want a calmer and more reliable system.
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-white">Product</p>
                <div className="mt-3 space-y-2 text-sm text-slate-400">
                  <a href="/#features" className="block transition hover:text-white">
                    Features
                  </a>
                  <a href="/#setup" className="block transition hover:text-white">
                    Setup flow
                  </a>
                  <a href="/#compliance" className="block transition hover:text-white">
                    Billing identity
                  </a>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-white">Company</p>
                <div className="mt-3 space-y-2 text-sm text-slate-400">
                  <button type="button" onClick={onContactClick} className="block transition hover:text-white">
                    Contact
                  </button>
                  <Link to="/launch-plan" className="block transition hover:text-white">
                    45-day launch plan
                  </Link>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-white">Access</p>
                <div className="mt-3 space-y-2 text-sm text-slate-400">
                  <button type="button" onClick={onLoginClick} className="block transition hover:text-white">
                    Login
                  </button>
                  <button type="button" onClick={onSignupClick} className="block transition hover:text-white">
                    Signup
                  </button>
                  <span className="block text-slate-500">support@restoflow.com</span>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
