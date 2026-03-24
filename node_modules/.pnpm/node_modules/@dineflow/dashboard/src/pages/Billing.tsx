import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatINR } from '../lib/currency';
import { ReceiptText, FileText, Printer } from 'lucide-react';
import { format } from 'date-fns';

type OrderRow = {
  id: string;
  orderNumber?: string;
  createdAt: string;
  status: string;
  customerName?: string | null;
  customerPhone?: string | null;
  totalAmount?: number;
  total?: number;
  table?: { name?: string } | null;
  items?: Array<{
    id: string;
    quantity: number;
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
    queryFn: async () => (await api.get('/orders/history?status=COMPLETED&limit=100')).data,
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
          <span className="text-xs font-semibold text-gray-500">
            Auto-filled from completed live orders
          </span>
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
                    <p className="font-bold text-gray-900">
                      Invoice #{order.orderNumber || order.id.slice(-8).toUpperCase()}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {format(new Date(order.createdAt), 'dd MMM yyyy, hh:mm a')} • {order.table?.name ? `Table ${order.table.name}` : 'Takeaway'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {order.customerName || 'Walk-in'}{order.customerPhone ? ` • ${order.customerPhone}` : ''}
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
  onClose,
}: {
  order: OrderRow;
  businessName: string;
  businessSlug: string;
  onClose: () => void;
}) {
  const total = Number(order.totalAmount || order.total || 0);
  const items = Array.isArray(order.items) ? order.items : [];

  const printInvoice = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-black text-xl text-gray-900 flex items-center gap-2">
            <FileText size={20} /> Invoice #{order.orderNumber || order.id.slice(-8).toUpperCase()}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={printInvoice}
              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center gap-1"
            >
              <Printer size={14} /> Print
            </button>
            <button onClick={onClose} className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm">
              Close
            </button>
          </div>
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

          <div className="border rounded-xl overflow-hidden">
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
                const price = Number(line.menuItem?.price || 0);
                return (
                  <div key={line.id} className="grid grid-cols-12 px-4 py-3 text-sm border-t border-gray-100">
                    <span className="col-span-6 font-medium text-gray-800">{line.menuItem?.name || 'Menu Item'}</span>
                    <span className="col-span-2 text-right">{qty}</span>
                    <span className="col-span-2 text-right">{formatINR(price)}</span>
                    <span className="col-span-2 text-right font-semibold">{formatINR(qty * price)}</span>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{formatINR(total)}</span>
              </div>
              <div className="flex justify-between font-black text-lg text-gray-900 border-t pt-2">
                <span>Total</span>
                <span>{formatINR(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
