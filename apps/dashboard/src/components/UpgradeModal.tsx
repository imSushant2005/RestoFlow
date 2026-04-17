import { Lock, Sparkles, X } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  title: string;
  description: string;
  tierName: string;
  limitText: string;
}

export function UpgradeModal({
  isOpen,
  onClose,
  onUpgrade,
  title,
  description,
  tierName,
  limitText,
}: UpgradeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      <div 
        className="relative w-full max-w-lg overflow-hidden rounded-[32px] border border-blue-500/20 bg-slate-900 p-1 shadow-2xl animate-in zoom-in-95 duration-300"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="relative rounded-[28px] bg-gradient-to-br from-blue-500/10 via-transparent to-transparent p-6 sm:p-10">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
          >
            <X size={20} />
          </button>

          <div className="flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-[24px] bg-blue-600 text-white shadow-2xl shadow-blue-500/40">
                <Lock size={32} />
              </div>
              <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg">
                <Sparkles size={16} />
              </div>
              <div className="absolute inset-0 -z-10 animate-ping rounded-[24px] bg-blue-500/20" />
            </div>

            <h2 className="text-3xl font-black tracking-tight text-white mb-3" style={{ color: 'var(--text-1)' }}>
              {title}
            </h2>
            
            <div className="mb-8 space-y-2">
              <p className="text-sm font-bold uppercase tracking-widest text-blue-400">
                Current Plan: {tierName}
              </p>
              <p className="text-slate-400 leading-relaxed" style={{ color: 'var(--text-2)' }}>
                {description}
              </p>
              <div className="inline-flex items-center gap-2 rounded-xl bg-slate-800/50 px-4 py-2 mt-2 border border-slate-700/50">
                 <span className="text-sm font-bold text-slate-300">{limitText}</span>
              </div>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2">
              <button
                onClick={onClose}
                className="rounded-2xl px-6 py-4 text-sm font-black text-slate-400 hover:bg-slate-800 transition-all border border-transparent"
                style={{ color: 'var(--text-3)' }}
              >
                Maybe later
              </button>
              <button
                onClick={onUpgrade}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-4 text-sm font-black text-white shadow-xl shadow-blue-600/25 hover:bg-blue-500 active:scale-[0.98] transition-all"
              >
                Upgrade Plan
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArrowRight({ size, className }: { size: number; className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
