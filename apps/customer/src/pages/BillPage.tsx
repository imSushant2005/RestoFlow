import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { publicApi } from '../lib/api';
import { Share2, Download, CreditCard, Users, X, Star, ChevronLeft, Receipt, CheckCircle2 } from 'lucide-react';
import { formatINR } from '../lib/currency';

export function BillPage() {
  const { tenantSlug, sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [splitCount, setSplitCount] = useState(2);

  useEffect(() => {
    const fetchBill = async () => {
      if (!tenantSlug || !sessionId) return;
      try {
        const res = await publicApi.get(`/${tenantSlug}/sessions/${sessionId}/bill`);
        setSession(res.data);
      } catch (err) {
        console.error('[BILL_FETCH_ERROR]', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBill();
  }, [tenantSlug, sessionId]);

  const shareWhatsApp = () => {
    if (!session?.bill) return;
    const bill = session.bill;
    const items = session.orders?.flatMap((o: any) => o.items || []) || [];
    const itemLines = items.map((i: any) => `- ${i.name} x${i.quantity}: ${formatINR(i.totalPrice)}`).join('\n');
    const msg = `🧾 *Final Bill - ${session.tenant?.businessName || 'RestoFlow'}*\n\nTable: ${session.table?.name || 'Takeaway'}\n\n${itemLines}\n\nSubtotal: ${formatINR(bill.subtotal)}\nTax: ${formatINR(bill.taxAmount)}\n*Total: ${formatINR(bill.totalAmount)}*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const downloadInvoice = () => {
    window.print();
  };

  const payNow = async () => {
    if (!sessionId || !tenantSlug) return;
    setPaying(true);
    try {
      await publicApi.post(`/${tenantSlug}/sessions/${sessionId}/complete`, { paymentMethod: 'upi' });
      const refreshed = await publicApi.get(`/${tenantSlug}/sessions/${sessionId}/bill`);
      setSession(refreshed.data);
    } catch (error: any) {
      alert(error?.response?.data?.error || 'Failed to complete payment');
    } finally {
      setPaying(false);
    }
  };

  const splitValues = useMemo(() => {
    const bill = session?.bill;
    const count = Math.max(1, splitCount);
    if (!bill) return { perHead: 0 };
    return { perHead: Number(bill.totalAmount || 0) / count };
  }, [session?.bill, splitCount]);

  const latestReviewableOrder = useMemo(() => {
    if (!session?.orders || session?.review) return null;
    const receivedOrders = session.orders.filter((order: any) => order.status === 'RECEIVED' && !order.hasReview);
    if (receivedOrders.length > 0) {
      return receivedOrders.sort(
        (a: any, b: any) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime(),
      )[0];
    }
    const nonCancelled = session.orders.filter((order: any) => order.status !== 'CANCELLED');
    if (nonCancelled.length === 0) return null;
    return nonCancelled.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [session?.orders, session?.review]);

  const submitReview = async () => {
    if (!tenantSlug || !sessionId || !latestReviewableOrder) return;
    if (reviewRating <= 0) {
      alert('Please select a star rating first.');
      return;
    }
    setSubmittingReview(true);
    try {
      await publicApi.post(`/orders/${latestReviewableOrder.id}/feedback`, {
        rating: reviewRating,
        feedback: reviewComment.trim() || undefined,
      });
      const refreshed = await publicApi.get(`/${tenantSlug}/sessions/${sessionId}/bill`);
      setSession(refreshed.data);
      setReviewRating(0);
      setReviewComment('');
    } catch (error: any) {
      alert(error?.response?.data?.error || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-10 h-10 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--brand-soft)', borderTopColor: 'var(--brand)' }} />
      </div>
    );
  }

  if (!session?.bill || typeof session.bill.totalAmount !== 'number') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-6 p-10 text-center" style={{ background: 'var(--bg)' }}>
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}>
          <Receipt size={40} />
        </div>
        <div>
          <h2 className="text-2xl font-black mb-2" style={{ color: 'var(--text-1)' }}>Bill not generated</h2>
          <p className="font-medium" style={{ color: 'var(--text-3)' }}>The final bill is being prepared by the restaurant. Please wait a moment.</p>
        </div>
        <button onClick={() => navigate(-1)} className="px-8 py-3.5 rounded-2xl font-black text-sm transition-all active:scale-95" style={{ background: 'var(--brand)', color: 'white' }}>Go Back</button>
      </div>
    );
  }

  const bill = session.bill;
  const allItems = session.orders?.flatMap((o: any) => o.items || []) || [];
  const brandColor = session.tenant?.primaryColor || '#f97316';

  return (
    <div className="min-h-[100dvh] pb-12 transition-colors duration-400 print:bg-white" style={{ background: 'var(--bg)', '--brand': brandColor } as any}>
      {/* Header Partial */}
      <div className="px-6 pt-12 pb-24 text-center relative overflow-hidden print:hidden" style={{ background: 'var(--surface)' }}>
        <div className="absolute top-0 right-0 w-64 h-64 blur-[100px] rounded-full opacity-10" style={{ background: 'var(--brand)' }} />
        <button 
          onClick={() => navigate(-1)} 
          className="absolute left-6 top-10 w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90"
          style={{ background: 'var(--surface-3)', color: 'var(--text-1)' }}
        >
          <ChevronLeft size={20} />
        </button>
        
        <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-3)' }}>Final Settlement</p>
        <h1 className="text-5xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>{formatINR(bill.totalAmount)}</h1>
        <p className="text-sm font-bold mt-3 opacity-60" style={{ color: 'var(--text-2)' }}>
          {session.tenant?.businessName} • {session.table?.name || 'Takeaway'}
        </p>
      </div>

      <div className="max-w-screen-sm mx-auto px-6 -mt-12 relative z-10 print:mt-0 print:px-0">
        <div className="rounded-[40px] shadow-2xl overflow-hidden border print:shadow-none print:border-none print:rounded-none" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          {/* Bill Status Banner */}
          <div className="px-6 py-4 flex items-center justify-between" style={{ background: bill.paymentStatus === 'PAID' ? 'var(--success)' : 'var(--brand)', color: 'white' }}>
             <div className="flex items-center gap-2">
                {bill.paymentStatus === 'PAID' ? <CheckCircle2 size={16} /> : <CreditCard size={16} />}
                <span className="text-xs font-black uppercase tracking-widest">{bill.paymentStatus === 'PAID' ? 'Settled' : 'Payment Awaited'}</span>
             </div>
             <span className="text-[10px] font-black opacity-80">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          <div className="p-8 space-y-10">
            {/* Meta Info */}
            <div className="flex justify-between items-start pb-8 border-b border-dashed" style={{ borderColor: 'var(--border)' }}>
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>Session Date</p>
                  <p className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>{new Date(session.openedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
               </div>
               <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>Status</p>
                  <p className="font-bold text-sm" style={{ color: bill.paymentStatus === 'PAID' ? 'var(--success)' : 'var(--error)' }}>
                    {bill.paymentStatus === 'PAID' ? 'Verified' : 'Pending'}
                  </p>
               </div>
            </div>

            {/* Items List */}
            <section>
              <h3 className="text-xs font-black uppercase tracking-widest mb-6" style={{ color: 'var(--text-3)' }}>Ordered Items</h3>
              <div className="space-y-4">
                {allItems.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center group">
                    <div className="flex items-center gap-3">
                       <span className="w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-black transition-colors" style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}>{item.quantity}</span>
                       <span className="font-bold text-sm" style={{ color: 'var(--text-2)' }}>{item.name}</span>
                    </div>
                    <span className="font-black text-sm" style={{ color: 'var(--text-1)' }}>{formatINR(item.totalPrice)}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Totals Section */}
            <section className="pt-8 border-t border-dashed space-y-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex justify-between text-sm font-bold">
                <span style={{ color: 'var(--text-3)' }}>Subtotal</span>
                <span style={{ color: 'var(--text-1)' }}>{formatINR(bill.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span style={{ color: 'var(--text-3)' }}>Tax & GST</span>
                <span style={{ color: 'var(--text-1)' }}>{formatINR(bill.taxAmount)}</span>
              </div>
              {bill.discountAmount > 0 && (
                <div className="flex justify-between text-sm font-black">
                  <span className="text-emerald-500">Loyalty Discount</span>
                  <span className="text-emerald-500">-{formatINR(bill.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-8 mt-2">
                <span className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>Payable</span>
                <span className="text-4xl font-black" style={{ color: 'var(--brand)' }}>{formatINR(bill.totalAmount)}</span>
              </div>
            </section>

            {/* Decorative Receipt Cutout */}
            <div className="relative h-4 flex items-center justify-center overflow-hidden">
               <div className="absolute inset-0 border-t border-dashed" style={{ borderColor: 'var(--border)' }} />
               <div className="flex gap-2 relative z-10 px-4" style={{ background: 'var(--surface)' }}>
                  {[1,2,3,4,5].map(i => <div key={i} className="w-1 h-1 rounded-full bg-gray-200" />)}
               </div>
            </div>

            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30" style={{ color: 'var(--text-3)' }}>Thank you for visiting</p>
            </div>
          </div>
        </div>

        {/* Action Grid */}
        <div className="mt-8 grid grid-cols-2 gap-4 print:hidden">
          <button
            onClick={() => setShowSplit(true)}
            className="flex flex-col items-center justify-center gap-2 p-5 rounded-3xl border transition-all active:scale-95 group"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center group-hover:rotate-6 transition-transform" style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}>
              <Users size={20} />
            </div>
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-1)' }}>Split Bill</span>
          </button>
          
          <button
            onClick={payNow}
            disabled={paying || bill.paymentStatus === 'PAID'}
            className="flex flex-col items-center justify-center gap-2 p-5 rounded-3xl border transition-all active:scale-95 text-white shadow-xl shadow-brand/20 group"
            style={{ background: 'var(--brand)', borderColor: 'var(--brand)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/20 group-hover:scale-110 transition-transform">
              {paying ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CreditCard size={20} />}
            </div>
            <span className="text-xs font-black uppercase tracking-widest">
               {bill.paymentStatus === 'PAID' ? 'Settled' : 'Pay via UPI'}
            </span>
          </button>

          <button
            onClick={downloadInvoice}
            className="flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all active:scale-95 text-sm font-black"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-1)' }}
          >
            <Download size={18} /> Save PDF
          </button>
          
          <button
            onClick={shareWhatsApp}
            className="flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all active:scale-95 text-sm font-black text-white"
            style={{ background: '#25D366', borderColor: '#25D366' }}
          >
            <Share2 size={18} /> WhatsApp
          </button>
        </div>

        {bill.paymentStatus === 'PAID' && (
          <div className="mt-8 rounded-[32px] border p-6 print:hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            {session?.review ? (
              <>
                <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>
                  Your Review
                </p>
                <div className="mt-2 flex items-center gap-1 text-amber-500">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={18}
                      className={session.review.overallRating >= star ? 'fill-current text-amber-500' : 'text-gray-300'}
                    />
                  ))}
                </div>
                <p className="mt-3 text-sm font-bold" style={{ color: 'var(--text-1)' }}>
                  {session.review.comment?.trim() ? session.review.comment : 'Thanks for rating your experience.'}
                </p>
              </>
            ) : (
              <>
                <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>
                  Rate Your Experience
                </p>
                <h3 className="mt-2 text-xl font-black" style={{ color: 'var(--text-1)' }}>
                  How was your order?
                </h3>
                <div className="mt-4 flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => setReviewRating(star)} className="transition-transform hover:scale-105 active:scale-95">
                      <Star size={28} className={reviewRating >= star ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
                    </button>
                  ))}
                </div>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Tell us what you liked (optional)"
                  className="mt-4 min-h-[96px] w-full rounded-2xl p-4 text-sm font-semibold outline-none"
                  style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                />
                <button
                  onClick={submitReview}
                  disabled={reviewRating === 0 || submittingReview || !latestReviewableOrder}
                  className="mt-4 w-full rounded-2xl bg-[#1a1c23] py-3.5 text-sm font-black text-white transition-all active:scale-[0.98] disabled:opacity-40"
                >
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Bottom Nav Links */}
        <div className="mt-8 flex flex-col gap-3 print:hidden">
          <button
            onClick={() => navigate(`/order/${tenantSlug}/status`)}
            className="w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ea580c)', color: 'white' }}
          >
            <Star size={18} fill="white" /> Rate your Experience
          </button>
          <button
            onClick={() => navigate(`/order/${tenantSlug}/status`)}
            className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all hover:opacity-100 opacity-60"
            style={{ color: 'var(--text-3)' }}
          >
            Past Orders Breakdown
          </button>
        </div>
      </div>

      {/* Split Bill Modal */}
      {showSplit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 print:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowSplit(false)} />
          <div className="bg-[color:var(--surface)] rounded-[40px] shadow-2xl relative z-10 w-full max-w-sm overflow-hidden" style={{ background: 'var(--surface)' }}>
            <div className="p-8 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black" style={{ color: 'var(--text-1)' }}>Split Logic</h3>
                <button onClick={() => setShowSplit(false)} style={{ color: 'var(--text-3)' }}>
                  <X size={24} />
                </button>
              </div>

              <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>Split between how many?</p>
              <div className="flex items-center gap-4 bg-black/5 p-2 rounded-2xl" style={{ background: 'var(--surface-3)' }}>
                 <button onClick={() => setSplitCount(Math.max(1, splitCount - 1))} className="w-12 h-12 rounded-xl flex items-center justify-center bg-white shadow-sm transition-all active:scale-90"><ChevronLeft size={20} /></button>
                 <span className="flex-1 text-center text-xl font-black" style={{ color: 'var(--text-1)' }}>{splitCount}</span>
                 <button onClick={() => setSplitCount(splitCount + 1)} className="w-12 h-12 rounded-xl flex items-center justify-center bg-white shadow-sm transition-all active:scale-90" style={{ transform: 'rotate(180deg)' }}><ChevronLeft size={20} /></button>
              </div>

              <div className="mt-8 p-6 rounded-3xl text-center" style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-soft)' }}>
                 <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--brand)' }}>Contribution per head</p>
                 <p className="text-4xl font-black" style={{ color: 'var(--brand)' }}>{formatINR(splitValues.perHead)}</p>
              </div>

              <button
                onClick={() => {
                  const msg = `Split ${formatINR(bill.totalAmount)} between ${splitCount} people = ${formatINR(splitValues.perHead)} each`;
                  navigator.clipboard?.writeText(msg);
                  alert('Copied to clipboard!');
                }}
                className="w-full mt-8 bg-[#1a1c23] text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95"
              >
                Copy Split Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
