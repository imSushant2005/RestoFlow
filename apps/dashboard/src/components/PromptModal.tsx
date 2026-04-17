import { useState, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
}

export function PromptModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  label,
  placeholder,
  defaultValue = '',
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (value.trim()) {
      onSubmit(value.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={onClose} 
      />
      <div 
        className="relative w-full max-w-sm overflow-hidden rounded-[28px] border bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95 duration-200"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-800 transition-colors"
            style={{ color: 'var(--text-3)' }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500" style={{ color: 'var(--text-3)' }}>
              {label}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApply()}
              placeholder={placeholder}
              className="w-full rounded-2xl border bg-slate-800/50 px-5 py-4 text-base font-bold transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/20"
              style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text-1)' }}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-4 text-sm font-black rounded-2xl hover:bg-slate-800 transition-all"
              style={{ color: 'var(--text-3)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!value.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-xl shadow-blue-500/20 hover:bg-blue-500 disabled:opacity-50 transition-all"
            >
              Apply
              <Check size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
