import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { publicApi } from '../lib/api';
import { Download, Share2, Star, MessageCircle } from 'lucide-react';

export function BillPage() {
  const { tenantSlug, sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBill = async () => {
      try {
        const res = await publicApi.get(`/${tenantSlug}/sessions/${sessionId}/bill`);
        setSession(res.data);
      } catch {} finally {
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
    const msg = `🍽 *${session.tenant?.businessName || 'RestoFlow'} — Final Bill*\n\nTable: ${session.table?.name || 'N/A'}\nGuests: ${session.partySize}\n\n${itemLines}\n\n─────────────\nSubtotal: ${formatINR(bill.subtotal)}\nTax: ${formatINR(bill.taxAmount)}\n*Total: ${formatINR(bill.totalAmount)}*\n\nThank you for dining with us! 🙏`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (loading) return (
    <div className="min-h-[100dvh] bg-[color:var(--bg-primary)] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  if (!session?.bill) return (
    <div className="min-h-[100dvh] bg-[color:var(--bg-primary)] flex flex-col items-center justify-center gap-4 p-6">
      <p className="text-[color:var(--text-secondary)] font-bold">Bill not found or not generated yet</p>
      <button onClick={() => navigate(-1)} className="text-blue-500 font-bold text-sm">← Go back</button>
    </div>
  );

  const bill = session.bill;
  const allItems = session.orders?.flatMap((o: any) => o.items || []) || [];

  return (
    <div className="min-h-[100dvh] bg-[color:var(--bg-primary)] pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-500 to-red-500 px-6 pt-12 pb-10 text-white text-center">
        <p className="text-sm font-bold text-white/80 uppercase tracking-wider">Final Bill</p>
        <h1 className="text-4xl font-black mt-2">{formatINR(bill.totalAmount)}</h1>
        <p className="text-white/70 text-xs mt-1 font-medium">
          {session.tenant?.businessName} • {session.table?.name || 'Takeaway'}
        </p>
      </div>

      {/* Bill Details */}
      <div className="px-4 -mt-6 relative z-10">
        <div className="bg-[color:var(--bg-secondary)] rounded-3xl shadow-xl border border-[color:var(--border-primary)] p-6">
          {/* Session Info */}
          <div className="flex justify-between text-xs text-[color:var(--text-secondary)] mb-4 pb-3 border-b border-[color:var(--border-primary)]">
            <div>
              <p className="font-bold">{session.partySize} Guests</p>
              <p>{new Date(session.openedAt).toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <p>{new Date(session.openedAt).toLocaleTimeString()} — {session.closedAt ? new Date(session.closedAt).toLocaleTimeString() : 'Now'}</p>
              <p className="font-bold">{session.orders?.length || 0} order(s)</p>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3 mb-4">
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

          {/* Totals */}
          <div className="border-t border-[color:var(--border-primary)] pt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[color:var(--text-secondary)]">Subtotal</span>
              <span className="font-bold text-[color:var(--text-primary)]">{formatINR(bill.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[color:var(--text-secondary)]">Tax</span>
              <span className="font-bold text-[color:var(--text-primary)]">{formatINR(bill.taxAmount)}</span>
            </div>
            {bill.serviceCharge > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[color:var(--text-secondary)]">Service Charge</span>
                <span className="font-bold text-[color:var(--text-primary)]">{formatINR(bill.serviceCharge)}</span>
              </div>
            )}
            {bill.discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-green-500">Discount</span>
                <span className="font-bold text-green-500">-{formatINR(bill.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg border-t border-[color:var(--border-primary)] pt-3 mt-2">
              <span className="font-black text-[color:var(--text-primary)]">Grand Total</span>
              <span className="font-black text-orange-500 text-xl">{formatINR(bill.totalAmount)}</span>
            </div>
          </div>

          {/* Payment Status */}
          <div className={`mt-4 text-center py-3 rounded-xl font-bold text-sm ${
            bill.paymentStatus === 'PAID' 
              ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' 
              : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
          }`}>
            {bill.paymentStatus === 'PAID' ? '✅ Payment Complete' : '⏳ Please pay at counter / waiter will assist'}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={shareWhatsApp}
            className="bg-green-500 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-green-500/25"
          >
            <Share2 size={16} /> Share Bill
          </button>
          <button
            onClick={() => navigate(`/order/${tenantSlug}/review/${sessionId}`)}
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-purple-500/25"
          >
            <Star size={16} /> Rate Us
          </button>
        </div>

        {/* History Link */}
        <button
          onClick={() => navigate(`/order/${tenantSlug}/history`)}
          className="w-full mt-4 text-center text-sm font-bold text-blue-500 py-3"
        >
          View Order History →
        </button>
      </div>
    </div>
  );
}
