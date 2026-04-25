import { ReactNode } from 'react';
import { motion } from 'framer-motion';

type KanbanColumnProps = {
  label: string;
  color?: string;
  bg?: string;
  hint?: string;
  pulse?: boolean;
  isActive?: boolean;
  badge?: {
    count: number;
    className?: string;
  };
  children: ReactNode;
};

export function KanbanColumn({
  label,
  color = '#94a3b8',
  bg,
  hint,
  pulse = false,
  badge,
  children,
}: KanbanColumnProps) {
  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="flex min-h-0 min-w-[22rem] flex-1 flex-col overflow-hidden rounded-[2rem] border border-white/6 bg-slate-950/80"
      style={bg ? { background: bg } : undefined}
    >
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/6 bg-slate-950/95 px-5 py-4 backdrop-blur-xl">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <motion.span
              animate={pulse ? { scale: [1, 1.12, 1] } : undefined}
              transition={pulse ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : undefined}
              className={`h-3 w-3 rounded-full ${pulse ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: color }}
            />
            <h3 className="text-[1.05rem] font-black uppercase tracking-[0.18em]" style={{ color }}>
              {label}
            </h3>
          </div>
          {hint ? (
            <p className="mt-1 text-[0.72rem] font-black uppercase tracking-[0.14em] text-slate-500">
              {hint}
            </p>
          ) : null}
        </div>

        <span
          className={`inline-flex min-w-[2.4rem] items-center justify-center rounded-xl px-2.5 py-1 text-[0.78rem] font-black ${
            badge?.className || 'bg-white/10 text-white'
          }`}
        >
          {badge?.count ?? 0}
        </span>
      </header>

      <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-4">
        <motion.div layout className="space-y-4">
          {children}
        </motion.div>
      </div>
    </motion.section>
  );
}
