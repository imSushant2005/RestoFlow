import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock4,
  LayoutDashboard,
  Receipt,
  Smartphone,
  Store,
  Users,
} from 'lucide-react';
import setupPreviewImage from '../assets/3min-setup.png';
import menuManagementImage from '../assets/preview/menu-management.png';
import tablesQrImage from '../assets/preview/tables-qr.png';
import liveOrdersImage from '../assets/preview/live-orders-pipeline.png';
import billingImage from '../assets/preview/billing-register.png';
import analyticsImage from '../assets/preview/analytics.png';
import customerMenuImage from '../assets/preview/customer-menu.png';
import { SiteChrome } from '../components/site/SiteChrome';

type AuthIndexPageProps = {
  onLoginClick: () => void;
  onSignupClick: () => void;
  onContactClick: () => void;
  onLaunchClick: () => void;
};

const valueProps = [
  {
    icon: <Store size={20} />,
    title: 'Menu and ordering',
    summary: 'Manage categories, publish menus, and support customer ordering seamlessly.',
  },
  {
    icon: <LayoutDashboard size={20} />,
    title: 'Live operations',
    summary: 'Keep tables, sessions, and service flow visible in real time.',
  },
  {
    icon: <Receipt size={20} />,
    title: 'GST billing',
    summary: 'Use restaurant identity, tax details, and invoice workflows intuitively.',
  },
  {
    icon: <Users size={20} />,
    title: 'Role-based access',
    summary: 'Managers see everything. Staff only get the screens they need.',
  },
];

const previewSlides = [
  {
    title: 'Menu Builder',
    summary: 'Create categories, control pricing, and publish changes instantly for customer ordering.',
    image: menuManagementImage,
    badge: 'Menu',
  },
  {
    title: 'Tables & QR',
    summary: 'Generate table QR flows and track real table occupancy without manual confusion.',
    image: tablesQrImage,
    badge: 'Tables',
  },
  {
    title: 'Live Operations',
    summary: 'Move orders through accept, prep, ready, served, and closure from one command surface.',
    image: liveOrdersImage,
    badge: 'Ops',
  },
  {
    title: 'Billing Register',
    summary: 'Close sessions, generate GST-ready totals, and keep payment state aligned with operations.',
    image: billingImage,
    badge: 'Billing',
  },
  {
    title: 'Analytics',
    summary: 'Read revenue patterns and item performance so menu and staffing decisions stay data-backed.',
    image: analyticsImage,
    badge: 'Analytics',
  },
  {
    title: 'Customer Experience',
    summary: 'Guests browse menu, track statuses, and checkout with clear realtime updates.',
    image: customerMenuImage,
    badge: 'Customer',
  },
] as const;

const solvedProblems = [
  {
    icon: <AlertTriangle size={18} />,
    title: 'Scattered tools create operational blind spots',
    summary: 'Teams jump between POS, chat, spreadsheets, and printed KOTs, which delays decisions during rush hours.',
  },
  {
    icon: <Clock4 size={18} />,
    title: 'Slow service handoffs hurt table turnaround',
    summary: 'Kitchen, waiters, and billing don’t share one live state, so guests wait longer and staff repeats work.',
  },
  {
    icon: <Smartphone size={18} />,
    title: 'Customer ordering and billing feel disconnected',
    summary: 'Guests can order, but tracking, bill clarity, and completion status are often fragmented or unclear.',
  },
] as const;

