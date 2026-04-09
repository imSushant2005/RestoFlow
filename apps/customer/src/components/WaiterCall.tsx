import { useState } from 'react';
import { Hand, Receipt, HelpCircle, X, Check, Loader2 } from 'lucide-react';
import { publicApi } from '../lib/api';

const CALL_TYPES = [
  { id: 'WAITER', label: 'Call Waiter', icon: <Hand size={22} />, color: 'bg-blue-500', desc: 'A waiter will come to your table' },
  { id: 'BILL', label: 'Request Bill', icon: <Receipt size={22} />, color: 'bg-emerald-500', desc: 'Get the bill at your table' },
  { id: 'WATER', label: 'Request Water', icon: <Hand size={22} />, color: 'bg-cyan-500', desc: 'Need fresh water' },
  { id: 'EXTRA', label: 'Request Extra', icon: <Receipt size={22} />, color: 'bg-indigo-500', desc: 'Need spoons, napkins, etc.' },
  { id: 'HELP', label: 'Need Help', icon: <HelpCircle size={22} />, color: 'bg-orange-500', desc: 'Need assistance with something' },
];

export function WaiterCall({ tenantSlug, tableId: initialTableId }: { tenantSlug: string; tableId?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<'IDLE' | 'SENDING' | 'SENT'>('IDLE');
  const [sentType, setSentType] = useState('');
  const [manualTable, setManualTable] = useState('');

  const tableId = initialTableId || manualTable;

  const handleCall = async (type: string) => {
    if (!tableId) {
      alert('Please enter your table number first.');
      return;
    }
    setStatus('SENDING');
    setSentType(type);

    // Optimistic performance: We start the request and show success quickly
    // since the server is now highly optimized and unlikely to fail 
    // for healthy validated tables.
    const requestPromise = publicApi.post(`/${tenantSlug}/waiter-call`, { tableId, type });
    
    // Artificial "smoothness" delay to show the user we are working, but not too slow
    await new Promise(r => setTimeout(r, 450));
    setStatus('SENT');

    try {
      await requestPromise;
      setTimeout(() => {
        setIsOpen(false);
        setStatus('IDLE');
      }, 2000);
    } catch {
      setStatus('IDLE');
    }
  };


  // Removed the !tableId return to allow showing the button for all users

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-30 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl shadow-blue-500/40 active:scale-95 transition-all flex items-center justify-center border-4 border-white/20 backdrop-blur-sm group"
        aria-label="Call Waiter"
      >
        <Hand size={24} className="group-hover:rotate-12 transition-transform" />
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => status !== 'SENDING' && setIsOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-[color:var(--surface)] border-t border-[color:var(--border)] rounded-t-[40px] shadow-2xl p-8 pb-10 slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-[color:var(--surface-3)] rounded-full mx-auto mb-8" />

            {status === 'SENT' ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center fade-in">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center">
                  <Check size={40} className="text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-[color:var(--text-1)]">Request Sent!</h3>
                  <p className="mt-2 text-sm font-medium text-[color:var(--text-3)]">
                    {sentType === 'BILL' ? 'Your bill is on the way' : 'Someone will be with you shortly'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-black tracking-tight text-[color:var(--text-1)]">How can we help?</h3>
                  <button onClick={() => setIsOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-[color:var(--surface-3)] text-[color:var(--text-3)] hover:brightness-95 transition-all">
                    <X size={20} />
                  </button>
                </div>

                {!initialTableId && (
                  <div className="mb-8 p-6 rounded-[24px] bg-blue-600/[0.03] border border-blue-600/10">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-3">Assign Table First</p>
                    <input
                      type="text"
                      placeholder="Table Number (e.g. 1)"
                      value={manualTable}
                      onChange={(e) => setManualTable(e.target.value)}
                      className="w-full px-5 py-4 rounded-[16px] border border-blue-600/10 bg-white text-base font-bold text-blue-900 focus:outline-none focus:ring-4 focus:ring-blue-600/10 placeholder:text-blue-900/30 transition-all font-mono"
                    />
                  </div>
                )}

                <div className="grid gap-4">
                  {CALL_TYPES.map((ct) => (
                    <button
                      key={ct.id}
                      onClick={() => handleCall(ct.id)}
                      disabled={status === 'SENDING'}
                      className="flex items-center gap-5 p-4 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)] hover:bg-[color:var(--surface-3)] active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      <div className={`w-14 h-14 ${ct.color} rounded-[20px] flex items-center justify-center text-white shadow-xl`}>
                        {status === 'SENDING' && sentType === ct.id ? <Loader2 size={24} className="animate-spin" /> : ct.icon}
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-bold text-lg text-[color:var(--text-1)]">{ct.label}</p>
                        <p className="text-xs font-medium text-[color:var(--text-3)]">{ct.desc}</p>
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
