import { useEffect, useMemo, useState } from 'react';
import { Check, Hand, HelpCircle, Loader2, Receipt, Sparkles, Utensils, X } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { publicApi } from '../lib/api';
import { WAITER_ACK_EVENT } from './HandshakeListener';

const BASE_CALL_TYPES = [
  { id: 'SPOON', label: 'Spoon / Tissue', icon: <Utensils size={22} />, color: 'bg-indigo-500', desc: 'Need spoons, napkins, etc.' },
  { id: 'ASSISTANCE', label: 'Assistance', icon: <HelpCircle size={22} />, color: 'bg-orange-500', desc: 'Need help with the menu or order' },
  { id: 'BILL', label: 'Request Bill', icon: <Receipt size={22} />, color: 'bg-emerald-500', desc: 'Get the bill at your table' },
];

function resolveServiceAssistMode(plan?: string, hasWaiterService?: boolean) {
  const normalizedPlan = String(plan || '').trim().toUpperCase();

  if (normalizedPlan === 'MINI') {
    return 'SELF_SERVICE' as const;
  }

  if (normalizedPlan === 'CAFE' && hasWaiterService === false) {
    return 'SELF_SERVICE' as const;
  }

  return 'FULL_SERVICE' as const;
}

function incrementCustomerOverlayLock() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const current = Number(root.dataset.rfCustomerOverlayCount || '0');
  const next = current + 1;
  root.dataset.rfCustomerOverlayCount = String(next);
  root.dataset.rfCustomerOverlay = 'open';
}

function decrementCustomerOverlayLock() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const current = Number(root.dataset.rfCustomerOverlayCount || '0');
  const next = Math.max(0, current - 1);
  if (next === 0) {
    delete root.dataset.rfCustomerOverlayCount;
    delete root.dataset.rfCustomerOverlay;
    return;
  }
  root.dataset.rfCustomerOverlayCount = String(next);
  root.dataset.rfCustomerOverlay = 'open';
}

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
  const [inlineError, setInlineError] = useState('');
  const { activeSheet, setActiveSheet, tenantPlan } = useCartStore();
  const isOpen = activeSheet === 'WAITER';
  const [status, setStatus] = useState<'IDLE' | 'SENDING' | 'SENT' | 'ACCEPTED'>('IDLE');
  const [waiterName, setWaiterName] = useState('');
  const [sentType, setSentType] = useState('');
  const [manualTable, setManualTable] = useState('');

  const tableId = initialTableId || manualTable.trim();
  const serviceAssistMode = resolveServiceAssistMode(tenantPlan);
  const primaryAssistLabel = serviceAssistMode === 'FULL_SERVICE' ? 'Call Waiter' : 'Call Staff';
  const primaryAssistDescription =
    serviceAssistMode === 'FULL_SERVICE'
      ? 'A waiter will come to your table'
      : 'If table service is available, staff will assist you at your table';
  const acceptedTitle = serviceAssistMode === 'FULL_SERVICE' ? 'Waiter is Coming!' : 'Staff is Coming!';

  const callTypes = useMemo(
    () => [
      {
        id: 'WAITER',
        label: primaryAssistLabel,
        icon: <Hand size={22} />,
        color: 'bg-blue-500',
        desc: primaryAssistDescription,
      },
      ...BASE_CALL_TYPES,
    ],
    [primaryAssistDescription, primaryAssistLabel],
  );

  useEffect(() => {
    const onAcknowledged = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      if (event.detail?.tenantSlug !== tenantSlug) return;
      if (event.detail?.sessionId !== sessionId) return;

      setWaiterName(event.detail?.waiterName || '');
      setStatus('ACCEPTED');
      setActiveSheet('WAITER');
    };

    window.addEventListener(WAITER_ACK_EVENT, onAcknowledged);
    return () => window.removeEventListener(WAITER_ACK_EVENT, onAcknowledged);
  }, [sessionId, setActiveSheet, tenantSlug]);

  useEffect(() => {
    if (status !== 'SENT' && status !== 'ACCEPTED') return undefined;

    const timeoutMs = status === 'ACCEPTED' ? 4000 : 30000;
    const timeoutId = window.setTimeout(() => {
      setActiveSheet('NONE');
      setStatus('IDLE');
      setSentType('');
    }, timeoutMs);

    return () => window.clearTimeout(timeoutId);
  }, [setActiveSheet, status]);

  useEffect(() => {
    if (!isOpen) return undefined;
    incrementCustomerOverlayLock();
    return () => {
      decrementCustomerOverlayLock();
    };
  }, [isOpen]);

  const handleCall = async (type: string) => {
    if (!tableId) {
      setInlineError('Enter your table number first so staff knows where to come.');
      return;
    }

    setInlineError('');
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
      setInlineError('Could not send the request right now. Please try once more.');
      setStatus('IDLE');
      setSentType('');
    }
  };

  if (serviceAssistMode === 'SELF_SERVICE') {
    return null;
  }

  const showLauncher = activeSheet === 'NONE';

  return (
    <>
      <button
        onClick={() => setActiveSheet('WAITER')}
        className={`fixed left-1/2 z-[50] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border px-4 py-3 text-left text-white shadow-[0_18px_48px_rgba(15,23,42,0.38)] backdrop-blur-sm transition-all active:scale-[0.98] ${
          showLauncher ? 'pointer-events-auto opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
        }`}
        style={{
          bottom: 'var(--customer-fab-bottom)',
          background: 'linear-gradient(135deg, rgba(37,99,235,0.96), rgba(59,130,246,0.88))',
          borderColor: 'rgba(255,255,255,0.18)',
        }}
        aria-label={primaryAssistLabel}
      >
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white/16">
          <Hand size={22} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-black uppercase tracking-[0.16em]">{primaryAssistLabel}</span>
          <span className="block truncate text-[11px] font-semibold text-white/80">
            {serviceAssistMode === 'FULL_SERVICE' ? 'Quick table help' : 'Call the floor team'}
          </span>
        </span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[160] flex items-end justify-center p-3 sm:p-4"
          onClick={() => status === 'IDLE' && setActiveSheet('NONE')}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative mb-[calc(var(--customer-nav-space)+0.25rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-[36px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 pb-10 shadow-2xl slide-up sm:rounded-[40px] sm:p-8"
            onClick={(event) => event.stopPropagation()}
            style={{
              maxHeight: 'calc(100dvh - var(--customer-nav-space) - 0.75rem)',
              paddingBottom: 'max(2rem, calc(var(--customer-safe-bottom) + 1.25rem))',
            }}
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
                  <h3 className="text-3xl font-black tracking-tight text-[color:var(--text-1)]">
                    {waiterName ? `${waiterName} is Coming!` : acceptedTitle}
                  </h3>
                  <p className="mt-3 text-lg font-bold leading-tight text-blue-500">
                    {waiterName 
                      ? `${waiterName} has accepted your request and will be at your table in a moment.`
                      : 'Your request has been accepted. Help will be at your table in a moment.'}
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
                    onClick={() => setActiveSheet('NONE')}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--surface-3)] text-[color:var(--text-3)] transition-all hover:brightness-95"
                  >
                    <X size={20} />
                  </button>
                </div>

                {inlineError && (
                  <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                    <p className="text-sm font-bold text-red-400">{inlineError}</p>
                  </div>
                )}

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
                  {callTypes.map((callType) => (
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
