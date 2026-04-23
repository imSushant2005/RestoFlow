import { Helmet } from 'react-helmet-async';
import { FileText, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

type CustomerLegalPageProps = {
  type: 'privacy' | 'terms';
};

const PRIVACY_SECTIONS = [
  {
    title: 'Information we use',
    body:
      'BHOJFLOW may process guest name, phone number, session activity, order details, and restaurant usage data so the live ordering flow works correctly.',
  },
  {
    title: 'Why it is used',
    body:
      'The data is used to place orders, keep the live session in sync, generate bills, and help the restaurant serve you accurately.',
  },
  {
    title: 'Payments',
    body:
      'BHOJFLOW does not collect your restaurant payment inside this guest experience. Payment is made directly to the restaurant using its existing method such as cash, UPI, card, or another accepted option.',
  },
  {
    title: 'Support and retention',
    body:
      'Restaurants and BHOJFLOW may keep operational records for support, audits, billing history, and service quality improvements.',
  },
];

const TERMS_SECTIONS = [
  {
    title: 'Using this guest ordering flow',
    body:
      'You agree to provide accurate guest and order details so the restaurant can prepare and deliver the correct items.',
  },
  {
    title: 'Restaurant fulfillment',
    body:
      'Menu availability, preparation time, pricing, taxes, and service execution remain the responsibility of the restaurant operating this outlet.',
  },
  {
    title: 'Payments and settlement',
    body:
      'Bills may be generated inside the flow, but the final payment is completed directly with the restaurant and not processed by BHOJFLOW in this interface.',
  },
  {
    title: 'Fair use',
    body:
      'Guests must not misuse the live ordering system, submit fraudulent orders, or interfere with the restaurant service workflow.',
  },
];

export function CustomerLegalPage({ type }: CustomerLegalPageProps) {
  const { tenantSlug } = useParams();
  const isPrivacy = type === 'privacy';
  const title = isPrivacy ? 'Privacy Policy' : 'Terms & Conditions';
  const icon = isPrivacy ? <ShieldCheck size={18} /> : <FileText size={18} />;
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;
  const backHref = tenantSlug ? `/order/${tenantSlug}` : '/';

  return (
    <>
      <Helmet>
        <title>{title} | BHOJFLOW</title>
      </Helmet>

      <div className="mx-auto flex w-full max-w-[980px] flex-1 flex-col px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <div
          className="overflow-hidden rounded-[28px] border px-5 py-5 shadow-sm sm:px-6"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]"
                style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--brand)' }}
              >
                {icon}
                BHOJFLOW
              </div>
              <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl" style={{ color: 'var(--text-1)' }}>
                {title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed sm:text-[15px]" style={{ color: 'var(--text-3)' }}>
                This guest ordering experience is powered by BHOJFLOW and operated live by the restaurant you are ordering from.
              </p>
            </div>

            <Link
              to={backHref}
              className="rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition-opacity hover:opacity-85"
              style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text-2)' }}
            >
              Back to menu
            </Link>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-[24px] border px-5 py-5 shadow-sm sm:px-6"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <h2 className="text-lg font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
                {section.title}
              </h2>
              <p className="mt-2 text-sm font-medium leading-7 sm:text-[15px]" style={{ color: 'var(--text-3)' }}>
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
