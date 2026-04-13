import { ArrowRight, BadgeCheck, LayoutDashboard, Receipt, Store, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SiteChrome } from '../components/site/SiteChrome';
import { IntroVideoSection } from '../components/site/IntroVideoSection';
import dashboardPreview from '../assets/new-dashboard-preview.png';
import customerMenuPreview from '../assets/preview/customer-menu.png';
import liveOrdersPreview from '../assets/preview/live-orders-pipeline.png';

type HomePageProps = {
  onLoginClick: () => void;
  onSignupClick: () => void;
  onContactClick: () => void;
};

export function HomePage({ onLoginClick, onSignupClick, onContactClick }: HomePageProps) {
  return (
    <SiteChrome onLoginClick={onLoginClick} onSignupClick={onSignupClick} onContactClick={onContactClick}>
      <main className="space-y-16 pb-16">
        <section className="grid items-center gap-10 pt-2 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em]" style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--brand)' }}>
              <BadgeCheck size={14} />
              Calm restaurant operations
            </div>
            <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight sm:text-6xl" style={{ color: 'var(--text-1)', fontFamily: 'var(--font-display)' }}>
              Run ordering, kitchen, tables, service, and billing from one trusted operating system.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 sm:text-lg" style={{ color: 'var(--text-2)' }}>
              RestoFlow gives restaurants one connected flow from QR scan to final bill. Guests get a cleaner ordering
              experience. Staff get live operational clarity. Owners get safer billing and role-based control.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button onClick={onSignupClick} className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-black text-white" style={{ background: 'var(--brand)' }}>
                Create Workspace
                <ArrowRight size={16} />
              </button>
              <Link to="/demo" className="rounded-full px-6 py-3.5 text-sm font-black" style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-1)' }}>
                Explore Demo
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {['Customer ordering that feels trustworthy', 'Live kitchen and waiter coordination', 'GST-aware billing and settlement'].map((chip) => (
                <span key={chip} className="rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em]" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="overflow-hidden rounded-[32px] border p-4 shadow-2xl" style={{ borderColor: 'var(--border)', background: 'rgba(15, 23, 42, 0.8)' }}>
              <img src={dashboardPreview} alt="RestoFlow dashboard preview" className="h-[320px] w-full rounded-[24px] object-cover object-top" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-[28px] border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: 'var(--text-3)' }}>
                  For owners
                </p>
                <h2 className="mt-3 text-xl font-black" style={{ color: 'var(--text-1)' }}>
                  Faster visibility, fewer blind spots
                </h2>
                <p className="mt-2 text-sm leading-7" style={{ color: 'var(--text-2)' }}>
                  One place to monitor live orders, table activity, billing states, and staff routing during service.
                </p>
              </article>
              <article className="rounded-[28px] border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: 'var(--text-3)' }}>
                  For guests
                </p>
                <h2 className="mt-3 text-xl font-black" style={{ color: 'var(--text-1)' }}>
                  Cleaner mobile ordering
                </h2>
                <p className="mt-2 text-sm leading-7" style={{ color: 'var(--text-2)' }}>
                  Easier dish discovery, customization, live tracking, and clearer totals before the order is placed.
                </p>
              </article>
            </div>
          </div>
        </section>

        <IntroVideoSection />

        <section className="grid gap-6 lg:grid-cols-3">
          {[
            {
              title: 'Scan and start',
              body: 'Guests land in a table-aware or pickup-aware session, browse by category, add modifiers, and place the order with clear pricing.',
              image: customerMenuPreview,
              link: '/demo',
            },
            {
              title: 'Keep service aligned',
              body: 'Kitchen, cashier, and waiter roles share the same operational context instead of juggling disconnected tools or manual handoffs.',
              image: liveOrdersPreview,
              link: '/product',
            },
            {
              title: 'Close with confidence',
              body: 'The bill, payment status, and invoice details stay attached to the same session so reconciliation is calmer at the end of service.',
              image: dashboardPreview,
              link: '/billing',
            },
          ].map((story) => (
            <article key={story.title} className="overflow-hidden rounded-[28px] border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <img src={story.image} alt={story.title} className="h-52 w-full object-cover object-top" />
              <div className="p-6">
                <h2 className="text-2xl font-black" style={{ color: 'var(--text-1)' }}>
                  {story.title}
                </h2>
                <p className="mt-3 text-sm leading-7" style={{ color: 'var(--text-2)' }}>
                  {story.body}
                </p>
                <Link to={story.link} className="mt-5 inline-flex items-center gap-2 text-sm font-black" style={{ color: 'var(--brand)' }}>
                  Learn more
                  <ArrowRight size={15} />
                </Link>
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-[32px] border p-6 sm:p-8" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="grid gap-5 lg:grid-cols-4">
            {[
              {
                icon: Store,
                title: 'Workspace setup',
                body: 'Create the workspace, verify the business profile, and get the restaurant ready for live usage.',
              },
              {
                icon: Users,
                title: 'Role-based control',
                body: 'Owners, managers, kitchen, cashiers, and waiters each get the tools that match their responsibilities.',
              },
              {
                icon: LayoutDashboard,
                title: 'Operational visibility',
                body: 'Dashboards, live sessions, table states, and queue movement stay easy to scan even during a rush.',
              },
              {
                icon: Receipt,
                title: 'Billing trust',
                body: 'Customers and staff see cleaner billing states with invoice-ready totals and settlement progress.',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-[24px] border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                    <Icon size={20} />
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
