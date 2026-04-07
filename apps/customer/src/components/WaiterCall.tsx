import { useState } from 'react';
import { Hand, Receipt, HelpCircle, X, Check, Loader2 } from 'lucide-react';
import { publicApi } from '../lib/api';

const CALL_TYPES = [
  { id: 'WAITER', label: 'Call Waiter', icon: <Hand size={22} />, color: 'bg-blue-500', desc: 'A waiter will come to your table' },
  { id: 'BILL', label: 'Request Bill', icon: <Receipt size={22} />, color: 'bg-emerald-500', desc: 'Get the bill at your table' },
  { id: 'HELP', label: 'Need Help', icon: <HelpCircle size={22} />, color: 'bg-orange-500', desc: 'Need assistance with something' },
];

export function WaiterCall({ tenantSlug, tableId }: { tenantSlug: string; tableId?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<'IDLE' | 'SENDING' | 'SENT'>('IDLE');
  const [sentType, setSentType] = useState('');

  const handleCall = async (type: string) => {
    setStatus('SENDING');
    setSentType(type);
    try {
      await publicApi.post(`/${tenantSlug}/waiter-call`, { tableId, type });
      setStatus('SENT');
      setTimeout(() => {
        setIsOpen(false);
        setStatus('IDLE');
      }, 2500);
    } catch {
      setStatus('IDLE');
    }
  };

  if (!tableId) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-30 py-2 px-4 bg-blue-600 text-white rounded-full shadow-md active:scale-95 transition-transform"
        aria-label="Call Waiter"
      >
        Call
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => status !== 'SENDING' && setIsOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-[color:var(--bg-secondary)] rounded-t-3xl shadow-2xl p-6 pb-8 slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {status === 'SENT' ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center fade-in">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Check size={32} className="text-emerald-600" />
                </div>
                <h3 className="text-lg font-black text-[color:var(--text-primary)]">Request Sent!</h3>
                <p className="text-sm text-[color:var(--text-secondary)]">
                  {sentType === 'BILL' ? 'Your bill is on the way' : 'Someone will be with you shortly'}
                </p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-lg font-black text-[color:var(--text-primary)]">How can we help?</h3>
                  <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
                    <X size={18} className="text-[color:var(--text-secondary)]" />
                  </button>
                </div>
                <div className="grid gap-3">
                  {CALL_TYPES.map((ct) => (
                    <button
                      key={ct.id}
                      onClick={() => handleCall(ct.id)}
                      disabled={status === 'SENDING'}
                      className="flex items-center gap-4 p-4 rounded-2xl border border-[color:var(--border-primary)] bg-[color:var(--bg-primary)] hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      <div className={`w-12 h-12 ${ct.color} rounded-xl flex items-center justify-center text-white shadow-lg`}>
                        {status === 'SENDING' && sentType === ct.id ? <Loader2 size={22} className="animate-spin" /> : ct.icon}
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-[color:var(--text-primary)]">{ct.label}</p>
                        <p className="text-xs text-[color:var(--text-secondary)]">{ct.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
