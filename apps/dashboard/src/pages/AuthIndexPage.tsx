import { AlertTriangle, ArrowRight, Clock4, LayoutDashboard, Receipt, Smartphone, Store, Users } from 'lucide-react';
import { SiteChrome } from '../components/site/SiteChrome';

type AuthIndexPageProps = {
  onLoginClick: () => void;
  onSignupClick: () => void;
  onContactClick: () => void;
  onLaunchClick: () => void;
};

const valueProps = [
  {
    icon: <Store size={20} />,
    title: 'Menu and ordering',
    summary: 'Manage categories, publish menus, and support customer ordering in one workspace.',
  },
  {
    icon: <LayoutDashboard size={20} />,
    title: 'Live operations',
    summary: 'Track tables, sessions, and kitchen-to-service flow in real time.',
  },
  {
    icon: <Receipt size={20} />,
    title: 'GST billing',
    summary: 'Close bills with tax-ready totals and cleaner payment workflows.',
  },
  {
    icon: <Users size={20} />,
    title: 'Role-based access',
    summary: 'Each team member sees only the tools their role should access.',
  },
] as const;

const solvedProblems = [
  {
    icon: <AlertTriangle size={18} />,
    title: 'Too many disconnected tools',
    summary: 'When orders, table states, and billing live in separate apps, service slows down.',
  },
  {
    icon: <Clock4 size={18} />,
    title: 'Slow handoffs during rush hours',
    summary: 'Kitchen and floor teams need one live operational state to move faster.',
  },
  {
    icon: <Smartphone size={18} />,
    title: 'Customer flow lacks clarity',
    summary: 'Guests order quickly but status, service calls, and billing often get fragmented.',
  },
] as const;

export function AuthIndexPage({ onLoginClick, onSignupClick, onContactClick, onLaunchClick }: AuthIndexPageProps) {
  return (
    <SiteChrome
      onLoginClick={onLoginClick}
      onSignupClick={onSignupClick}
      onContactClick={onContactClick}
      onLaunchClick={onLaunchClick}
    >
      <main className="space-y-16 pb-16 font-sans">
        <section className="pt-8 text-center">
          <div className="mx-auto max-w-4xl px-4">
            <div
              className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold"
              style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--brand)' }}
            >
              Next-Gen Restaurant OS
            </div>

            <h1
              className="text-4xl font-black leading-tight tracking-tight sm:text-6xl"
              style={{ color: 'var(--text-1)', fontFamily: 'var(--font-display)' }}
            >
              The calmest way to run your restaurant.
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: 'var(--text-2)' }}>
              RestoFlow unifies menu, tables, live orders, billing, and analytics in one secure workspace.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={onSignupClick}
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white transition hover:brightness-110"
                style={{ background: 'var(--brand)' }}
              >
                Start Workspace Free
                <ArrowRight size={16} />
              </button>
              <button
                onClick={onContactClick}
                className="rounded-full px-6 py-3 text-sm font-bold transition hover:brightness-105"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-1)' }}
              >
                Contact Sales
              </button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6">
          <div className="rounded-3xl border p-8 sm:p-10" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: 'var(--brand)' }}>
              What Problem We Solve
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl" style={{ color: 'var(--text-1)', fontFamily: 'var(--font-display)' }}>
              Restaurant operations fail when systems are disconnected.
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed" style={{ color: 'var(--text-2)' }}>
              RestoFlow keeps menu, table sessions, kitchen statuses, and billing in one real-time operating flow.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {solvedProblems.map((problem) => (
                <article key={problem.title} className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                    {problem.icon}
                  </div>
                  <h3 className="mt-4 text-lg font-black" style={{ color: 'var(--text-1)' }}>
                    {problem.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
                    {problem.summary}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-6">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl" style={{ color: 'var(--text-1)', fontFamily: 'var(--font-display)' }}>
              Everything you need. Nothing you do not.
            </h2>
            <p className="mt-3 text-base" style={{ color: 'var(--text-2)' }}>
              Replace tool switching with one focused operations system.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {valueProps.map((item) => (
              <article key={item.title} className="rounded-3xl border p-6" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                  {item.icon}
                </div>
                <h3 className="mt-6 text-xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
                  {item.summary}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="setup" className="mx-auto max-w-6xl px-6">
          <div className="rounded-3xl border p-8 sm:p-10" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: 'var(--brand)' }}>3-minute setup</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl" style={{ color: 'var(--text-1)', fontFamily: 'var(--font-display)' }}>
              Go live in minutes.
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                'Create account with email or Google.',
                'Add business profile and initial menu.',
                'Start table QR flow and receive live orders.',
              ].map((step, index) => (
                <div key={step} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: 'var(--brand)' }}>Step {index + 1}</p>
                  <p className="mt-2 text-sm font-medium" style={{ color: 'var(--text-2)' }}>{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-12">
          <div className="rounded-3xl border p-10 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl" style={{ color: 'var(--text-1)', fontFamily: 'var(--font-display)' }}>
              Ready to modernize operations?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base" style={{ color: 'var(--text-2)' }}>
              Join restaurants managing orders, tables, and billing in one calmer control panel.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={onSignupClick}
                className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-bold text-white transition hover:brightness-110"
                style={{ background: 'var(--brand)' }}
              >
                Create Workspace
                <ArrowRight size={16} />
              </button>
              <button
                onClick={onLoginClick}
                className="rounded-full px-8 py-3.5 text-sm font-bold transition hover:brightness-105"
                style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-1)' }}
              >
                Login
              </button>
            </div>
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}
