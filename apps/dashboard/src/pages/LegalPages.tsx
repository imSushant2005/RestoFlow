import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { SiteChrome } from '../components/site/SiteChrome';

type LegalPageProps = {
  onBackHome: () => void;
  onLoginClick: () => void;
  onSignupClick: () => void;
  onContactClick: () => void;
};

type LegalSection = {
  title: string;
  points: string[];
};

function LegalLayout({
  eyebrow,
  title,
  summary,
  sections,
  updatedAt,
  onBackHome,
  onLoginClick,
  onSignupClick,
  onContactClick,
}: LegalPageProps & {
  eyebrow: string;
  title: string;
  summary: string;
  sections: LegalSection[];
  updatedAt: string;
}) {
  return (
    <SiteChrome
      onLoginClick={onLoginClick}
      onSignupClick={onSignupClick}
      onContactClick={onContactClick}
    >
      <main className="space-y-10 pb-16">
        <section className="rounded-[36px] border px-6 py-10 sm:px-10" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: 'var(--brand)' }}>
            {eyebrow}
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl" style={{ color: 'var(--text-1)', fontFamily: 'var(--font-display)' }}>
            {title}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7" style={{ color: 'var(--text-2)' }}>
            {summary}
          </p>
          <div className="mt-6 inline-flex rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em]" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
            Updated {updatedAt}
          </div>
        </section>

        <section className="grid gap-5">
          {sections.map((section) => (
            <article key={section.title} className="rounded-[30px] border p-6 sm:p-8" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
                {section.title}
              </h2>
              <div className="mt-5 grid gap-3">
                {section.points.map((point) => (
                  <div key={point} className="flex items-start gap-3">
                    <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                      <CheckCircle2 size={14} />
                    </div>
                    <p className="text-sm leading-6" style={{ color: 'var(--text-2)' }}>
                      {point}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-[32px] border px-6 py-8 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
            Need help reviewing these policies?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6" style={{ color: 'var(--text-2)' }}>
            RestroFlow is built for India-first restaurant operations. Before public production launch, we still recommend a final legal review for your billing, tax, privacy, and grievance workflows.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onBackHome}
              className="rounded-full px-5 py-3 text-sm font-bold"
              style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-1)' }}
            >
              Back to home
            </button>
            <button
              type="button"
              onClick={onSignupClick}
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white"
              style={{ background: 'var(--brand)' }}
            >
              Start 30-day trial
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}

export function PrivacyPolicyPage(props: LegalPageProps) {
  return (
    <LegalLayout
      {...props}
      eyebrow="Privacy Policy"
      title="How RestroFlow handles restaurant, staff, and customer data."
      summary="This Privacy Policy explains how RestroFlow collects, uses, stores, shares, and retains data for merchant workspaces, restaurant staff, and customer ordering experiences. It is written for India-first restaurant operations and should be reviewed with legal counsel before public production rollout."
      updatedAt="April 12, 2026"
      sections={[
        {
          title: 'Data we collect',
          points: [
            'We collect merchant account information, outlet identity details, staff login data, customer ordering details, session and billing records, and operational event history needed to run restaurant workflows.',
            'Customer-facing ordering may capture name, phone number, table/session context, order contents, service requests, billing state, review data, and tip attribution when enabled.',
            'We may also collect technical telemetry such as IP addresses, browser/session identifiers, error traces, and product usage metadata for security, support, and reliability monitoring.',
          ],
        },
        {
          title: 'How we use data',
          points: [
            'Data is used to operate menus, QR flows, dining sessions, kitchen coordination, waiter delivery, billing, reports, and customer support.',
            'Operational logs and metrics may be used to detect outages, fraud, payment mismatches, failed alerts, stuck sessions, and service degradation.',
            'Feedback, tip, and service metrics may be used inside merchant dashboards to improve staff operations and customer experience.',
          ],
        },
        {
          title: 'Retention, deactivation, and anonymization',
          points: [
            'Merchant billing, tax, and audit records may be retained for accounting, compliance, and dispute handling even after an end user deactivates their account.',
            'Customer deactivation triggers access revocation and personal-data anonymization where possible, while preserving operational records required for restaurant accounting and compliance.',
            'Retention periods should be reviewed against applicable Indian tax, accounting, and privacy obligations before full production launch.',
          ],
        },
        {
          title: 'Rights, consent, and governance',
          points: [
            'Restaurants are responsible for obtaining any customer-facing consents required for marketing communications, loyalty programs, and feedback collection.',
            'RestroFlow should maintain policy-version acceptance records, grievance contact details, and internal audit logs for privacy-sensitive actions.',
            'Before commercial rollout, policy terms should be reviewed in light of the Digital Personal Data Protection Act, 2023, and any sector-specific obligations relevant to the merchant.',
          ],
        },
      ]}
    />
  );
}

export function TermsPage(props: LegalPageProps) {
  return (
    <LegalLayout
      {...props}
      eyebrow="Terms & Conditions"
      title="Commercial terms for using RestroFlow as a restaurant operating platform."
      summary="These Terms & Conditions describe the commercial and operational rules for merchant workspaces using RestroFlow. They cover trial access, billing, acceptable use, data responsibilities, and service expectations. This draft is launch-ready in structure but should still receive formal legal review before production rollout."
      updatedAt="April 12, 2026"
      sections={[
        {
          title: 'Account and trial terms',
          points: [
            'Each business may start with a 30-day free trial, subject to verification and platform approval.',
            'Merchant onboarding is designed to complete in roughly three minutes for account creation, followed by business verification and setup checks before full production use.',
            'Restaurants are responsible for maintaining accurate business identity, billing, tax, and contact information inside their workspace.',
          ],
        },
        {
          title: 'Operational responsibilities',
          points: [
            'Merchants are responsible for menu accuracy, tax settings, staff permissions, payment reconciliation, and lawful operation of their restaurant workflows.',
            'RestroFlow provides software tools for service coordination, but restaurants remain responsible for food safety, legal invoicing, staff conduct, and customer communication.',
            'Sensitive operational actions such as refunds, overrides, exports, and access changes should be limited by role-based permissions and internal merchant policy.',
          ],
        },
        {
          title: 'Payments, billing, and availability',
          points: [
            'Platform pricing, paid plans, and commercial billing terms must be clearly published to merchants before the end of the free trial.',
            'Restaurants remain responsible for validating final cash, online, and mixed-settlement records before accounting closure.',
            'Service availability targets, maintenance windows, and support SLAs should be documented separately for production contracts and enterprise rollouts.',
          ],
        },
        {
          title: 'Acceptable use and limitation',
          points: [
            'Merchants may not use RestroFlow for unlawful activity, fraudulent payment behavior, abusive communications, or any attempt to disrupt platform integrity.',
            'Feature access may be suspended where misuse, security risk, unpaid dues, or verification failures create operational or legal risk.',
            'Before public launch, limitation-of-liability, refund, and dispute clauses should be reviewed with counsel and aligned with final commercial packaging.',
          ],
        },
      ]}
    />
  );
}
