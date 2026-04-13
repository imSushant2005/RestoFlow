import { ArrowRight, CheckCircle2, QrCode, Settings2, Store, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SiteChrome } from '../components/site/SiteChrome';
import setupPreview from '../assets/3min-setup.png';
import tablesPreview from '../assets/preview/tables-qr.png';

type SetupFlowPageProps = {
  onLoginClick: () => void;
  onSignupClick: () => void;
  onContactClick: () => void;
};

export function SetupFlowPage({ onLoginClick, onSignupClick, onContactClick }: SetupFlowPageProps) {
  return (
    <SiteChrome onLoginClick={onLoginClick} onSignupClick={onSignupClick} onContactClick={onContactClick}>
      <main className="space-y-16 pb-16">
        <section className="grid items-center gap-10 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: 'var(--brand)' }}>
              Setup Flow
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl" style={{ color: 'var(--text-1)', fontFamily: 'var(--font-display)' }}>
              Roll out the restaurant in a practical sequence instead of hoping every tool lines up on day one.
            </h1>
            <p className="mt-5 text-base leading-8 sm:text-lg" style={{ color: 'var(--text-2)' }}>
              RestoFlow is designed so restaurant owners can create the workspace, finish profile details, load the
              menu, map tables and QR, assign staff access, and run a test journey before going live.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button onClick={onSignupClick} className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-black text-white" style={{ background: 'var(--brand)' }}>
                Start workspace
                <ArrowRight size={16} />
              </button>
              <Link to="/contact" className="rounded-full px-6 py-3.5 text-sm font-black" style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-1)' }}>
                Talk to team
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            <article className="overflow-hidden rounded-[32px] border p-4 shadow-2xl" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <img src={setupPreview} alt="RestoFlow setup preview" className="h-[320px] w-full rounded-[24px] object-cover object-top" />
            </article>
            <article className="overflow-hidden rounded-[28px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <img src={tablesPreview} alt="Tables and QR mapping preview" className="h-[180px] w-full rounded-[20px] object-cover object-top" />
            </article>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-5">
          {[
            { icon: Store, title: '1. Create workspace', body: 'Start the restaurant, business identity, and base admin access.' },
            { icon: Settings2, title: '2. Add business details', body: 'Finish GST, phone, invoice identity, and profile essentials.' },
            { icon: Users, title: '3. Load menu and staff', body: 'Import dishes, categories, modifiers, and role-specific access.' },
            { icon: QrCode, title: '4. Map tables and QR', body: 'Attach dine-in sessions to the right zone, table, and live floor plan.' },
            { icon: CheckCircle2, title: '5. Run a full test', body: 'Walk one sample order from customer to kitchen to billing before launch.' },
          ].map((step) => {
            const Icon = step.icon;
            return (
              <article key={step.title} className="rounded-[26px] border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                  <Icon size={18} />
                </div>
                <h2 className="mt-4 text-lg font-black" style={{ color: 'var(--text-1)' }}>
                  {step.title}
                </h2>
                <p className="mt-2 text-sm leading-7" style={{ color: 'var(--text-2)' }}>
                  {step.body}
                </p>
              </article>
            );
          })}
        </section>

        <section className="rounded-[32px] border p-6 sm:p-8" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="mb-8 max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: 'var(--brand)' }}>
              Operational checklist
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl" style={{ color: 'var(--text-1)' }}>
              The handoff from setup to live service should feel deliberate, not fragile.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              'Verify menu prices, modifiers, and availability before the first guest scans the QR.',
              'Confirm table and QR mapping so dine-in orders always attach to the right workstation context.',
              'Run one session through kitchen, waiter, bill request, and payment confirmation before launch day.',
              'Review access roles so each staff member sees only the dashboard surface they actually need.',
            ].map((item) => (
              <div key={item} className="rounded-[24px] border p-5 text-sm leading-7" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                {item}
              </div>
            ))}
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}