export function AuthIndexPage({ onLoginClick, onSignupClick, onContactClick, onLaunchClick }: AuthIndexPageProps) {
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActivePreviewIndex((prev) => (prev + 1) % previewSlides.length);
    }, 3800);
    return () => window.clearInterval(id);
  }, []);

  const activePreview = previewSlides[activePreviewIndex];

  return (
    <SiteChrome
      onLoginClick={onLoginClick}
      onSignupClick={onSignupClick}
      onContactClick={onContactClick}
      onLaunchClick={onLaunchClick}
    >
      <main className="space-y-32 pb-16 font-sans">
        
        {/* HERO SECTION */}
        <section className="relative pt-12">
          {/* Subtle Background Glows */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.2),transparent_70%)] pointer-events-none" />
          
          <div className="mx-auto max-w-5xl text-center px-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-bold text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.15)] mb-8">
              <span>Next-Gen Restaurant OS</span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            </div>

            <h1 className="text-5xl font-black leading-[1.1] tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-slate-400 sm:text-7xl mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>
              The calmest way to run<br className="hidden sm:block"/> your restaurant.
            </h1>
            
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-400 font-medium mb-10">
              RestoFlow unifies your menus, guest ordering, QR tables, live operations, billing, and analytics in a single, high-performance workspace.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={onSignupClick}
                className="group relative inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(37,99,235,0.4)]"
              >
                Start Workspace Free
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={onContactClick}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-bold text-slate-200 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                Contact Sales
              </button>
            </div>
          </div>

          {/* Animated Dashboard Preview */}
          <div className="mx-auto mt-20 max-w-6xl px-4 relative z-10">
            <div className="group relative rounded-[2.5rem] border border-white/10 bg-white/5 p-3 backdrop-blur-sm transition-all shadow-[0_30px_100px_rgba(2,6,23,0.8)]">
              <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-b from-blue-500/20 to-emerald-500/10 blur-2xl opacity-50 transition duration-500 pointer-events-none" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#020617]">
                <div className="relative h-[220px] overflow-hidden sm:h-[320px] lg:h-[420px]">
                  <div
                    className="flex h-full transition-transform duration-700 ease-out"
                    style={{ transform: `translateX(-${activePreviewIndex * 100}%)` }}
                  >
                    {previewSlides.map((slide) => (
                      <div key={slide.title} className="h-full w-full shrink-0">
                        <img
                          src={slide.image}
                          alt={slide.title}
                          className="h-full w-full object-cover opacity-95 transition-all group-hover:opacity-100"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 border-t border-white/10 bg-[#020617]/95 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
                  <div>
                    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-blue-200">
                      {activePreview.badge}
                    </span>
                    <h3 className="mt-3 text-xl font-black text-white sm:text-2xl">{activePreview.title}</h3>
                    <p className="mt-1 text-sm font-medium text-slate-300">{activePreview.summary}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setActivePreviewIndex((prev) => (prev - 1 + previewSlides.length) % previewSlides.length)
                      }
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/10"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setActivePreviewIndex((prev) => (prev + 1) % previewSlides.length)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/10"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 pb-4">
                  {previewSlides.map((slide, index) => (
                    <button
                      key={slide.title}
                      onClick={() => setActivePreviewIndex(index)}
                      className={`h-1.5 rounded-full transition-all ${index === activePreviewIndex ? 'w-8 bg-blue-400' : 'w-3 bg-white/25 hover:bg-white/40'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PROBLEM SECTION */}
        <section className="mx-auto max-w-7xl px-6">
          <div className="rounded-[2.5rem] border border-white/10 bg-[#0a1324] p-8 sm:p-12">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">What Problem We Solve</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl" style={{ fontFamily: 'Inter, sans-serif' }}>
              Restaurant operations break when systems are disconnected.
            </h2>
            <p className="mt-4 max-w-3xl text-base font-medium leading-relaxed text-slate-300">
              RestoFlow solves fragmented service flow by keeping menu, table sessions, kitchen status, billing, and customer tracking inside one realtime operating system.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {solvedProblems.map((problem) => (
                <article key={problem.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                    {problem.icon}
                  </div>
                  <h3 className="mt-4 text-lg font-black text-white">{problem.title}</h3>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-slate-300">{problem.summary}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES GRID */}
        <section id="features" className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl" style={{ fontFamily: 'Inter, sans-serif' }}>
              Everything you need. Nothing you don't.
            </h2>
            <p className="mt-4 text-base text-slate-400">
              Stop switching between disconnected tools.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {valueProps.map((item) => (
              <article key={item.title} className="group rounded-[2rem] border border-white/5 bg-[#0b1221] px-6 py-8 transition-all hover:bg-[#0f172a] hover:border-white/10">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 transition-transform group-hover:scale-110">
                  {item.icon}
                </div>
                <h3 className="mt-8 text-xl font-bold text-white tracking-tight">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400 font-medium">{item.summary}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 3 MINUTE SETUP SHOWCASE */}
        <section id="setup" className="mx-auto max-w-7xl px-6 relative">
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[300px] h-[300px] bg-emerald-500/10 blur-[100px] pointer-events-none" />
          
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 mb-6 text-xs font-bold text-emerald-300">
                Time to value
              </div>
              <h2 className="text-4xl font-black tracking-tight text-white mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>
                Go live in 3 minutes. Literally.
              </h2>
              <p className="text-lg leading-relaxed text-slate-400 font-medium mb-8">
                We've stripped away the 14-day onboarding cycles of legacy POS. Our 3-minute setup flow handles your core menu, table generation, and business identity instantly. Stop configuring and start serving.
              </p>
              
              <ul className="space-y-4">
                {['Sign up with just your email or Google account.', 'Add your restaurant details and initial menu items.', 'Generate your QR codes and start receiving live orders instantly.'].map((step, idx) => (
                   <li key={idx} className="flex items-start gap-4">
                     <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/5 border border-white/10 text-sm font-bold text-slate-300">
                       {idx + 1}
                     </span>
                     <span className="text-slate-300 pt-0.5">{step}</span>
                   </li>
                ))}
              </ul>
            </div>
            
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 blur-3xl opacity-50 group-hover:opacity-75 transition-duration-500" />
              <img src={setupPreviewImage} alt="Setup Process In 3 Minutes" className="relative w-full h-auto object-contain rounded-[2rem] border border-white/10 shadow-2xl z-10" />
            </div>
          </div>
        </section>

        {/* CLOSING CTA */}
        <section className="mx-auto max-w-5xl px-6 pb-12">
          <div className="relative rounded-[3rem] border border-blue-500/20 bg-[#091124] p-12 text-center shadow-[0_0_100px_rgba(37,99,235,0.15)] overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(37,99,235,0.1),transparent)] pointer-events-none" />
            <h2 className="relative z-10 text-4xl font-black tracking-tight text-white mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>
              Ready to modernize your operations?
            </h2>
            <p className="relative z-10 mx-auto max-w-2xl text-lg text-slate-300 mb-10">
              Join the growing number of restaurants managing orders, tables, and staff seamlessly.
            </p>
            <div className="relative z-10 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={onSignupClick}
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-8 py-4 text-sm font-bold text-white transition-transform hover:bg-blue-500 shadow-lg shadow-blue-500/25 hover:scale-105 active:scale-[0.98]"
              >
                Create Hub Workspace
                <ArrowRight size={16} />
              </button>
              <button
                onClick={onContactClick}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 py-4 text-sm font-bold text-white transition-all hover:bg-white/10"
              >
                Book a Demo
              </button>
            </div>
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}
