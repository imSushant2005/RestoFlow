import { useCallback, useEffect, useState, useMemo, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Clock, 
  ChevronRight, 
  Star, 
  MapPin, 
  CheckCircle2, 
  ChefHat, 
  UtensilsCrossed, 
  Clock3, 
  Timer,
  ArrowLeft
} from 'lucide-react';
import { io } from 'socket.io-client';
import { api, publicApi } from '../lib/api';
import { getCustomerTokenForTenant, getActiveSessionForTenant, getSessionAccessTokenForTenant } from '../lib/tenantStorage';
import { getSocketUrl } from '../lib/network';

interface StepConfig {
  label: string;
  icon: ReactNode;
  rank: number;
  glow: string;
}

const STEPS: StepConfig[] = [
  { label: 'Wait', icon: <Clock size={20} />, rank: 0, glow: 'from-slate-500/30 to-slate-500/10' },
  { label: 'Accepted', icon: <CheckCircle2 size={20} />, rank: 1, glow: 'from-blue-500/30 to-indigo-500/10' },
  { label: 'Preparing', icon: <ChefHat size={20} />, rank: 2, glow: 'from-amber-500/30 to-orange-500/10' },
  { label: 'Ready', icon: <UtensilsCrossed size={20} />, rank: 3, glow: 'from-emerald-500/30 to-green-500/10' },
  { label: 'Served', icon: <Clock3 size={20} />, rank: 5, glow: 'from-violet-500/30 to-fuchsia-500/10' },
  { label: 'Paid', icon: <Star size={20} />, rank: 6, glow: 'from-rose-500/30 to-red-500/10' },
];

function getSessionRank(session: any) {
  if (session.bill?.paymentStatus === 'PAID') return 6;
  const orders = session.orders || [];
  if (orders.length === 0) return 0;
  
  const ranks = orders.map((o: any) => {
    switch (o.status) {
      case 'ACCEPTED': return 1;
      case 'PREPARING': return 2;
      case 'READY': return 3;
      case 'SERVED': return 5;
      case 'RECEIVED': return 6;
      default: return 0;
    }
  });
  return Math.max(...ranks);
}

