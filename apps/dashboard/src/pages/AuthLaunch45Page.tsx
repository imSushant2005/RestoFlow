import { ArrowRight, CalendarCheck2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { SiteChrome } from '../components/site/SiteChrome';

type AuthLaunch45PageProps = {
  onBackHome: () => void;
  onLoginClick: () => void;
  onContactClick: () => void;
  onSignupClick: () => void;
};

const launchTimeline = [
  {
    dayRange: 'Days 1-7',
    title: 'Foundation and workspace identity',
    points: [
      'Create the owner account and complete business identity setup.',
      'Confirm restaurant name, GSTIN, phone, and workspace URL.',
      'Prepare manager access and first-login security settings.',
    ],
  },
  {
    dayRange: 'Days 8-15',
    title: 'Menu and ordering readiness',
    points: [
      'Build categories and items with pricing and descriptions.',
      'Test customer ordering flow and storefront performance.',
      'Review QR and ordering entry points before team rollout.',
    ],
  },
  {
    dayRange: 'Days 16-25',
    title: 'Tables, roles, and service operations',
    points: [
      'Set up zones, tables, and dine-in sessions.',
      'Create employee credentials and map staff roles clearly.',
      'Train teams on live order handling and escalation flow.',
    ],
  },
  {
    dayRange: 'Days 26-35',
    title: 'Billing and compliance',
    points: [
      'Validate GST billing behavior and invoice identity.',
      'Run payment and invoice workflows end to end.',
      'Check that billing confidence is clear for owners and staff.',
    ],
  },
  {
    dayRange: 'Days 36-45',
    title: 'Optimization and repeatability',
    points: [
      'Use analytics to adjust menus and operating patterns.',
      'Refine manager workflows and role-based access boundaries.',
      'Move from launch mode into repeatable daily operations.',
    ],
  },
];

export function AuthLaunch45Page({ onLoginClick, onContactClick, onSignupClick }: AuthLaunch45PageProps) {
  return (
    <SiteChrome onLoginClick={onLoginClick} onSignupClick={onSignupClick} onContactClick={onContactClick}>
      <main className="space-y-16 pb-8">
        <section className="max-w-[760px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-100">
            <CalendarCheck2 size={15} />
            45-day launch plan
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-white sm:text-5xl" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>
            A realistic rollout path from account creation to stable restaurant operations.
          </h1>
          <p className="mt-5 text-base leading-7 text-slate-400">
            This plan helps restaurant teams move in the right order: access, setup, ordering, operations, billing, and ongoing optimization.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {launchTimeline.map((step) => (
            <article key={step.dayRange} className="rounded-[30px] border border-white/10 bg-[#0b1524] px-6 py-6">
              <p className="text-sm font-semibold text-blue-300">{step.dayRange}</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-white">{step.title}</h2>
              <ul className="mt-5 space-y-3">
                {step.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm leading-6 text-slate-400">
                    <CheckCircle2 size={16} className="mt-1 text-emerald-300" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="rounded-[32px] border border-white/10 bg-[#0b1524] px-6 py-7">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="text-base font-semibold text-white">Why this plan works</p>
              <p className="mt-2 max-w-[760px] text-sm leading-6 text-slate-400">
                It keeps the rollout grounded in actual restaurant needs: clear access, structured setup, reliable billing, and less confusion for managers and staff.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={onSignupClick}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Create Workspace
              <ArrowRight size={15} />
            </button>
            <button
              onClick={onContactClick}
              className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              Talk to onboarding
            </button>
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}
