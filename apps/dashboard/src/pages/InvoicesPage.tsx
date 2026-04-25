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
    link.download = `BHOJFLOW-ca-day-book-${format(new Date(), 'yyyy-MM-dd')}.csv`;
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
          businessAddress={business?.address || ''}
          businessPhone={business?.phone || '-'}
          businessGstin={business?.gstin || '-'}
          taxRate={Number(business?.taxRate || 5)}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}

function getInvoiceNumber(order: OrderRow) {
  return order.orderNumber || order.id.slice(-8).toUpperCase();
}

function getInvoicePaymentMethod(value: unknown) {
  const normalized = String(value || '').trim().toUpperCase();
  switch (normalized) {
    case 'ONLINE':
    case 'UPI':
      return 'Online / UPI';
    case 'CASH':
      return 'Cash';
    case 'CARD':
      return 'Card';
    default:
      return normalized ? normalized.replace(/_/g, ' ') : 'Settled';
  }
}

function getInvoiceServicePoint(order: OrderRow) {
  if (order.table?.name) return `Table ${order.table.name}`;
  return order.diningSessionId ? 'Dining Session' : 'Takeaway';
}

function escapeInvoiceHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function InvoiceModal({
  order,
  businessName,
  businessAddress,
  businessPhone,
  businessGstin,
  taxRate,
  onClose,
}: {
  order: OrderRow;
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessGstin: string;
  taxRate: number;
  onClose: () => void;
}) {
  const [showSplit, setShowSplit] = useState(false);
  const [splitCount, setSplitCount] = useState(2);
  const invoiceNumber = getInvoiceNumber(order);
  const servicePoint = getInvoiceServicePoint(order);
  const paymentMethodLabel = getInvoicePaymentMethod(order.diningSession?.bill?.paymentMethod || order.paymentMethod);
  const items = Array.isArray(order.items) ? order.items : [];
  const lineItems = items.map((line) => {
    const quantity = Math.max(1, Number(line.quantity || 1));
    const unitPrice = Number(line.unitPrice || line.menuItem?.price || 0);
    const totalPrice = Number(line.totalPrice || quantity * unitPrice);
    return {
      id: line.id,
      name: line.name || line.menuItem?.name || 'Menu Item',
      quantity,
      unitPrice,
      totalPrice,
    };
  });
  const inferredSubtotal =
    Number(order.subtotal || 0) ||
    lineItems.reduce((sum, line) => sum + Number(line.totalPrice || 0), 0);
  const inferredTax = Number(order.taxAmount || 0) || inferredSubtotal * (taxRate / 100);
  const inferredDiscount = Number(order.discountAmount || 0);
  const total = Number(order.totalAmount || order.total || inferredSubtotal + inferredTax - inferredDiscount);
  const splitAmount = splitCount > 0 ? total / splitCount : total;
  const invoiceDate = new Date(order.createdAt);
  const invoiceSummaryText = `Invoice ${invoiceNumber} | ${servicePoint} | ${paymentMethodLabel} | Total ${formatINR(total)}`;

  const invoiceHtml = useMemo(() => {
    const rows = lineItems.length
      ? lineItems
          .map(
            (line, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${escapeInvoiceHtml(line.name)}</td>
                <td class="right">${line.quantity}</td>
                <td class="right">${escapeInvoiceHtml(formatINR(line.unitPrice))}</td>
                <td class="right">${escapeInvoiceHtml(formatINR(line.totalPrice))}</td>
              </tr>`,
          )
          .join('')
      : `<tr><td colspan="5" class="empty">No line items recorded</td></tr>`;

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Invoice ${escapeInvoiceHtml(invoiceNumber)}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #eef2f7; color: #0f172a; font: 14px/1.5 Inter, Segoe UI, Arial, sans-serif; }
      .page { max-width: 860px; margin: 32px auto; background: #ffffff; border: 1px solid #dbe3ef; border-radius: 24px; overflow: hidden; box-shadow: 0 22px 40px rgba(15, 23, 42, 0.08); }
      .header { padding: 32px; border-bottom: 1px solid #e2e8f0; display: grid; gap: 24px; grid-template-columns: 1.2fr 0.8fr; }
      .eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: #64748b; }
      .title { margin: 10px 0 0; font-size: 34px; font-weight: 900; letter-spacing: -0.03em; color: #0f172a; }
      .subtle { color: #475569; font-weight: 600; }
      .meta-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 20px; padding: 16px 18px; }
      .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .body { padding: 32px; display: grid; gap: 24px; }
      .info-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
      .card { border: 1px solid #e2e8f0; border-radius: 20px; padding: 18px; background: #ffffff; }
      .label { font-size: 11px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #64748b; }
      .value { margin-top: 8px; font-size: 15px; font-weight: 700; color: #0f172a; }
      table { width: 100%; border-collapse: collapse; overflow: hidden; }
      th, td { padding: 14px 16px; border-bottom: 1px solid #e2e8f0; }
      th { background: #f8fafc; color: #64748b; text-transform: uppercase; letter-spacing: 0.14em; font-size: 11px; text-align: left; }
      td { color: #0f172a; font-weight: 600; }
      td.right, th.right { text-align: right; }
      .empty { text-align: center; color: #64748b; }
      .totals { margin-left: auto; width: min(100%, 320px); border: 1px solid #e2e8f0; border-radius: 20px; padding: 18px; background: #f8fafc; }
      .total-row { display: flex; justify-content: space-between; gap: 16px; margin-top: 12px; color: #334155; font-weight: 700; }
      .grand { margin-top: 18px; padding-top: 18px; border-top: 1px solid #cbd5e1; }
      .grand strong { font-size: 28px; letter-spacing: -0.03em; color: #0f172a; }
      .footer { padding: 0 32px 32px; color: #64748b; font-size: 12px; font-weight: 600; }
      @media print {
        body { background: #ffffff; }
        .page { margin: 0; border: none; border-radius: 0; box-shadow: none; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header">
        <div>
          <div class="eyebrow">Tax Invoice</div>
          <div class="title">${escapeInvoiceHtml(businessName)}</div>
          <div class="subtle">${escapeInvoiceHtml(businessAddress || 'Address not added yet')}</div>
          <div class="subtle">${escapeInvoiceHtml(businessPhone ? `Phone: ${businessPhone}` : '')}</div>
          <div class="subtle">${escapeInvoiceHtml(businessGstin ? `GSTIN: ${businessGstin}` : '')}</div>
        </div>
        <div class="meta-grid">
          <div class="meta-card">
            <div class="eyebrow">Invoice No.</div>
            <div class="value">${escapeInvoiceHtml(invoiceNumber)}</div>
          </div>
          <div class="meta-card">
            <div class="eyebrow">Issued</div>
            <div class="value">${escapeInvoiceHtml(format(invoiceDate, 'dd MMM yyyy'))}</div>
          </div>
          <div class="meta-card">
            <div class="eyebrow">Payment</div>
            <div class="value">${escapeInvoiceHtml(paymentMethodLabel)}</div>
          </div>
          <div class="meta-card">
            <div class="eyebrow">Service</div>
            <div class="value">${escapeInvoiceHtml(servicePoint)}</div>
          </div>
        </div>
      </div>

      <div class="body">
        <div class="info-grid">
          <div class="card">
            <div class="label">Guest</div>
            <div class="value">${escapeInvoiceHtml(order.customerName || 'Walk-in Customer')}</div>
            <div class="subtle">${escapeInvoiceHtml(order.customerPhone || 'Guest contact not recorded')}</div>
          </div>
          <div class="card">
            <div class="label">Order Reference</div>
            <div class="value">${escapeInvoiceHtml(order.id)}</div>
            <div class="subtle">${escapeInvoiceHtml(format(invoiceDate, 'hh:mm a'))}</div>
          </div>
          <div class="card">
            <div class="label">Status</div>
            <div class="value">Paid</div>
            <div class="subtle">Computer generated invoice</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th class="right">Qty</th>
              <th class="right">Rate</th>
              <th class="right">Amount</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="totals">
          <div class="label">Settlement Summary</div>
          <div class="total-row"><span>Subtotal</span><span>${escapeInvoiceHtml(formatINR(inferredSubtotal))}</span></div>
          <div class="total-row"><span>Tax (${escapeInvoiceHtml(String(taxRate))}%)</span><span>${escapeInvoiceHtml(formatINR(inferredTax))}</span></div>
          ${inferredDiscount > 0 ? `<div class="total-row"><span>Discount</span><span>- ${escapeInvoiceHtml(formatINR(inferredDiscount))}</span></div>` : ''}
          <div class="total-row grand"><span>Total</span><strong>${escapeInvoiceHtml(formatINR(total))}</strong></div>
        </div>
      </div>

      <div class="footer">
        This is a computer generated invoice from ${escapeInvoiceHtml(businessName)}. Powered by BHOJFLOW.
      </div>
    </div>
  </body>
</html>`;
  }, [
    businessAddress,
    businessGstin,
    businessName,
    businessPhone,
    inferredDiscount,
    inferredSubtotal,
    inferredTax,
    invoiceDate,
    invoiceNumber,
    lineItems,
    order.customerName,
    order.customerPhone,
    order.id,
    paymentMethodLabel,
    servicePoint,
    taxRate,
    total,
  ]);

  const openInvoiceDocument = (shouldPrint = false) => {
    const invoiceWindow = window.open('', '_blank', 'noopener,noreferrer,width=960,height=900');
    if (!invoiceWindow) return;
    invoiceWindow.document.write(invoiceHtml);
    invoiceWindow.document.close();
    if (shouldPrint) {
      invoiceWindow.focus();
      window.setTimeout(() => {
        invoiceWindow.print();
      }, 250);
    }
  };

  const printInvoice = () => openInvoiceDocument(true);
  const downloadInvoice = () => {
    const blob = new Blob([invoiceHtml], { type: 'text/html;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoice-${invoiceNumber}.html`;
    link.click();
    window.URL.revokeObjectURL(url);
  };
  const shareInvoice = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Invoice ${invoiceNumber}`,
          text: invoiceSummaryText,
        });
        return;
      }
      await navigator.clipboard?.writeText(invoiceSummaryText);
      alert('Invoice summary copied to clipboard');
    } catch (err) {
      alert('Could not share this invoice');
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between border-b border-[color:var(--border)] px-6 py-5 md:px-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--text-3)]">Guest Invoice</p>
            <h3 className="mt-2 flex items-center gap-3 text-2xl font-black tracking-tight text-[color:var(--text-1)]">
              <span className="rounded-2xl bg-blue-600/10 p-2 text-blue-600">
                <FileText size={22} />
              </span>
              {invoiceNumber}
            </h3>
            <p className="mt-2 text-sm font-semibold text-[color:var(--text-2)]">
              {format(invoiceDate, 'dd MMM yyyy | hh:mm a')} | {servicePoint}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--surface-3)] text-[color:var(--text-2)] transition hover:brightness-95"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-8">
          <div className="mx-auto max-w-4xl rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <div className="grid gap-6 border-b border-slate-200 px-6 py-6 md:grid-cols-[1.2fr_0.8fr] md:px-8">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Tax Invoice</p>
                <h4 className="mt-3 text-3xl font-black tracking-tight text-slate-950">{businessName}</h4>
                <div className="mt-3 space-y-1 text-sm font-semibold text-slate-600">
                  <p>{businessAddress || 'Address not added yet'}</p>
                  {businessPhone && <p>Phone: {businessPhone}</p>}
                  {businessGstin && <p>GSTIN: {businessGstin}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Invoice No.', value: invoiceNumber },
                  { label: 'Issued', value: format(invoiceDate, 'dd MMM yyyy') },
                  { label: 'Payment', value: paymentMethodLabel },
                  { label: 'Status', value: 'Paid' },
                ].map((meta) => (
                  <div key={meta.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{meta.label}</p>
                    <p className="mt-2 text-sm font-black text-slate-900">{meta.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 border-b border-slate-200 px-6 py-6 md:grid-cols-3 md:px-8">
              <div className="rounded-2xl border border-slate-200 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Guest</p>
                <p className="mt-2 text-sm font-black text-slate-900">{order.customerName || 'Walk-in Customer'}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">{order.customerPhone || 'Guest contact not recorded'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Service Point</p>
                <p className="mt-2 text-sm font-black text-slate-900">{servicePoint}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">{order.diningSessionId ? 'Session invoice' : 'Direct order invoice'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Operational ID</p>
                <p className="mt-2 break-all text-sm font-black text-slate-900">{order.id}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">{lineItems.length} recorded line items</p>
              </div>
            </div>

            <div className="overflow-hidden px-0 py-0">
              <div className="hidden grid-cols-[72px_minmax(0,1fr)_84px_120px_120px] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 md:grid md:px-8">
                <span>#</span>
                <span>Description</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Rate</span>
                <span className="text-right">Amount</span>
              </div>

              <div className="divide-y divide-slate-200">
                {lineItems.length === 0 ? (
                  <div className="px-8 py-12 text-center text-sm font-semibold text-slate-500">No line items recorded</div>
                ) : (
                  lineItems.map((line, index) => (
                    <div key={line.id} className="grid gap-3 px-6 py-4 md:grid-cols-[72px_minmax(0,1fr)_84px_120px_120px] md:items-center md:px-8">
                      <div className="text-sm font-black text-slate-500">#{index + 1}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900">{line.name}</p>
                      </div>
                      <div className="flex items-center justify-between md:block md:text-center">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 md:hidden">Qty</span>
                        <span className="text-sm font-black text-slate-700">{line.quantity}</span>
                      </div>
                      <div className="flex items-center justify-between md:block md:text-right">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 md:hidden">Rate</span>
                        <span className="text-sm font-semibold text-slate-700">{formatINR(line.unitPrice)}</span>
                      </div>
                      <div className="flex items-center justify-between md:block md:text-right">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 md:hidden">Amount</span>
                        <span className="text-sm font-black text-slate-900">{formatINR(line.totalPrice)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid gap-6 border-t border-slate-200 px-6 py-6 md:grid-cols-[1fr_320px] md:px-8">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Invoice Note</p>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                  This is a computer generated hotel invoice. Keep it for accounting, guest history, and reconciliation.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Settlement Summary</p>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between text-sm font-bold text-slate-700">
                    <span>Subtotal</span>
                    <span>{formatINR(inferredSubtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-bold text-slate-700">
                    <span>Tax ({taxRate}%)</span>
                    <span>{formatINR(inferredTax)}</span>
                  </div>
                  {inferredDiscount > 0 && (
                    <div className="flex items-center justify-between text-sm font-bold text-emerald-600">
                      <span>Discount</span>
                      <span>-{formatINR(inferredDiscount)}</span>
                    </div>
                  )}
                  <div className="mt-4 flex items-end justify-between border-t border-slate-200 pt-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Grand Total</p>
                      <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{formatINR(total)}</p>
                    </div>
                    <div className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                      Paid
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[color:var(--border)] pt-6 sm:grid-cols-4">
            <button
              onClick={() => setShowSplit(true)}
              className="flex flex-col items-center gap-2 rounded-2xl bg-[color:var(--surface-3)] p-3 text-[color:var(--text-2)] transition hover:brightness-95"
            >
              <Users size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">Split</span>
            </button>
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-600/10 p-3 text-emerald-600">
              <ReceiptText size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">Settled</span>
            </div>
            <button
              onClick={downloadInvoice}
              className="flex flex-col items-center gap-2 rounded-2xl border border-blue-600/20 bg-blue-50/60 p-3 text-blue-600 transition hover:bg-blue-50"
            >
              <Download size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">Save</span>
            </button>
            <button
              onClick={shareInvoice}
              className="flex flex-col items-center gap-2 rounded-2xl bg-slate-900 p-3 text-white transition hover:brightness-110"
            >
              <Share2 size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">Share</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[color:var(--border)] bg-[color:var(--surface-3)] px-6 py-4 md:px-8">
          <button
            onClick={printInvoice}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white transition hover:brightness-110 active:scale-95"
          >
            <Printer size={16} /> Print Invoice
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-[color:var(--border)] bg-white px-5 py-2.5 text-xs font-black uppercase tracking-widest text-[color:var(--text-2)] transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>

      {showSplit && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center p-4" style={{ background: 'var(--surface-overlay)' }}>
          <div className="w-full max-w-sm rounded-2xl border p-5 shadow-xl" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}>
            <div className="mb-3 flex items-center justify-between">
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
              <p className="mt-1 text-2xl font-black" style={{ color: 'var(--text-1)' }}>{formatINR(splitAmount)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