export function HistoryPage() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const token = getCustomerTokenForTenant(tenantSlug);
  const activeSessionId = getActiveSessionForTenant(tenantSlug);
  const sessionAccessToken = getSessionAccessTokenForTenant(tenantSlug);
  const hasOpenSessions = useMemo(
    () => sessions.some((session) => session?.sessionStatus !== 'CLOSED'),
    [sessions],
  );

  const fetchHistory = useCallback(async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await api.get('/customer/history', {
        params: { tenantSlug },
        headers,
      });
      setSessions(data);
    } catch {
      // If we are a guest, we might not have 'history' access, 
      // but we still want to show the current active visit if it exists.
      if (activeSessionId) {
        try {
          const { data } = await publicApi.get(`/${tenantSlug}/sessions/${activeSessionId}`);
          setSessions([data]);
        } catch { /* ignore */ }
      }
    } finally {
      setLoading(false);
    }
  }, [activeSessionId, tenantSlug, token]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  // Socket for Live Updates
  useEffect(() => {
    if (!tenantSlug || !sessionAccessToken || !hasOpenSessions) return;

    const socket = io(getSocketUrl(), {
      auth: { tenantSlug, sessionAccessToken, client: 'customer-history' },
      transports: ['websocket'],
    });

    socket.on('order:update', (updatedOrder: any) => {
      setSessions(prev => prev.map(s => {
        if (s.id === updatedOrder.diningSessionId) {
          const newOrders = s.orders.map((o: any) => o.id === updatedOrder.id ? updatedOrder : o);
          return { ...s, orders: newOrders };
        }
        return s;
      }));
    });

    socket.on('session:update', (payload: any) => {
      if (payload.status === 'CLOSED') fetchHistory();
      else {
        setSessions(prev => prev.map(s => s.id === payload.sessionId ? { ...s, sessionStatus: payload.status } : s));
      }
    });

    return () => { socket.disconnect(); };
  }, [fetchHistory, hasOpenSessions, sessionAccessToken, tenantSlug]);

  const formatINR = (amt: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
      Number(amt || 0),
    );

  const { liveVisits, pastVisits } = useMemo(() => {
    return {
      liveVisits: sessions.filter(s => s.sessionStatus !== 'CLOSED'),
      pastVisits: sessions.filter(s => s.sessionStatus === 'CLOSED'),
    };
  }, [sessions]);

  if (loading)
    return (
      <div className="min-h-[100dvh] transition-colors duration-400 flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-10 h-10 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--brand-soft)', borderTopColor: 'var(--brand)' }} />
      </div>
    );

  if (!token && !activeSessionId)
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-6 p-8 text-center" style={{ background: 'var(--bg)' }}>
        <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400">
          <Clock size={40} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">Order History</h2>
          <p className="text-slate-500 font-medium">Please login to see your full order history across all visits.</p>
        </div>
        <button onClick={() => navigate(-1)} className="px-8 py-3.5 rounded-2xl bg-blue-600 text-white font-black text-sm shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
          Go Back
        </button>
      </div>
    );

  return (
    <div className="min-h-[100dvh] pb-24" style={{ background: 'var(--bg)' }}>
      <div className="sticky top-0 z-40 px-6 pt-12 pb-6 backdrop-blur-md" style={{ background: 'var(--surface-60)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90" style={{ background: 'var(--surface-3)', color: 'var(--text-1)' }}>
             <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>My Orders</h1>
            <p className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>{liveVisits.length} active • {pastVisits.length} past</p>
          </div>
        </div>
      </div>

      <div className="max-w-screen-sm mx-auto px-6 py-8 space-y-10">
        {/* LIVE VISITS SECTION */}
        {liveVisits.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>Live Now</h2>
            </div>
            
            {liveVisits.map((s: any) => {
              const currentRank = getSessionRank(s);
              const orders = s.orders || [];
              const totalAmount = s.bill?.totalAmount || orders.reduce((sum: number, o: any) => sum + (Number(o.totalAmount) || 0), 0) || 0;
              
              return (
                <div 
                  key={s.id}
                  className="relative overflow-hidden rounded-[2.5rem] border p-8 shadow-2xl transition-all active:scale-[0.99] group"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  onClick={() => navigate(`/order/${tenantSlug}/session/${s.id}/bill`)}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full opacity-10" style={{ background: 'var(--brand)' }} />
                  
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="text-xl font-black" style={{ color: 'var(--text-1)' }}>{s.tenant?.businessName || 'Restaurant'}</h3>
                      <p className="text-xs font-bold mt-1" style={{ color: 'var(--text-3)' }}>{s.table?.name || 'Takeaway'} • {s.orders?.length || 0} orders</p>
                    </div>
                    <div className="text-right">
                       <p className="text-2xl font-black" style={{ color: 'var(--brand)' }}>{formatINR(totalAmount)}</p>
                       <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Running Total</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {STEPS.map((step) => {
                      const completed = currentRank >= step.rank;
                      const isCurrent = currentRank === step.rank;
                      return (
                        <div key={step.label} className="flex flex-col items-center gap-2">
                          <div 
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${completed ? 'scale-100 shadow-lg' : 'scale-90 opacity-20 filter grayscale'}`}
                            style={{ 
                              background: completed ? 'var(--brand)' : 'var(--surface-3)',
                              color: completed ? 'white' : 'var(--text-3)',
                              boxShadow: isCurrent ? `0 0 20px -5px var(--brand)` : 'none'
                            }}
                          >
                            {step.icon}
                          </div>
                          <span className={`text-[8px] font-black uppercase tracking-tight text-center ${completed ? 'opacity-100' : 'opacity-30'}`} style={{ color: 'var(--text-1)' }}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-8 flex items-center justify-between pt-6 border-t border-dashed" style={{ borderColor: 'var(--border)' }}>
                     <div className="flex items-center gap-2">
                        <Timer size={14} className="text-emerald-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Live Updates Enabled</span>
                     </div>
                     <ChevronRight size={18} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PAST VISITS SECTION */}
        <div className="space-y-6">
          <h2 className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>Past Visits</h2>
          
          {pastVisits.length === 0 ? (
             <div className="text-center py-16 rounded-[2.5rem] border-2 border-dashed" style={{ borderColor: 'var(--border)' }}>
                <Clock size={40} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 font-bold">No past visits recorded</p>
                <p className="text-xs text-slate-400 mt-1">Your detailed receipts will appear here.</p>
             </div>
          ) : (
            <div className="space-y-3">
              {pastVisits.map((s: any) => {
                const totalItems = s.orders?.reduce((sum: number, o: any) => sum + (o._count?.items || 0), 0) || 0;
                const paid = s.bill?.paymentStatus === 'PAID';
                const fallbackTotal =
                  s.orders?.reduce((sum: number, order: any) => sum + (Number(order?.totalAmount) || 0), 0) || 0;
                
                return (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/order/${tenantSlug}/session/${s.id}/bill`)}
                    className="w-full bg-[color:var(--bg-secondary)] rounded-3xl border border-[color:var(--border-primary)] p-5 shadow-sm text-left flex justify-between items-center group hover:shadow-md transition-all active:scale-[0.98]"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-[color:var(--text-primary)] text-base truncate" style={{ color: 'var(--text-1)' }}>
                          {s.tenant?.businessName || 'Restaurant'}
                        </span>
                        {paid && (
                          <span className="bg-emerald-500/10 text-emerald-500 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider">
                            Paid
                          </span>
                        )}
                        {s.review && (
                          <span className="flex items-center gap-0.5 text-xs text-amber-500 font-bold">
                            <Star size={10} fill="currentColor" /> {s.review.overallRating}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                        <span className="flex items-center gap-1">
                          <MapPin size={10} /> {s.table?.name || 'Takeaway'}
                        </span>
                        <span>{totalItems} items</span>
                        <span>{new Date(s.openedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <span className="font-black text-lg" style={{ color: 'var(--text-1)' }}>{formatINR(Number(s.bill?.totalAmount || 0) || fallbackTotal)}</span>
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
