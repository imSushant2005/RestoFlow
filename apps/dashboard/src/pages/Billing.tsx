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
  isPaid?: boolean;
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

  if (isLoading) return <div className="p-8 font-medium text-gray-500 animate-pulse">Loading bill counter...</div>;

  return (
    <div className="flex-1 p-8 bg-gray-50 overflow-y-auto w-full">
      <h2 className="text-3xl font-bold tracking-tight text-gray-900 mb-8 flex items-center gap-3">
        <ReceiptText size={32} className="text-blue-600" /> Billing
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <MetricCard label="Completed Orders" value={totalInvoices.toString()} />
        <MetricCard label="Total Invoice Value" value={formatINR(grandTotal)} />
        <MetricCard label="Business" value={business?.businessName || 'Your Venue'} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Invoice Register</h3>
          <span className="text-xs font-semibold text-gray-500">Auto-filled from completed live orders</span>
        </div>

        {completedOrders.length === 0 ? (
          <div className="p-10 text-center text-gray-400 font-medium">No completed orders yet. Invoices will appear here.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {completedOrders.map((order) => {
              const invoiceTotal = Number(order.totalAmount || order.total || 0);
              return (
                <div key={order.id} className="p-5 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-900">Invoice #{order.orderNumber || order.id.slice(-8).toUpperCase()}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {format(new Date(order.createdAt), 'dd MMM yyyy, hh:mm a')} • {order.table?.name ? `Table ${order.table.name}` : 'Takeaway'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {order.customerName || 'Walk-in'}
                      {order.customerPhone ? ` • ${order.customerPhone}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-black text-blue-600">{formatINR(invoiceTotal)}</span>
                    <button
                      onClick={() => setSelectedInvoice(order)}
                      className="px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold text-sm"
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
          taxRate={Number(business?.taxRate || 5)}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-black text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function InvoiceModal({
  order,
  businessName,
  businessSlug,
  taxRate,
  onClose,
}: {
  order: OrderRow;
  businessName: string;
  businessSlug: string;
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
  const downloadInvoice = () => window.print();
  const shareInvoice = () => {
    const msg = `Invoice ${order.orderNumber || order.id.slice(-8).toUpperCase()} • Total ${formatINR(total)}`;
    navigator.clipboard?.writeText(msg);
    alert('Invoice summary copied to clipboard');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-black text-xl text-gray-900 flex items-center gap-2">
            <FileText size={20} /> Invoice #{order.orderNumber || order.id.slice(-8).toUpperCase()}
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Vendor</p>
              <p className="font-bold text-gray-900">{businessName}</p>
              <p className="text-sm text-gray-500">restoflow.com/order/{businessSlug}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Customer</p>
              <p className="font-bold text-gray-900">{order.customerName || 'Walk-in Customer'}</p>
              <p className="text-sm text-gray-500">{order.customerPhone || '-'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Date</p>
              <p className="font-semibold text-gray-800">{format(new Date(order.createdAt), 'dd MMM yyyy, hh:mm a')}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Service</p>
              <p className="font-semibold text-gray-800">{order.table?.name ? `Table ${order.table.name}` : 'Takeaway'}</p>
            </div>
          </div>

          <section className="border rounded-xl overflow-hidden">
            <div className="px-4 py-2 text-xs font-black uppercase tracking-wide text-gray-500 bg-gray-50 border-b">Items</div>
            <div className="grid grid-cols-12 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
              <span className="col-span-6">Item</span>
              <span className="col-span-2 text-right">Qty</span>
              <span className="col-span-2 text-right">Price</span>
              <span className="col-span-2 text-right">Amount</span>
            </div>
            {items.length === 0 ? (
              <div className="px-4 py-4 text-sm text-gray-500">No line items found for this order.</div>
            ) : (
              items.map((line) => {
                const qty = Number(line.quantity || 0);
                const price = Number(line.unitPrice || line.menuItem?.price || 0);
                const amount = Number(line.totalPrice || qty * price);
                return (
                  <div key={line.id} className="grid grid-cols-12 px-4 py-3 text-sm border-t border-gray-100">
                    <span className="col-span-6 font-medium text-gray-800">{line.name || line.menuItem?.name || 'Menu Item'}</span>
                    <span className="col-span-2 text-right">{qty}</span>
                    <span className="col-span-2 text-right">{formatINR(price)}</span>
                    <span className="col-span-2 text-right font-semibold">{formatINR(amount)}</span>
                  </div>
                );
              })
            )}
          </section>

          <section className="border rounded-xl p-4">
            <div className="text-xs font-black uppercase tracking-wide text-gray-500 mb-2">Totals</div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{formatINR(inferredSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Tax</span>
                <span>{formatINR(inferredTax)}</span>
              </div>
              {inferredDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-{formatINR(inferredDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between items-end border-t pt-2 mt-2">
                <span className="font-black text-lg text-gray-900">Total</span>
                <span className="font-black text-3xl text-blue-600">{formatINR(total)}</span>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setShowSplit(true)} className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold text-sm flex items-center justify-center gap-1.5">
              <Users size={14} /> Split Bill
            </button>
            <button
              onClick={() => payNowMutation.mutate()}
              disabled={payNowMutation.isPending}
              className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <CreditCard size={14} /> {payNowMutation.isPending ? 'Processing...' : 'Pay Now'}
            </button>
            <button onClick={downloadInvoice} className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 font-semibold text-sm flex items-center justify-center gap-1.5">
              <Download size={14} /> Download Invoice
            </button>
            <button onClick={shareInvoice} className="px-3 py-2 rounded-lg bg-green-50 text-green-700 font-semibold text-sm flex items-center justify-center gap-1.5">
              <Share2 size={14} /> Share Bill
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <button onClick={printInvoice} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center gap-1">
              <Printer size={14} /> Print
            </button>
            <button onClick={onClose} className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm">
              Close
            </button>
          </div>
        </div>
      </div>

      {showSplit && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-black text-gray-900">Split Bill</h4>
              <button onClick={() => setShowSplit(false)} className="text-gray-500 hover:text-gray-700">
                <X size={16} />
              </button>
            </div>
            <input
              type="number"
              min={1}
              max={20}
              value={splitCount}
              onChange={(e) => setSplitCount(Math.max(1, Number(e.target.value) || 1))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Per Person</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{formatINR(splitAmount)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
