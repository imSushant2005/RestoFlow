import { ArrowRight, QrCode, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SiteChrome } from '../components/site/SiteChrome';
import analyticsPreview from '../assets/preview/analytics.png';
import customerMenuPreview from '../assets/preview/customer-menu.png';
import liveOrdersPreview from '../assets/preview/live-orders-pipeline.png';
import tablesPreview from '../assets/preview/tables-qr.png';

type ProductPageProps = {
  onLoginClick: () => void;
  onSignupClick: () => void;
  onContactClick: () => void;
};

export function ProductPage({ onLoginClick, onSignupClick, onContactClick }: ProductPageProps) {
  return (
    <SiteChrome onLoginClick={onLoginClick} onSignupClick={onSignupClick} onContactClick={onContactClick}>
      <main className="space-y-16 pb-16">
        <section className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: 'var(--brand)' }}>
              Product
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl" style={{ color: 'var(--text-1)', fontFamily: 'var(--font-display)' }}>
              One product surface for the full restaurant journey, not a pile of disconnected screens.
            </h1>
            <p className="mt-5 text-base leading-8 sm:text-lg" style={{ color: 'var(--text-2)' }}>
              BHOJFLOW connects customer ordering, table context, kitchen coordination, waiter flow, billing, and
              owner visibility so each role works from the same operational truth.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button onClick={onSignupClick} className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-black text-white" style={{ background: 'var(--brand)' }}>
                Start setup
                <ArrowRight size={16} />
              </button>
              <Link to="/demo" className="rounded-full px-6 py-3.5 text-sm font-black" style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-1)' }}>
                View guided demo
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { image: customerMenuPreview, title: 'Customer ordering', detail: 'Search, categories, modifiers, live tracker.' },
              { image: tablesPreview, title: 'Tables and QR mapping', detail: 'Sessions start with the right dining context.' },
              { image: liveOrdersPreview, title: 'Operations coordination', detail: 'Kitchen, waiter, and cashier stay aligned.' },
              { image: analyticsPreview, title: 'Owner visibility', detail: 'Billing, exports, and reporting stay attached.' },
            ].map((card) => (
              <article key={card.title} className="overflow-hidden rounded-[28px] border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <img src={card.image} alt={card.title} className="h-44 w-full object-cover object-top" />
                <div className="p-5">
                  <h2 className="text-lg font-black" style={{ color: 'var(--text-1)' }}>
                    {card.title}
                  </h2>
                  <p className="mt-2 text-sm leading-7" style={{ color: 'var(--text-2)' }}>
                    {card.detail}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          {[
            {
              icon: Sparkles,
              title: 'Customer ordering that feels clear',
              body: 'Guests see dish details, dietary cues, modifiers, prep expectations, live order states, and billing totals in a cleaner flow built for mobile-first usage.',
            },
            {
              icon: QrCode,
              title: 'Table-aware sessions',
              body: 'Each order can stay attached to the right table, seat, and live dining session so service teams are not guessing where food belongs.',
            },
            {
              icon: Users,
              title: 'Role-specific working surfaces',
              body: 'Owners, managers, cashiers, kitchen teams, and waiters work from focused views instead of one overloaded admin screen.',
            },
            {
              icon: ShieldCheck,
              title: 'Safer tenant and session boundaries',
              body: 'Restaurant-specific sessions, cache keys, and customer access paths are scoped so one tenant or workstation does not spill into another.',
            },
          ].map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="rounded-[28px] border p-6" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                  <Icon size={20} />
                </div>
                <h2 className="mt-4 text-2xl font-black" style={{ color: 'var(--text-1)' }}>
                  {feature.title}
                </h2>
                <p className="mt-3 text-sm leading-7" style={{ color: 'var(--text-2)' }}>
                  {feature.body}
                </p>
              </article>
            );
          })}
        </section>

        <section className="rounded-[32px] border p-6 sm:p-8" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="mb-8 max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: 'var(--brand)' }}>
              Why it works
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl" style={{ color: 'var(--text-1)' }}>
              Better than stitching together QR tools, spreadsheets, POS shortcuts, and ad-hoc staff messaging.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              'The customer flow does not drift away from the operations flow. Orders, status, and billing all stay linked.',
              'Setup is practical: menu, tables, QR access, staff roles, billing identity, and test journeys can be staged in sequence.',
              'The product is designed to be easier to trust during live service, especially when multiple staff members share responsibility.',
            ].map((point) => (
              <div key={point} className="rounded-[24px] border p-5 text-sm leading-7" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                {point}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[32px] border p-6 sm:p-8" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
                Want the rollout path too?
              </h2>
              <p className="mt-3 text-sm leading-7" style={{ color: 'var(--text-2)' }}>
                The setup flow breaks down exactly how a restaurant moves from workspace creation to menu import, QR
                mapping, staff activation, and live testing.
              </p>
            </div>
            <Link to="/setup-flow" className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-black text-white" style={{ background: 'var(--brand)' }}>
              View setup flow
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}
