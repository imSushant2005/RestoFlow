import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatINR } from '../lib/currency';
import { ReceiptText, FileText, Printer, Download, Share2, Users, X, CheckCircle } from 'lucide-react';
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
  diningSession?: {
    bill?: {
      invoiceNumber?: string | null;
      paymentStatus?: string | null;
      paymentMethod?: string | null;
      paidAt?: string | null;
      totalAmount?: number | null;
    } | null;
  } | null;
  items?: Array<{
    id: string;
    name?: string;
    quantity: number;
    unitPrice?: number;
    totalPrice?: number;
    menuItem?: { name?: string; price?: number } | null;
  }>;
};

export function InvoicesPage() {
  const queryClient = useQueryClient();
  const [selectedInvoice, setSelectedInvoice] = useState<OrderRow | null>(null);

  const { data: business } = useQuery({
    queryKey: ['settings-business'],
    queryFn: async () => (await api.get('/settings/business')).data,
    retry: false,
  });

  const completeSessionMutation = useMutation({
    mutationFn: async ({
      sessionId,
      paymentMethod,
      shouldClose,
    }: {
      sessionId: string;
      paymentMethod: 'cash' | 'online';
      shouldClose: boolean;
    }) => {
      const tenantSlug = typeof business?.slug === 'string' ? business.slug.trim() : '';
      if (!tenantSlug) {
        throw new Error('Tenant slug missing. Complete Business Profile setup first.');
      }
      const res = await api.post(`/public/${tenantSlug}/sessions/${sessionId}/complete`, { paymentMethod, shouldClose });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
      queryClient.invalidateQueries({ queryKey: ['live-orders'] });
    },
  });

  const { data: historyResponse, isLoading } = useQuery({
    queryKey: ['bill-counter-orders'],
    queryFn: async () => (await api.get('/orders/history?status=RECEIVED,SERVED&limit=100&includeCount=false')).data,
    staleTime: 1000 * 15,
  });

  const completedOrders: OrderRow[] = useMemo(() => {
    return (historyResponse?.data || []) as OrderRow[];
  }, [historyResponse]);

  const invoiceRows: OrderRow[] = useMemo(() => {
    const grouped = completedOrders.reduce((acc: Record<string, OrderRow>, order) => {
      if (!order.diningSessionId) {
        acc[`order_${order.id}`] = order;
        return acc;
      }

      const key = `session_${order.diningSessionId}`;
      const sessionBill = order.diningSession?.bill;
      if (!acc[key]) {
        acc[key] = {
          ...order,
          id: order.diningSessionId,
          orderNumber: sessionBill?.invoiceNumber || order.orderNumber || order.diningSessionId.slice(-8).toUpperCase(),
          createdAt: sessionBill?.paidAt || order.createdAt,
          status: sessionBill?.paymentStatus || order.status,
          paymentMethod: sessionBill?.paymentMethod || order.paymentMethod,
          subtotal: 0,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: 0,
          items: [],
        };
      }

      acc[key].subtotal = Number(acc[key].subtotal || 0) + Number(order.subtotal || 0);
      acc[key].taxAmount = Number(acc[key].taxAmount || 0) + Number(order.taxAmount || 0);
      acc[key].discountAmount = Number(acc[key].discountAmount || 0) + Number(order.discountAmount || 0);
      acc[key].totalAmount = sessionBill?.totalAmount || Number(acc[key].totalAmount || 0) + Number(order.totalAmount || order.total || 0);
      acc[key].items = [...(acc[key].items || []), ...(order.items || [])];
      return acc;
    }, {});

    return Object.values(grouped).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );
  }, [completedOrders]);

  const grandTotal = invoiceRows.reduce((sum, o) => sum + Number(o.totalAmount || o.total || 0), 0);
  const taxableSales = invoiceRows.reduce((sum, o) => sum + Number(o.subtotal || 0), 0);
  const taxCollected = invoiceRows.reduce((sum, o) => sum + Number(o.taxAmount || 0), 0);
  const totalInvoices = invoiceRows.length;

  const downloadCaReport = () => {
    const header = [
      'Date',
      'Invoice',
      'Order ID',
      'Mode',
      'Service Point',
      'Customer',
      'Phone',
      'Subtotal',
      'Tax',
      'Discount',
      'Total',
      'GSTIN',
    ];

    const rows = invoiceRows.map((order) => [
      format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm:ss'),
      order.orderNumber || order.id.slice(-8).toUpperCase(),
      order.id,
      order.diningSessionId ? 'DINE_IN_SESSION' : 'DIRECT_ORDER',
      order.table?.name ? `Table ${order.table.name}` : 'Takeaway',
      order.customerName || 'Walk-in',
      order.customerPhone || '',
      Number(order.subtotal || 0).toFixed(2),
      Number(order.taxAmount || 0).toFixed(2),
      Number(order.discountAmount || 0).toFixed(2),
      Number(order.totalAmount || order.total || 0).toFixed(2),
      business?.gstin || '',
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `restoflow-ca-day-book-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="p-8 font-medium animate-pulse" style={{ color: 'var(--text-3)' }}>Loading bill counter...</div>;

  return (
    <div className="flex-1 p-8 overflow-y-auto w-full">
      <h2 className="text-3xl font-bold tracking-tight mb-8 flex items-center gap-3" style={{ color: 'var(--text-1)' }}>
        <ReceiptText size={32} className="text-blue-600" /> Billing
      </h2>

      <div className="mb-8 overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] border shadow-xl lg:shadow-2xl" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="grid grid-cols-3 md:grid-cols-3 divide-x md:divide-y-0" style={{ borderColor: 'var(--border)' }}>
          <div className="p-3 sm:p-8 text-center md:text-left">
            <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>Volume</p>
            <p className="mt-1 sm:mt-2 text-xl sm:text-4xl font-black tracking-tighter" style={{ color: 'var(--text-1)' }}>{totalInvoices}</p>
            <p className="mt-1 text-[8px] sm:text-xs font-bold uppercase tracking-widest text-blue-500">Invoices</p>
          </div>
          <div className="p-3 sm:p-8 text-center md:text-left">
            <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>Revenue</p>
            <p className="mt-1 sm:mt-2 text-xl sm:text-4xl font-black tracking-tighter" style={{ color: 'var(--text-1)' }}>{formatINR(grandTotal).split('.')[0]}</p>
            <p className="mt-1 text-[8px] sm:text-xs font-bold uppercase tracking-widest text-emerald-500">Gross</p>
          </div>
          <div className="p-3 sm:p-8 text-center md:text-left">
            <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>Tax</p>
            <p className="mt-1 sm:mt-2 text-xl sm:text-4xl font-black tracking-tighter" style={{ color: 'var(--text-1)' }}>{formatINR(taxCollected).split('.')[0]}</p>
            <p className="mt-1 text-[8px] sm:text-xs font-bold uppercase tracking-widest text-amber-500">GST</p>
          </div>
        </div>
      </div>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>CA Day Book</p>
          <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
            Download today&apos;s GST-ready sales register with invoice, table, customer, and tax totals.
          </p>
          <p className="mt-2 text-xs font-bold" style={{ color: 'var(--text-3)' }}>
            Taxable sales: {formatINR(taxableSales)} | Workspace: {business?.businessName || 'Your Venue'}
          </p>
        </div>
        <button
          onClick={downloadCaReport}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-500"
        >
          <Download size={16} />
          Download CA Report
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="font-bold" style={{ color: 'var(--text-1)' }}>Invoice Register</h3>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>Auto-filled from today&apos;s completed bills</span>
        </div>

        {invoiceRows.length === 0 ? (
          <div className="p-10 text-center font-medium" style={{ color: 'var(--text-3)' }}>No completed orders yet. Invoices will appear here.</div>
        ) : (
          <div>
            {invoiceRows.map((order) => {
              const invoiceTotal = Number(order.totalAmount || order.total || 0);
              return (
                <div
                  key={order.id}
                  className="p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between hover:bg-white/5 transition-colors"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-base sm:text-lg" style={{ color: 'var(--text-1)' }}>
                        #{order.orderNumber || order.id.slice(-8).toUpperCase()}
                      </p>
                      <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-black text-blue-500 uppercase tracking-tighter">
                        Paid
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] sm:text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                      {format(new Date(order.createdAt), 'dd MMM | hh:mm a')}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
                        <Users size={10} className="text-slate-400" />
                        {order.customerName || 'Walk-in'}
                      </div>
                      <div className="h-1 w-1 rounded-full bg-slate-700" />
                      <div className="text-[10px] sm:text-xs font-black text-blue-400">
                        {order.table?.name ? `T${order.table.name}` : 'T/W'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t pt-3 sm:border-t-0 sm:pt-0" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-right">
                      <p className="text-[8px] sm:text-[10px] font-black uppercase text-slate-500 tracking-widest leading-none">Total</p>
                      <p className="mt-1 text-lg sm:text-xl font-black" style={{ color: 'var(--text-1)' }}>{formatINR(invoiceTotal)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedInvoice(order)}
                        className="flex items-center justify-center gap-1.5 rounded-lg sm:rounded-xl bg-blue-600 px-3 py-2 sm:px-4 sm:py-2.5 text-[10px] sm:text-xs font-black text-white transition hover:bg-blue-500"
                      >
                        <FileText size={12} />
                        OPEN
                      </button>
                      {order.diningSessionId && order.status !== 'RECEIVED' && order.diningSession?.bill?.paymentStatus === 'PAID' && (
                        <button
                          onClick={() => {
                            completeSessionMutation.mutate({
                              sessionId: order.diningSessionId!,
                              paymentMethod: (order.diningSession?.bill?.paymentMethod || 'cash').toLowerCase() as any,
                              shouldClose: true
                            });
                          }}
                          disabled={completeSessionMutation.isPending}
                          className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all active:scale-95"
                          title="Clear Session & Archive"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                    </div>
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
          businessPhone={business?.phone || '-'}
          businessGstin={business?.gstin || '-'}
          taxRate={Number(business?.taxRate || 5)}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}

export function InvoiceModal({
  order,
  businessName,
  businessPhone,
  businessGstin,
  taxRate,
  onClose,
}: {
  order: OrderRow;
  businessName: string;
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
    const msg = `Invoice ${order.orderNumber || order.id.slice(-8).toUpperCase()} | Total ${formatINR(total)}`;
    try {
      await navigator.clipboard?.writeText(msg);
      alert('Invoice summary copied to clipboard');
    } catch (err) {
      alert('Failed to copy to clipboard');
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
      <div className="rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col bg-[color:var(--surface-raised)] border border-[color:var(--border)] scale-up">
        {/* Header */}
        <div className="px-8 py-6 flex items-center justify-between border-b border-[color:var(--border)]">
          <div>
            <h3 className="font-black text-2xl tracking-tight text-[color:var(--text-1)] flex items-center gap-3">
              <div className="p-2 bg-blue-600/10 rounded-xl text-blue-600">
                <FileText size={24} />
              </div>
              Invoice #{order.orderNumber || order.id.slice(-8).toUpperCase()}
            </h3>
            <p className="text-xs font-bold text-[color:var(--text-3)] mt-1 uppercase tracking-widest pl-1">Operational ID: {order.id.slice(0, 12)}...</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-[color:var(--surface-3)] text-[color:var(--text-2)] hover:bg-slate-200 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-10">
          {/* Metadata Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--text-3)]">Merchant Details</p>
              <p className="text-lg font-black text-[color:var(--text-1)]">{businessName}</p>
              <div className="pt-2 space-y-1">
                <p className="text-sm font-medium text-[color:var(--text-2)] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> GSTIN: {businessGstin}
                </p>
                <p className="text-sm font-medium text-[color:var(--text-2)] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> Phone: {businessPhone}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--text-3)]">Consumer Information</p>
              <p className="text-lg font-black text-[color:var(--text-1)]">{order.customerName || 'Walk-in Customer'}</p>
              <p className="text-sm font-medium text-[color:var(--text-2)] pt-2">{order.customerPhone || 'Verified by OTP'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--text-3)]">Issued on</p>
              <p className="text-base font-bold text-[color:var(--text-1)]">{format(new Date(order.createdAt), 'MMMM d, yyyy')}</p>
              <p className="text-sm font-medium text-[color:var(--text-2)]">{format(new Date(order.createdAt), 'hh:mm:ss a')}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--text-3)]">Service Point</p>
              <div className="flex items-center gap-2 pt-1">
                <span className="px-3 py-1 rounded-full bg-blue-600/10 text-blue-600 text-sm font-black uppercase tracking-tight">
                  {order.table?.name ? `Table ${order.table.name}` : 'Takeaway'}
                </span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <section className="rounded-2xl border border-[color:var(--border)] overflow-hidden">
            <div className="px-5 py-3 bg-[color:var(--surface-3)] border-b border-[color:var(--border)] flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--text-3)]">Line Items</span>
              <span className="text-[10px] font-bold text-[color:var(--text-3)]">{items.length} positions</span>
            </div>
            <div className="divide-y divide-[color:var(--border)]">
              {items.length === 0 ? (
                <div className="p-8 text-center text-sm font-medium text-[color:var(--text-3)]">No line items recorded</div>
              ) : (
                items.map((line) => {
                  const qty = Number(line.quantity || 0);
                  const price = Number(line.unitPrice || line.menuItem?.price || 0);
                  const amount = Number(line.totalPrice || qty * price);
                  return (
                    <div key={line.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex-1">
                        <p className="font-bold text-[color:var(--text-1)]">{line.name || line.menuItem?.name || 'Menu Item'}</p>
                        <p className="text-xs font-medium text-[color:var(--text-3)] mt-0.5">{formatINR(price)} per unit</p>
                      </div>
                      <div className="flex items-center gap-8">
                        <span className="text-sm font-black text-[color:var(--text-2)]">x{qty}</span>
                        <span className="font-black text-[color:var(--text-1)] w-24 text-right">{formatINR(amount)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Financials */}
          <div className="flex flex-col md:flex-row justify-end gap-12 pt-4">
            <div className="w-full md:w-80 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-[color:var(--text-3)] uppercase tracking-wide">Subtotal</span>
                <span className="text-sm font-black text-[color:var(--text-1)]">{formatINR(inferredSubtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-[color:var(--text-3)] uppercase tracking-wide">Taxes ({taxRate}%)</span>
                <span className="text-sm font-black text-[color:var(--text-1)]">{formatINR(inferredTax)}</span>
              </div>
              {inferredDiscount > 0 && (
                <div className="flex justify-between items-center text-emerald-600">
                  <span className="text-sm font-bold uppercase tracking-wide">Discounts</span>
                  <span className="text-sm font-black">-{formatINR(inferredDiscount)}</span>
                </div>
              )}
              <div className="pt-4 mt-2 border-t-2 border-[color:var(--border)] flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black text-[color:var(--text-3)] uppercase tracking-[0.2em]">Net Receivable</p>
                  <p className="text-3xl font-black text-[color:var(--text-1)] tracking-tighter mt-1">{formatINR(total)}</p>
                </div>
                <div className="pb-1">
                  <span className="px-2 py-1 rounded bg-blue-600 text-white text-[10px] font-black uppercase">PAID</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Group */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-[color:var(--border)]">
            <button onClick={() => setShowSplit(true)} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-[color:var(--surface-3)] hover:brightness-95 transition-all text-[color:var(--text-2)]">
              <Users size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">Split</span>
            </button>
            <div className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-emerald-600/10 text-emerald-700 border border-emerald-500/20">
              <ReceiptText size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">Settled</span>
            </div>
            <button onClick={downloadInvoice} className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-blue-600/20 bg-blue-50/50 hover:bg-blue-50 transition-all text-blue-600">
              <Download size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">Save</span>
            </button>
            <button onClick={shareInvoice} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-slate-900 text-white hover:brightness-110 transition-all">
              <Share2 size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">Share</span>
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-8 py-5 bg-[color:var(--surface-3)] flex items-center justify-between border-t border-[color:var(--border)]">
          <button onClick={printInvoice} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-blue-500/20">
            <Printer size={16} /> Print Full Invoice
          </button>
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-[color:var(--text-2)] bg-white border border-[color:var(--border)] hover:bg-slate-50 transition-all">
            Close
          </button>
        </div>
      </div>


      {showSplit && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center p-4" style={{ background: 'var(--surface-overlay)' }}>
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
