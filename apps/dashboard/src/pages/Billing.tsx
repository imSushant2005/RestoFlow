import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatINR } from '../lib/currency';
import { ReceiptText, FileText, Printer, Download, Share2, Users, CreditCard, X } from 'lucide-react';
import { format } from 'date-fns';

type OrderRow = {
  id: string;
  orderNumber?: string;
  createdAt: string;
  status: string;
  customerName?: string | null;
  customerPhone?: string | null;
  subtotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  totalAmount?: number;
  total?: number;
  paymentMethod?: string | null;
  diningSessionId?: string | null;
  table?: { name?: string } | null;
  items?: Array<{
    id: string;
    name?: string;
    quantity: number;
    unitPrice?: number;
    totalPrice?: number;
    menuItem?: { name?: string; price?: number } | null;
  }>;
};

export function Billing() {
  const [selectedInvoice, setSelectedInvoice] = useState<OrderRow | null>(null);

  const { data: business } = useQuery({
    queryKey: ['settings-business'],
    queryFn: async () => (await api.get('/settings/business')).data,
    retry: false,
  });

  const { data: historyResponse, isLoading } = useQuery({
    queryKey: ['bill-counter-orders'],
    queryFn: async () => (await api.get('/orders/history?status=RECEIVED&limit=100')).data,
    staleTime: 1000 * 15,
  });

  const completedOrders: OrderRow[] = useMemo(() => {
    return (historyResponse?.data || []) as OrderRow[];
  }, [historyResponse]);

  const grandTotal = completedOrders.reduce((sum, o) => sum + Number(o.totalAmount || o.total || 0), 0);
  const totalInvoices = completedOrders.length;

  if (isLoading) return <div className="p-8 font-medium animate-pulse" style={{ color: 'var(--text-3)' }}>Loading bill counter...</div>;

  return (
    <div className="flex-1 p-8 overflow-y-auto w-full">
      <h2 className="text-3xl font-bold tracking-tight mb-8 flex items-center gap-3" style={{ color: 'var(--text-1)' }}>
        <ReceiptText size={32} className="text-blue-600" /> Billing
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <MetricCard label="Completed Orders" value={totalInvoices.toString()} />
        <MetricCard label="Total Invoice Value" value={formatINR(grandTotal)} />
        <MetricCard label="Business" value={business?.businessName || 'Your Venue'} />
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="font-bold" style={{ color: 'var(--text-1)' }}>Invoice Register</h3>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>Auto-filled from completed live orders</span>
        </div>

        {completedOrders.length === 0 ? (
          <div className="p-10 text-center font-medium" style={{ color: 'var(--text-3)' }}>No completed orders yet. Invoices will appear here.</div>
        ) : (
          <div>
            {completedOrders.map((order) => {
              const invoiceTotal = Number(order.totalAmount || order.total || 0);
              return (
                <div key={order.id} className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <p className="font-bold" style={{ color: 'var(--text-1)' }}>Invoice #{order.orderNumber || order.id.slice(-8).toUpperCase()}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                      {format(new Date(order.createdAt), 'dd MMM yyyy, hh:mm a')} • {order.table?.name ? `Table ${order.table.name}` : 'Takeaway'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                      {order.customerName || 'Walk-in'}
                      {order.customerPhone ? ` • ${order.customerPhone}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-black text-blue-600">{formatINR(invoiceTotal)}</span>
                    <button
                      onClick={() => setSelectedInvoice(order)}
                      className="px-3 py-2 rounded-lg font-semibold text-sm"
                      style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}
                    >
                      Open Invoice
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedInvoice && (
        <InvoiceModal
          order={selectedInvoice}
          businessName={business?.businessName || 'Your Venue'}
          businessSlug={business?.slug || ''}
          businessPhone={business?.phone || '-'}
          businessGstin={business?.gstin || '-'}
          taxRate={Number(business?.taxRate || 5)}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-5 rounded-2xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-2xl font-black mt-1" style={{ color: 'var(--text-1)' }}>{value}</p>
    </div>
  );
}

function InvoiceModal({
  order,
  businessName,
  businessSlug,
  businessPhone,
  businessGstin,
  taxRate,
  onClose,
}: {
  order: OrderRow;
  businessName: string;
  businessSlug: string;
  businessPhone: string;
  businessGstin: string;
  taxRate: number;
  onClose: () => void;
}) {
  const [showSplit, setShowSplit] = useState(false);
  const [splitCount, setSplitCount] = useState(2);
  const items = Array.isArray(order.items) ? order.items : [];
  const inferredSubtotal =
    Number(order.subtotal || 0) ||
    items.reduce((sum, line) => sum + Number(line.totalPrice || Number(line.menuItem?.price || line.unitPrice || 0) * Number(line.quantity || 0)), 0);
  const inferredTax = Number(order.taxAmount || 0) || inferredSubtotal * (taxRate / 100);
  const inferredDiscount = Number(order.discountAmount || 0);
  const total = Number(order.totalAmount || order.total || inferredSubtotal + inferredTax - inferredDiscount);
  const splitAmount = splitCount > 0 ? total / splitCount : total;

  const payNowMutation = useMutation({
    mutationFn: async () => {
      if (!businessSlug || !order.diningSessionId) {
        throw new Error('No linked dining session found for this invoice');
      }
      return api.post(`/public/${businessSlug}/sessions/${order.diningSessionId}/complete`, { paymentMethod: 'cash' });
    },
  });

  const printInvoice = () => window.print();
  const downloadInvoice = () => {
    const invoiceContent = `Invoice ${order.orderNumber || order.id.slice(-8).toUpperCase()}\n${businessName}\nGSTIN: ${businessGstin}\nPhone: ${businessPhone}\n\nTotal: ${formatINR(total)}`;
    const blob = new Blob([invoiceContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${order.orderNumber || order.id.slice(-8)}.txt`;
    a.click();
  };
  const shareInvoice = async () => {
    const msg = `Invoice ${order.orderNumber || order.id.slice(-8).toUpperCase()} • Total ${formatINR(total)}`;
    try {
      await navigator.clipboard?.writeText(msg);
      alert('Invoice summary copied to clipboard');
    } catch (err) {
      alert('Failed to copy to clipboard');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--surface-overlay)' }}>
      <div className="rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
        <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="font-black text-xl flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
            <FileText size={20} /> Invoice #{order.orderNumber || order.id.slice(-8).toUpperCase()}
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-3)' }}>Vendor</p>
              <p className="font-bold" style={{ color: 'var(--text-1)' }}>{businessName}</p>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>restoflow.com/order/{businessSlug}</p>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>GSTIN: {businessGstin}</p>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>Phone: {businessPhone}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-3)' }}>Customer</p>
              <p className="font-bold" style={{ color: 'var(--text-1)' }}>{order.customerName || 'Walk-in Customer'}</p>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>{order.customerPhone || '-'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-3)' }}>Date</p>
              <p className="font-semibold" style={{ color: 'var(--text-1)' }}>{format(new Date(order.createdAt), 'dd MMM yyyy, hh:mm a')}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-3)' }}>Service</p>
              <p className="font-semibold" style={{ color: 'var(--text-1)' }}>{order.table?.name ? `Table ${order.table.name}` : 'Takeaway'}</p>
            </div>
          </div>

          <section className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="px-4 py-2 text-xs font-black uppercase tracking-wide" style={{ background: 'var(--surface-3)', color: 'var(--text-3)', borderBottom: '1px solid var(--border)' }}>Items</div>
            <div className="grid grid-cols-12 px-4 py-2 text-xs font-semibold uppercase" style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}>
              <span className="col-span-6">Item</span>
              <span className="col-span-2 text-right">Qty</span>
              <span className="col-span-2 text-right">Price</span>
              <span className="col-span-2 text-right">Amount</span>
            </div>
            {items.length === 0 ? (
              <div className="px-4 py-4 text-sm" style={{ color: 'var(--text-3)' }}>No line items found for this order.</div>
            ) : (
              items.map((line) => {
                const qty = Number(line.quantity || 0);
                const price = Number(line.unitPrice || line.menuItem?.price || 0);
                const amount = Number(line.totalPrice || qty * price);
                return (
                  <div key={line.id} className="grid grid-cols-12 px-4 py-3 text-sm" style={{ borderTop: '1px solid var(--border)' }}>
                    <span className="col-span-6 font-medium" style={{ color: 'var(--text-1)' }}>{line.name || line.menuItem?.name || 'Menu Item'}</span>
                    <span className="col-span-2 text-right" style={{ color: 'var(--text-2)' }}>{qty}</span>
                    <span className="col-span-2 text-right" style={{ color: 'var(--text-2)' }}>{formatINR(price)}</span>
                    <span className="col-span-2 text-right font-semibold" style={{ color: 'var(--text-1)' }}>{formatINR(amount)}</span>
                  </div>
                );
              })
            )}
          </section>

          <section className="rounded-xl p-4" style={{ border: '1px solid var(--border)' }}>
            <div className="text-xs font-black uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Totals</div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm" style={{ color: 'var(--text-2)' }}>
                <span>Subtotal</span>
                <span>{formatINR(inferredSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm" style={{ color: 'var(--text-2)' }}>
                <span>Tax</span>
                <span>{formatINR(inferredTax)}</span>
              </div>
              {inferredDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-500">
                  <span>Discount</span>
                  <span>-{formatINR(inferredDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between items-end pt-2 mt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="font-black text-lg" style={{ color: 'var(--text-1)' }}>Total</span>
                <span className="font-black text-3xl text-blue-600">{formatINR(total)}</span>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setShowSplit(true)} className="px-3 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5" style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}>
              <Users size={14} /> Split Bill
            </button>
            <button
              onClick={() => payNowMutation.mutate()}
              disabled={payNowMutation.isPending}
              className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <CreditCard size={14} /> {payNowMutation.isPending ? 'Processing...' : 'Pay Now'}
            </button>
            <button onClick={downloadInvoice} className="px-3 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5" style={{ background: 'rgba(37,99,235,0.1)', color: '#60a5fa' }}>
              <Download size={14} /> Download Invoice
            </button>
            <button onClick={shareInvoice} className="px-3 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399' }}>
              <Share2 size={14} /> Share Bill
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <button onClick={printInvoice} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center gap-1">
              <Printer size={14} /> Print
            </button>
            <button onClick={onClose} className="px-3 py-2 rounded-lg font-semibold text-sm" style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}>
              Close
            </button>
          </div>
        </div>
      </div>

      {showSplit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'var(--surface-overlay)' }}>
          <div className="rounded-2xl shadow-xl max-w-sm w-full p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-black" style={{ color: 'var(--text-1)' }}>Split Bill</h4>
              <button onClick={() => setShowSplit(false)} style={{ color: 'var(--text-3)' }}>
                <X size={16} />
              </button>
            </div>
            <input
              type="number"
              min={1}
              max={20}
              value={splitCount}
              onChange={(e) => setSplitCount(Math.max(1, Number(e.target.value) || 1))}
              className="w-full rounded-lg px-3 py-2"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
            />
            <div className="mt-3 rounded-xl p-3" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Per Person</p>
              <p className="text-2xl font-black mt-1" style={{ color: 'var(--text-1)' }}>{formatINR(splitAmount)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
