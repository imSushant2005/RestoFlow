import { ArrowRight, BadgeIndianRupee, CheckCircle2, FileText, Receipt, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SiteChrome } from '../components/site/SiteChrome';
import billingPreview from '../assets/preview/billing-register.png';
import invoicePreview from '../assets/preview/invoice-modal.png';

type MarketingBillingPageProps = {
  onLoginClick: () => void;
  onSignupClick: () => void;
  onContactClick: () => void;
};

export function MarketingBillingPage({ onLoginClick, onSignupClick, onContactClick }: MarketingBillingPageProps) {
  return (
    <SiteChrome onLoginClick={onLoginClick} onSignupClick={onSignupClick} onContactClick={onContactClick}>
      <main className="space-y-16 pb-16">
        <section className="grid items-center gap-10 lg:grid-cols-[0.94fr_1.06fr]">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: 'var(--brand)' }}>
              Billing
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl" style={{ color: 'var(--text-1)', fontFamily: 'var(--font-display)' }}>
              Billing that feels cleaner for guests and safer for restaurant reconciliation.
            </h1>
            <p className="mt-5 text-base leading-8 sm:text-lg" style={{ color: 'var(--text-2)' }}>
              BHOJFLOW keeps GST-aware totals, invoice identity, payment states, and session-linked billing in one
              place so restaurants can close the day with fewer surprises.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button onClick={onSignupClick} className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-black text-white" style={{ background: 'var(--brand)' }}>
                Start with billing ready setup
                <ArrowRight size={16} />
              </button>
              <Link to="/demo" className="rounded-full px-6 py-3.5 text-sm font-black" style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-1)' }}>
                See billing flow
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <article className="overflow-hidden rounded-[28px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <img src={billingPreview} alt="Billing register preview" className="h-[280px] w-full rounded-[22px] object-cover object-top" />
            </article>
            <article className="overflow-hidden rounded-[28px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <img src={invoicePreview} alt="Invoice modal preview" className="h-[280px] w-full rounded-[22px] object-cover object-top" />
            </article>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          {[
            {
              icon: Receipt,
              title: 'Session-linked bill generation',
              body: 'Bills stay attached to the active dining session so customer ordering, service activity, and final settlement never split into different records.',
            },
            {
              icon: BadgeIndianRupee,
              title: 'Clear GST-aware totals',
              body: 'Customers see clearer totals before ordering, and staff can settle with the same tax logic carried through to the bill.',
            },
            {
              icon: FileText,
              title: 'Invoice-ready records',
              body: 'Invoice details, payment states, and business identity remain available for cleaner export and post-service review.',
            },
            {
              icon: ShieldCheck,
              title: 'More trustworthy reconciliation',
              body: 'Because orders, sessions, and billing remain linked, there is less room for end-of-day mismatches between service and cash handling.',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-[28px] border p-6" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                  <Icon size={20} />
                </div>
                <h2 className="mt-4 text-2xl font-black" style={{ color: 'var(--text-1)' }}>
                  {item.title}
                </h2>
                <p className="mt-3 text-sm leading-7" style={{ color: 'var(--text-2)' }}>
                  {item.body}
                </p>
              </article>
            );
          })}
        </section>

        <section className="rounded-[32px] border p-6 sm:p-8" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="mb-8 max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: 'var(--brand)' }}>
              Billing story
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl" style={{ color: 'var(--text-1)' }}>
              Better than stitching together manual notes, card slips, and after-service spreadsheet cleanup.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              'Staff can request, generate, and complete bills from the same operating context instead of jumping between separate tools.',
              'Customers get a clearer payment-ready experience because the session tracker and bill view stay connected.',
              'Owners get a more reliable trail of totals, payment states, and invoice identity for every restaurant session.',
            ].map((point) => (
              <div key={point} className="rounded-[24px] border p-5 text-sm leading-7" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                <CheckCircle2 size={18} style={{ color: 'var(--brand)' }} className="mb-3" />
                {point}
              </div>
            ))}
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}
