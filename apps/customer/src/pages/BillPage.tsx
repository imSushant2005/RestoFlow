import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { publicApi } from '../lib/api';
import { Share2, Download, CreditCard, Users, X, Star } from 'lucide-react';

export function BillPage() {
  const { tenantSlug, sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [splitCount, setSplitCount] = useState(2);

  useEffect(() => {
    const fetchBill = async () => {
      try {
        const res = await publicApi.get(`/${tenantSlug}/sessions/${sessionId}/bill`);
        setSession(res.data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchBill();
  }, [tenantSlug, sessionId]);

  const formatINR = (amt: number) => `₹${Number(amt || 0).toFixed(2)}`;

  const shareWhatsApp = () => {
    if (!session?.bill) return;
    const bill = session.bill;
    const items = session.orders?.flatMap((o: any) => o.items || []) || [];
    const itemLines = items.map((i: any) => `- ${i.name} x${i.quantity}: ${formatINR(i.totalPrice)}`).join('\n');
    const msg = `*${session.tenant?.businessName || 'RestoFlow'} — Final Bill*\n\nTable: ${session.table?.name || 'N/A'}\nGuests: ${session.partySize}\n\n${itemLines}\n\nSubtotal: ${formatINR(
      bill.subtotal
    )}\nTax: ${formatINR(bill.taxAmount)}\n*Total: ${formatINR(bill.totalAmount)}*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const downloadInvoice = () => {
    if (!session?.bill) return;
    window.print();
  };

  const payNow = async () => {
    if (!sessionId || !tenantSlug) return;
    setPaying(true);
    try {
      await publicApi.post(`/${tenantSlug}/sessions/${sessionId}/complete`, { paymentMethod: 'upi' });
      const refreshed = await publicApi.get(`/${tenantSlug}/sessions/${sessionId}/bill`);
      setSession(refreshed.data);
      alert('Payment recorded successfully.');
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
    return {
      perHead: Number(bill.totalAmount || 0) / count,
    };
  }, [session?.bill, splitCount]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[color:var(--bg-primary)] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session?.bill || typeof session.bill.totalAmount !== 'number') {
    return (
      <div className="min-h-[100dvh] bg-[color:var(--bg-primary)] flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-[color:var(--text-secondary)] font-bold">Bill not found or not generated yet</p>
        <button onClick={() => navigate(-1)} className="text-blue-500 font-bold text-sm">← Go back</button>
      </div>
    );
  }

  const bill = session.bill;
  const allItems = session.orders?.flatMap((o: any) => o.items || []) || [];

  return (
    <div className="min-h-[100dvh] bg-[color:var(--bg-primary)] pb-8 print:bg-white">
      <div className="bg-gradient-to-br from-orange-500 to-red-500 px-6 pt-12 pb-12 text-white text-center print:hidden">
        <p className="text-sm font-bold text-white/80 uppercase tracking-wider">Final Bill</p>
        <h1 className="text-5xl font-black mt-2">{formatINR(bill.totalAmount)}</h1>
        <p className="text-white/70 text-xs mt-2 font-medium">
          {session.tenant?.businessName} • {session.table?.name || 'Takeaway'}
        </p>
      </div>

      <div className="px-4 -mt-8 relative z-10 print:px-0 print:mt-0">
        <div className="bg-[color:var(--bg-secondary)] rounded-3xl shadow-xl border border-[color:var(--border-primary)] overflow-hidden print:rounded-none print:shadow-none print:border-none">
          <div className="px-6 py-4 border-b border-[color:var(--border-primary)] print:border-gray-200">
            <div className="flex justify-between text-xs text-[color:var(--text-secondary)]">
              <div>
                <p className="font-bold">{session.partySize} Guests</p>
                <p>{new Date(session.openedAt).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p>
                  {new Date(session.openedAt).toLocaleTimeString()} — {session.closedAt ? new Date(session.closedAt).toLocaleTimeString() : 'Now'}
                </p>
                <p className="font-bold">{session.orders?.length || 0} order(s)</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <section>
              <h3 className="text-sm font-black uppercase tracking-wider text-[color:var(--text-secondary)] mb-3">Items</h3>
              <div className="space-y-2">
                {allItems.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-[color:var(--text-primary)]">
                      <span className="font-bold text-blue-500 mr-1">{item.quantity}x</span>
                      {item.name}
                    </span>
                    <span className="font-bold text-[color:var(--text-primary)]">{formatINR(item.totalPrice)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-[color:var(--border-primary)] pt-4 space-y-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-[color:var(--text-secondary)] mb-1">Totals</h3>
              <div className="flex justify-between text-sm">
                <span className="text-[color:var(--text-secondary)]">Subtotal</span>
                <span className="font-bold text-[color:var(--text-primary)]">{formatINR(bill.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[color:var(--text-secondary)]">Tax</span>
                <span className="font-bold text-[color:var(--text-primary)]">{formatINR(bill.taxAmount)}</span>
              </div>
              {bill.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-500">Discount</span>
                  <span className="font-bold text-green-500">-{formatINR(bill.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-end border-t border-[color:var(--border-primary)] pt-3 mt-2">
                <span className="font-black text-[color:var(--text-primary)] text-lg">Total</span>
                <span className="font-black text-orange-500 text-3xl">{formatINR(bill.totalAmount)}</span>
              </div>
            </section>

            <div
              className={`text-center py-3 rounded-xl font-bold text-sm ${
                bill.paymentStatus === 'PAID' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
              }`}
            >
              {bill.paymentStatus === 'PAID' ? 'Payment Complete' : 'Payment Pending'}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 print:hidden">
          <button
            onClick={() => setShowSplit(true)}
            className="bg-slate-100 text-slate-700 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <Users size={16} /> Split Bill
          </button>
          <button
            onClick={payNow}
            disabled={paying || bill.paymentStatus === 'PAID'}
            className="bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-60"
          >
            <CreditCard size={16} /> {bill.paymentStatus === 'PAID' ? 'Paid' : paying ? 'Processing...' : 'Pay Now'}
          </button>
          <button
            onClick={downloadInvoice}
            className="bg-blue-50 text-blue-700 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <Download size={16} /> Download Invoice
          </button>
          <button
            onClick={shareWhatsApp}
            className="bg-green-500 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-green-500/25"
          >
            <Share2 size={16} /> Share Bill
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 print:hidden">
          <button
            onClick={() => navigate(`/order/${tenantSlug}/status`)}
            className="w-full text-center text-sm font-bold text-blue-500 py-3 rounded-2xl bg-blue-50"
          >
            View Order Status
          </button>
          <button
            onClick={() => navigate(`/order/${tenantSlug}/history`)}
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2"
          >
            <Star size={15} /> Rate Us
          </button>
        </div>
      </div>

      {showSplit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-lg text-gray-900">Split Bill</h3>
              <button onClick={() => setShowSplit(false)} className="text-gray-500 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Number of people</label>
            <input
              type="number"
              min={1}
              max={20}
              value={splitCount}
              onChange={(e) => setSplitCount(Math.max(1, Number(e.target.value) || 1))}
              className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2"
            />

            <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs text-slate-500 font-bold uppercase">Per person</p>
              <p className="text-3xl font-black text-slate-900 mt-1">{formatINR(splitValues.perHead)}</p>
            </div>

            <button
              onClick={() => {
                const msg = `Split ${formatINR(bill.totalAmount)} between ${splitCount} people = ${formatINR(splitValues.perHead)} each`;
                navigator.clipboard?.writeText(msg);
                alert('Split summary copied');
              }}
              className="w-full mt-4 bg-blue-600 text-white font-bold py-2.5 rounded-xl"
            >
              Copy Split Summary
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
