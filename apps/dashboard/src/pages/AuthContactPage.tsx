import { FormEvent, useMemo, useState } from 'react';
import { ArrowRight, Clock3, Mail, MessageCircle, PhoneCall, ShieldCheck } from 'lucide-react';
import { SiteChrome } from '../components/site/SiteChrome';
import { FormField, TextareaField } from '../components/forms/FormField';

type AuthContactPageProps = {
  onBackHome: () => void;
  onLoginClick: () => void;
  onSignupClick: () => void;
};

type FormState = {
  name: string;
  email: string;
  restaurant: string;
  inquiryType: string;
  message: string;
};

const contactCards = [
  {
    title: 'Sales and demos',
    value: 'hello@restoflow.com',
    summary: 'Product walkthroughs, pricing conversations, and launch planning for new workspaces.',
    icon: <Mail size={18} />,
  },
  {
    title: 'Vendor support',
    value: '+91 90000 45045',
    summary: 'Help with auth, dashboard access, and operational questions for active restaurants.',
    icon: <PhoneCall size={18} />,
  },
  {
    title: 'Priority chat',
    value: 'WhatsApp support line',
    summary: 'Useful when teams need a faster conversation during setup or rollout.',
    icon: <MessageCircle size={18} />,
  },
];

const initialForm: FormState = {
  name: '',
  email: '',
  restaurant: '',
  inquiryType: 'Book a demo',
  message: '',
};

export function AuthContactPage({ onLoginClick, onSignupClick }: AuthContactPageProps) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent(`[RestoFlow] ${form.inquiryType} - ${form.restaurant || form.name || 'New inquiry'}`);
    const body = encodeURIComponent(
      [
        `Name: ${form.name}`,
        `Email: ${form.email}`,
        `Restaurant: ${form.restaurant || '-'}`,
        `Inquiry type: ${form.inquiryType}`,
        '',
        form.message,
      ].join('\n'),
    );
    return `mailto:hello@restoflow.com?subject=${subject}&body=${body}`;
  }, [form.email, form.inquiryType, form.message, form.name, form.restaurant]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError('Please fill in your name, email, and a short message.');
      return;
    }

    setSuccess('Your inquiry is ready. We opened an email draft so you can send it immediately.');
    window.location.href = mailtoHref;
  };

  return (
    <SiteChrome onLoginClick={onLoginClick} onSignupClick={onSignupClick} onContactClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
      <main className="space-y-16 pb-8">
        <section className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="max-w-[520px]">
            <p className="text-sm font-semibold text-blue-300">Contact RestoFlow</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>
              Talk to the team about rollout, billing, and restaurant operations.
            </h1>
            <p className="mt-5 text-base leading-7 text-slate-400">
              Use this page for sales, demos, onboarding, or support questions. Keep the message short and we will help you move to the right next step.
            </p>

            <div className="mt-8 rounded-[28px] border border-white/10 bg-[#0b1524] px-5 py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
                  <Clock3 size={18} />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">Response expectation</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Sales and onboarding inquiries usually get a response within one business day. Active vendor issues should use phone or priority chat for a faster reply.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-[#0b1524] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.28)] sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-200">Contact form</p>
                <p className="mt-1 text-sm text-slate-400">This prepares an email draft with your details so the team can respond quickly.</p>
              </div>
              <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                Sales, demo, or support
              </div>
            </div>

            {error ? <div className="mb-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">{error}</div> : null}
            {success ? <div className="mb-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">{success}</div> : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  label="Your name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Sushant Rana"
                  required
                  autoComplete="name"
                />
                <FormField
                  label="Work email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="owner@restaurant.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                <FormField
                  label="Restaurant or business"
                  value={form.restaurant}
                  onChange={(e) => setForm((prev) => ({ ...prev, restaurant: e.target.value }))}
                  placeholder="Aura Cafe"
                  hint="Optional, but helpful for onboarding conversations."
                />
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-200">Inquiry type</label>
                  <select
                    value={form.inquiryType}
                    onChange={(e) => setForm((prev) => ({ ...prev, inquiryType: e.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-[#0f1728] px-4 py-3 text-sm font-medium text-slate-100 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option>Book a demo</option>
                    <option>Contact sales</option>
                    <option>Onboarding help</option>
                    <option>Vendor support</option>
                  </select>
                </div>
              </div>

              <TextareaField
                label="How can we help?"
                value={form.message}
                onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                placeholder="Tell us about your restaurant, rollout timeline, or the problem you want to solve."
                required
                hint="A short summary is enough. We will continue the conversation from there."
              />

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  Open email draft
                  <ArrowRight size={15} />
                </button>
                <a
                  href="mailto:hello@restoflow.com"
                  className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/[0.06]"
                >
                  Email directly
                </a>
              </div>
            </form>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {contactCards.map((item) => (
            <article key={item.title} className="rounded-[28px] border border-white/10 bg-[#0b1524] px-5 py-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
                {item.icon}
              </div>
              <h2 className="mt-5 text-xl font-black text-white">{item.title}</h2>
              <p className="mt-2 text-sm font-semibold text-slate-200">{item.value}</p>
              <p className="mt-3 text-sm leading-6 text-slate-400">{item.summary}</p>
            </article>
          ))}
        </section>

        <section className="rounded-[32px] border border-white/10 bg-[#0b1524] px-6 py-7">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="text-base font-semibold text-white">Consistent rollout support</p>
              <p className="mt-2 max-w-[760px] text-sm leading-6 text-slate-400">
                We help teams connect account access, workspace setup, staff roles, and billing identity in the right order so launch stays clear instead of chaotic.
              </p>
            </div>
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}
