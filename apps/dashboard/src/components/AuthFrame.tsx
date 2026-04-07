import { ReactNode } from 'react';
import { ArrowLeft, CheckCircle2, ShieldCheck, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';
import newDashboardPreview from '../assets/new-dashboard-preview.png';

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
    <div className="min-h-screen bg-[#030712] text-slate-100 selection:bg-blue-500/30 font-sans">
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top_right,rgba(37,99,235,0.15),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.1),transparent_50%)] pointer-events-none" />
      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1240px] grid-cols-1 gap-12 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        
        {/* Left Side - Visuals and Proof Points */}
        <section className="hidden lg:flex flex-col justify-center">
          <Link
            to="/"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-4 py-2 text-sm font-medium text-slate-300 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={16} />
            Back to home
          </Link>

          <div className="mt-12 inline-flex w-fit items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm font-bold text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
            <UtensilsCrossed size={16} />
            {badge}
          </div>

          <h1 className="mt-6 text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 sm:text-6xl" style={{ fontFamily: 'Inter, sans-serif' }}>
            {title}
          </h1>
          <p className="mt-6 max-w-[480px] text-lg leading-relaxed text-slate-400">
            {subtitle}
          </p>

          <div className="mt-10 space-y-4">
            {proofPoints.map((point) => (
              <div key={point} className="flex items-start gap-3">
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 size={14} />
                </div>
                <p className="text-base text-slate-300 font-medium">{point}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 group relative rounded-[2rem] border border-white/10 bg-white/5 p-2 backdrop-blur-sm transition-all hover:border-white/20">
            <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-b from-blue-500/20 to-purple-500/20 blur-xl opacity-50 group-hover:opacity-75 transition duration-500 pointer-events-none" />
            <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#020617] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-4 py-3 text-sm font-medium text-slate-400 backdrop-blur-md">
                <span>Dashboard Preview</span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <ShieldCheck size={16} /> Secure Network
                </span>
              </div>
              <img src={newDashboardPreview} alt="RestoFlow dashboard preview" className="w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
            </div>
          </div>
        </section>

        {/* Right Side - Auth Form Container */}
        <section className="mx-auto w-full max-w-[480px] relative">
          <div className="absolute -inset-4 rounded-[3rem] bg-gradient-to-b from-blue-500/20 to-transparent blur-2xl opacity-20 pointer-events-none" />
          <div className="relative rounded-[2.5rem] border border-white/10 bg-white/[0.02] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:p-10">
            
            <div className="mb-10 lg:hidden">
              <Link
                to="/"
                className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-white/10"
              >
                <ArrowLeft size={14} />
                Back
              </Link>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-300">
                <UtensilsCrossed size={14} />
                {badge}
              </div>
              <h1 className="mt-4 text-3xl font-black text-white">{title}</h1>
            </div>

            <div className="hidden items-center justify-between mb-8 lg:flex">
                <div>
                  <h2 className="text-2xl font-black text-white">Welcome</h2>
                  <p className="text-sm font-medium text-slate-400 mt-1">Please enter your details</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-slate-500">{alternateLabel}</p>
                    <Link to={alternateHref} className="mt-0.5 inline-block text-sm font-bold text-blue-400 transition hover:text-blue-300 hover:underline underline-offset-4">
                    {alternateCta}
                    </Link>
                </div>
            </div>

            {children}

            <div className="mt-8 border-t border-white/10 pt-6 text-center text-sm font-medium text-slate-400 lg:hidden">
              {alternateLabel}{' '}
              <Link to={alternateHref} className="font-bold text-blue-400 transition hover:text-blue-300 hover:underline">
                {alternateCta}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
