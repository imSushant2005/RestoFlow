import { ArrowRight, CheckCircle2, ChefHat, QrCode, Receipt, Smartphone, Users } from 'lucide-react';
import { SiteChrome } from '../components/site/SiteChrome';
import customerMenuPreview from '../assets/preview/customer-menu.png';
import liveOrdersPreview from '../assets/preview/live-orders-session.png';
import menuPreview from '../assets/preview/menu-management.png';
import analyticsPreview from '../assets/preview/analytics.png';

type DemoPageProps = {
  onLoginClick: () => void;
  onSignupClick: () => void;
  onContactClick: () => void;
};

export function DemoPage({ onLoginClick, onSignupClick, onContactClick }: DemoPageProps) {
  return (
    <SiteChrome onLoginClick={onLoginClick} onSignupClick={onSignupClick} onContactClick={onContactClick}>
      <main className="space-y-16 pb-16">
        <section className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: 'var(--brand)' }}>
            Guided Demo
          </p>
          <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl" style={{ color: 'var(--text-1)', fontFamily: 'var(--font-display)' }}>
            Follow the full RestoFlow story from workspace creation to completed order and settled bill.
          </h1>
          <p className="mt-5 text-base leading-8 sm:text-lg" style={{ color: 'var(--text-2)' }}>
            This is not just a gallery. Each step explains who the screen is for, what it changes operationally, and
            why the connected flow is stronger than using separate customer, kitchen, and billing systems.
          </p>
        </section>

        <section className="grid gap-6">
          {[
            {
              step: 'Step 1',
              title: 'Create the workspace and publish the menu',
              body: 'The restaurant owner or manager starts by building categories, items, modifiers, and pricing. This becomes the single source of truth for both customers and staff.',
              image: menuPreview,
              icon: QrCode,
            },
            {
              step: 'Step 2',
              title: 'Guests scan and order from mobile',
              body: 'Customers discover dishes through search, categories, recommendations, and clearer food cards, then customize and place the order with more trustworthy totals.',
              image: customerMenuPreview,
              icon: Smartphone,
            },
            {
              step: 'Step 3',
              title: 'Kitchen, waiter, and cash stay aligned',
              body: 'Orders stay linked to the dining session so the kitchen knows what is cooking, the waiter sees what is ready, and the cashier closes the right bill.',
              image: liveOrdersPreview,
              icon: ChefHat,
            },
            {
              step: 'Step 4',
              title: 'Owners review performance and reconcile',
              body: 'After service, analytics and billing records remain connected to the same restaurant flow for cleaner review, follow-up, and reporting.',
              image: analyticsPreview,
              icon: Receipt,
            },
          ].map((section, index) => {
            const Icon = section.icon;
            return (
              <article
                key={section.title}
                className="grid gap-6 overflow-hidden rounded-[32px] border p-5 sm:p-6 lg:grid-cols-[0.95fr_1.05fr]"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              >
                <div className={`${index % 2 === 1 ? 'lg:order-2' : ''}`}>
                  <img src={section.image} alt={section.title} className="h-full min-h-[280px] w-full rounded-[24px] object-cover object-top" />
                </div>
                <div className={`${index % 2 === 1 ? 'lg:order-1' : ''} flex flex-col justify-center`}>
                  <div className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em]" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                    <Icon size={14} />
                    {section.step}
                  </div>
                  <h2 className="mt-4 text-3xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
                    {section.title}
                  </h2>
                  <p className="mt-4 text-sm leading-7" style={{ color: 'var(--text-2)' }}>
                    {section.body}
                  </p>
                  <div className="mt-5 rounded-[24px] border p-4 text-sm leading-7" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                    {index === 0
                      ? 'Who it is for: owner or manager. Why it matters: setup quality determines how clean the live ordering and billing flow feels later.'
                      : index === 1
                        ? 'Who it is for: first-time restaurant guests. Why it matters: customers should feel confident ordering without needing staff help for every step.'
                        : index === 2
                          ? 'Who it is for: kitchen, service, and cashier teams. Why it matters: one order context reduces service confusion and missed handoffs.'
                          : 'Who it is for: operators and owners. Why it matters: cleaner records create a calmer end-of-day reconciliation cycle.'}
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-[32px] border p-6 sm:p-8" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="mb-8 max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: 'var(--brand)' }}>
              Demo outcomes
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl" style={{ color: 'var(--text-1)' }}>
              The value is not one impressive screen. The value is the continuity across the whole flow.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: Users, title: 'Less staff confusion', body: 'Everyone sees the same live session story instead of partial fragments.' },
              { icon: CheckCircle2, title: 'More customer trust', body: 'Cleaner ordering, tracking, and billing reduce doubt during checkout.' },
              { icon: ArrowRight, title: 'Fewer operational breaks', body: 'A stronger sequence means one delayed tool or screen is less likely to break the whole service flow.' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-[24px] border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                    <Icon size={18} />
                  </div>
                  <h3 className="mt-4 text-lg font-black" style={{ color: 'var(--text-1)' }}>
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7" style={{ color: 'var(--text-2)' }}>
                    {item.body}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}
