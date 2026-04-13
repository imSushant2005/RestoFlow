import { ReactNode } from 'react';
import { ArrowLeft, CheckCircle2, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';

type AuthFrameProps = {
  title: string;
  subtitle: string;
  badge: string;
  alternateLabel: string;
  alternateHref: string;
  alternateCta: string;
  children: ReactNode;
};

const proofPoints = [
  'Account creation first, workspace setup second.',
  'Business identity flows into billing and invoices.',
  'Role-based access stays aligned with restaurant operations.',
];

export function AuthFrame({
  title,
  subtitle,
  badge,
  alternateLabel,
  alternateHref,
  alternateCta,
  children,
}: AuthFrameProps) {
  return (
    <div className="min-h-screen font-sans" style={{ background: 'var(--shell-bg)', color: 'var(--text-1)' }}>
      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1120px] grid-cols-1 gap-10 px-6 py-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <section className="hidden lg:flex flex-col justify-center">
          <Link
            to="/"
            className="inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition hover:brightness-110"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)' }}
          >
            <ArrowLeft size={16} />
            Back to home
          </Link>

          <div
            className="mt-8 inline-flex w-fit items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold"
            style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--brand)' }}
          >
            <UtensilsCrossed size={16} />
            {badge}
          </div>

          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl" style={{ color: 'var(--text-1)', fontFamily: 'var(--font-display)' }}>
            {title}
          </h1>
          <p className="mt-4 max-w-[520px] text-lg leading-relaxed" style={{ color: 'var(--text-2)' }}>
            {subtitle}
          </p>

          <div className="mt-8 space-y-3">
            {proofPoints.map((point) => (
              <div key={point} className="flex items-start gap-3">
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                  <CheckCircle2 size={14} />
                </div>
                <p className="text-base font-medium" style={{ color: 'var(--text-2)' }}>{point}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-[480px] relative">
          <div className="relative rounded-[2.2rem] border p-8 sm:p-10" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="mb-10 lg:hidden">
              <Link
                to="/"
                className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition hover:brightness-110"
                style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' }}
              >
                <ArrowLeft size={14} />
                Back
              </Link>
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold"
                style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--brand)' }}
              >
                <UtensilsCrossed size={14} />
                {badge}
              </div>
              <h1 className="mt-4 text-3xl font-black" style={{ color: 'var(--text-1)' }}>{title}</h1>
            </div>

            <div className="mb-8 hidden items-center justify-between lg:flex">
              <div>
                <h2 className="text-2xl font-black" style={{ color: 'var(--text-1)' }}>Welcome</h2>
                <p className="mt-1 text-sm font-medium" style={{ color: 'var(--text-3)' }}>Please enter your details</p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>{alternateLabel}</p>
                <Link to={alternateHref} className="mt-0.5 inline-block text-sm font-bold underline-offset-4 hover:underline" style={{ color: 'var(--brand)' }}>
                  {alternateCta}
                </Link>
              </div>
            </div>

            {children}

            <div className="mt-6 flex items-center justify-center gap-4 text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
              <Link to="/privacy" className="hover:underline">Privacy</Link>
              <Link to="/terms" className="hover:underline">Terms</Link>
            </div>

            <div className="mt-8 border-t pt-6 text-center text-sm font-medium lg:hidden" style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
              {alternateLabel}{' '}
              <Link to={alternateHref} className="font-bold underline-offset-4 hover:underline" style={{ color: 'var(--brand)' }}>
                {alternateCta}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
