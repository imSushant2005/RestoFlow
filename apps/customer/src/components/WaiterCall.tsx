import { useEffect, useState } from 'react';
import { Check, Hand, HelpCircle, Loader2, Receipt, Sparkles, X } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { publicApi } from '../lib/api';
import { WAITER_ACK_EVENT } from './HandshakeListener';

const CALL_TYPES = [
  { id: 'WAITER', label: 'Call Waiter', icon: <Hand size={22} />, color: 'bg-blue-500', desc: 'A waiter will come to your table' },
  { id: 'BILL', label: 'Request Bill', icon: <Receipt size={22} />, color: 'bg-emerald-500', desc: 'Get the bill at your table' },
  { id: 'WATER', label: 'Request Water', icon: <Hand size={22} />, color: 'bg-cyan-500', desc: 'Need fresh water' },
  { id: 'EXTRA', label: 'Request Extra', icon: <Receipt size={22} />, color: 'bg-indigo-500', desc: 'Need spoons, napkins, etc.' },
  { id: 'HELP', label: 'Need Help', icon: <HelpCircle size={22} />, color: 'bg-orange-500', desc: 'Need assistance with something' },
];

const GATED_PLANS = ['FREE', 'STARTER', 'GOLD', 'PLATINUM', 'MINI'];

export function WaiterCall({
  tenantSlug,
  tableId: initialTableId,
  sessionId,
  sessionAccessToken,
}: {
  tenantSlug: string;
  tableId?: string;
  sessionId: string;
  sessionAccessToken: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const tenantPlan = useCartStore((state) => state.tenantPlan);
  const [status, setStatus] = useState<'IDLE' | 'SENDING' | 'SENT' | 'ACCEPTED'>('IDLE');
  const [sentType, setSentType] = useState('');
  const [manualTable, setManualTable] = useState('');

  const tableId = initialTableId || manualTable.trim();

  useEffect(() => {
    const onAcknowledged = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      if (event.detail?.tenantSlug !== tenantSlug) return;
      if (event.detail?.sessionId !== sessionId) return;

      setStatus('ACCEPTED');
      setIsOpen(true);
    };

    window.addEventListener(WAITER_ACK_EVENT, onAcknowledged);
    return () => window.removeEventListener(WAITER_ACK_EVENT, onAcknowledged);
  }, [sessionId, tenantSlug]);

  useEffect(() => {
    if (status !== 'SENT' && status !== 'ACCEPTED') return undefined;

    const timeoutMs = status === 'ACCEPTED' ? 4000 : 30000;
    const timeoutId = window.setTimeout(() => {
      setIsOpen(false);
      setStatus('IDLE');
      setSentType('');
    }, timeoutMs);

    return () => window.clearTimeout(timeoutId);
  }, [status]);

  const handleCall = async (type: string) => {
    if (!tableId) {
      alert('Please enter your table number first.');
      return;
    }

    setStatus('SENDING');
    setSentType(type);

    try {
      await publicApi.post(`/${tenantSlug}/waiter-call`, {
        tableId,
        type,
        sessionId,
        sessionAccessToken,
      });
      setStatus('SENT');
    } catch (error) {
      console.error('Failed to request staff assistance', error);
      setStatus('IDLE');
      setSentType('');
    }
  };

  if (!tenantPlan || GATED_PLANS.includes(tenantPlan.toUpperCase())) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-4 z-[50] h-14 w-14 rounded-full border-4 border-white/20 bg-blue-600 text-white shadow-[0_10px_30px_rgba(37,99,235,0.4)] transition-all active:scale-90"
        style={{ bottom: 'var(--customer-fab-bottom)' }}
        aria-label="Call waiter"
      >
        <span className="flex items-center justify-center">
          <Hand size={24} className="transition-transform group-hover:rotate-12" />
        </span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center"
          onClick={() => status === 'IDLE' && setIsOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md overflow-hidden rounded-t-[40px] border-t border-[color:var(--border)] bg-[color:var(--surface)] p-8 pb-10 shadow-2xl slide-up"
            onClick={(event) => event.stopPropagation()}
            style={{ paddingBottom: 'max(2.5rem, calc(env(safe-area-inset-bottom) + 1.5rem))' }}
          >
            <div className="mx-auto mb-8 h-1.5 w-12 rounded-full bg-[color:var(--surface-3)]" />

            {status === 'ACCEPTED' ? (
              <div className="fade-in flex flex-col items-center gap-4 py-8 text-center">
                <div className="relative">
                  <div className="relative z-10 flex h-24 w-24 rotate-12 items-center justify-center rounded-3xl bg-blue-600 text-white shadow-2xl shadow-blue-600/40">
                    <Hand size={40} className="animate-bounce" />
                  </div>
                  <Sparkles className="absolute -right-4 -top-4 animate-pulse text-amber-400" size={32} />
                  <div className="absolute -bottom-2 -left-2 h-12 w-12 rounded-full bg-blue-400/20 blur-xl animate-pulse" />
                </div>
                <div className="mt-4">
                  <h3 className="text-3xl font-black tracking-tight text-[color:var(--text-1)]">Waiter is Coming!</h3>
                  <p className="mt-3 text-lg font-bold leading-tight text-blue-500">
                    Your request has been accepted. Help will be at your table in a moment.
                  </p>
                </div>
              </div>
            ) : status === 'SENT' ? (
              <div className="fade-in flex flex-col items-center gap-4 py-8 text-center">
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
                  <Check size={40} className="text-emerald-500" />
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-[color:var(--text-1)]">Request Sent!</h3>
                  <p className="mt-2 text-sm font-medium text-[color:var(--text-3)]">
                    {sentType === 'BILL' ? 'Preparing your bill...' : 'Waiting for staff to acknowledge...'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-8 flex items-center justify-between">
                  <h3 className="text-2xl font-black tracking-tight text-[color:var(--text-1)]">How can we help?</h3>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--surface-3)] text-[color:var(--text-3)] transition-all hover:brightness-95"
                  >
                    <X size={20} />
                  </button>
                </div>

                {!initialTableId && (
                  <div className="mb-8 rounded-[32px] border border-blue-600/20 bg-blue-600/[0.05] p-6 backdrop-blur-md">
                    <p className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-blue-500">Assign Table First</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Enter Table (e.g. 5)"
                      value={manualTable}
                      onChange={(event) => setManualTable(event.target.value)}
                      className="w-full rounded-[20px] border border-blue-600/20 bg-[color:var(--surface-raised)] px-5 py-4 font-mono text-lg font-black text-[color:var(--text-1)] shadow-inner transition-all placeholder:text-[color:var(--text-3)]/40 focus:outline-none focus:ring-4 focus:ring-blue-600/20"
                    />
                  </div>
                )}

                <div className="grid gap-4">
                  {CALL_TYPES.map((callType) => (
                    <button
                      key={callType.id}
                      onClick={() => handleCall(callType.id)}
                      disabled={status === 'SENDING'}
                      className="flex items-center gap-5 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 transition-all active:scale-[0.98] disabled:opacity-50 hover:bg-[color:var(--surface-3)]"
                    >
                      <div className={`flex h-14 w-14 items-center justify-center rounded-[20px] text-white shadow-xl ${callType.color}`}>
                        {status === 'SENDING' && sentType === callType.id ? (
                          <Loader2 size={24} className="animate-spin" />
                        ) : (
                          callType.icon
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-lg font-bold text-[color:var(--text-1)]">{callType.label}</p>
                        <p className="text-xs font-medium text-[color:var(--text-3)]">{callType.desc}</p>
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
