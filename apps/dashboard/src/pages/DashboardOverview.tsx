import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { api } from '../lib/api';
import { formatINR } from '../lib/currency';

function toAmount(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function parseDate(value: unknown) {
  const parsed = value instanceof Date ? value : new Date(String(value || ''));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatTime(value: unknown, fallback = '--:--') {
  const parsed = parseDate(value);
  if (!parsed) return fallback;
  return format(parsed, 'h:mm a');
}

function shortCode(value: unknown) {
  const raw = typeof value === 'string' ? value : String(value || '');
  if (!raw) return '------';
  return raw.slice(-6).toUpperCase();
}

export function DashboardOverview() {
  const navigate = useNavigate();

  const { data: liveOrders = [] } = useQuery<any[]>({
    queryKey: ['live-orders'],
    queryFn: async () => (await api.get('/orders')).data,
    staleTime: 1000 * 10,
  });

  const { data: historyResponse } = useQuery<any>({
    queryKey: ['order-history'],
    queryFn: async () => (await api.get('/orders/history')).data,
    staleTime: 1000 * 20,
  });

  const { data: zonesResponse } = useQuery<any>({
    queryKey: ['zones-overview'],
    queryFn: async () => (await api.get('/venue/zones')).data,
    staleTime: 1000 * 20,
    retry: false,
  });

  const historyOrders = historyResponse?.data || [];
  const tables = useMemo(
    () => (zonesResponse?.zones || []).flatMap((zone: any) => (Array.isArray(zone.tables) ? zone.tables : [])),
    [zonesResponse?.zones],
  );

  const stats = useMemo(() => {
    const liveRevenue = liveOrders.reduce((sum: number, order: any) => sum + toAmount(order?.totalAmount), 0);
    const historicalRevenue = historyOrders.reduce((sum: number, order: any) => sum + toAmount(order?.totalAmount), 0);
    const occupied = tables.filter((table: any) => String(table?.status || '').toUpperCase() === 'OCCUPIED').length;
    const totalTables = tables.length;
    const occupancy = totalTables > 0 ? Math.round((occupied / totalTables) * 100) : 0;
    const avgTicket = liveOrders.length > 0 ? liveRevenue / liveOrders.length : 0;

    return {
      revenue: liveRevenue + historicalRevenue,
      liveOrders: liveOrders.length,
      occupancy,
      occupied,
      totalTables,
      avgTicket,
    };
  }, [historyOrders, liveOrders, tables]);

  const latestOrders = useMemo(
    () =>
      [...liveOrders]
        .sort(
          (a: any, b: any) =>
            (parseDate(b?.createdAt)?.getTime() || 0) - (parseDate(a?.createdAt)?.getTime() || 0),
        )
        .slice(0, 6),
    [liveOrders],
  );

  const popularItems = useMemo(() => {
    const itemMap = new Map<string, { name: string; count: number; revenue: number }>();
    [...liveOrders, ...historyOrders].forEach((order: any) => {
      (order?.items || []).forEach((item: any) => {
        const name = item?.menuItem?.name || item?.name || 'Item';
        const count = Number(item?.quantity) || 0;
        const price = Number(item?.price) || Number(item?.menuItem?.price) || 0;
        const entry = itemMap.get(name) || { name, count: 0, revenue: 0 };
        entry.count += count;
        entry.revenue += count * price;
        itemMap.set(name, entry);
      });
    });
    return Array.from(itemMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [historyOrders, liveOrders]);

  const hourlyRevenue = useMemo(() => {
    const buckets = new Array(8).fill(0).map((_unused, index) => ({
      label: `${10 + index}:00`,
      value: 0,
    }));
    liveOrders.forEach((order: any) => {
      const createdAt = parseDate(order?.createdAt);
      if (!createdAt) return;
      const idx = Math.max(0, Math.min(7, createdAt.getHours() - 10));
      buckets[idx].value += toAmount(order?.totalAmount);
    });
    const peak = Math.max(...buckets.map((bucket) => bucket.value), 1);
    return buckets.map((bucket) => ({
      ...bucket,
      height: Math.max(8, Math.round((bucket.value / peak) * 100)),
    }));
  }, [liveOrders]);

  return (
    <div className="p-3 sm:p-5 lg:p-6 min-h-full">
      <div className="space-y-4">
        <div id="dashboard-stats-grid" className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          {[
            { label: 'Daily Revenue', value: formatINR(stats.revenue), sub: 'Today + history' },
            { label: 'Live Orders', value: `${stats.liveOrders}`, sub: 'Current active flow' },
            { label: 'Occupancy', value: `${stats.occupancy}%`, sub: `${stats.occupied}/${stats.totalTables || 0} tables` },
            { label: 'Average Ticket', value: formatINR(stats.avgTicket), sub: 'Per live order' },
          ].map((card) => (
            <article
              key={card.label}
              className="rounded-2xl border px-4 py-3"
              style={{
                borderColor: 'var(--card-border)',
                background:
                  'radial-gradient(120% 120% at 92% -20%, var(--brand-glow), transparent 58%), var(--card-bg)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <p className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                {card.label}
              </p>
              <p className="mt-2 text-2xl font-black" style={{ color: 'var(--text-1)' }}>
                {card.value}
              </p>
              <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
                {card.sub}
              </p>
            </article>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.75fr_1fr]">
          <section
            className="rounded-3xl border p-4"
            style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)', boxShadow: 'var(--card-shadow)' }}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em]" style={{ color: 'var(--brand)' }}>
                  Table Map
                </p>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
                  Occupancy snapshot
                </p>
              </div>
              <button
                onClick={() => navigate('/app/tables')}
                className="rounded-lg px-3 py-1.5 text-xs font-black text-white transition hover:brightness-110"
                style={{ background: 'var(--brand)' }}
              >
                Open Tables
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {(tables.length
                ? tables.map((table: any, idx: number) => ({
                    id: table?.id || `table-${idx}`,
                    name: table?.name || `${idx + 1}`,
                    status: String(table?.status || 'AVAILABLE').toUpperCase(),
                  }))
                : new Array(20).fill(null).map((_x, idx) => ({
                    id: `placeholder-${idx}`,
                    name: `${idx + 1}`,
                    status: 'AVAILABLE',
                  }))
              )
                .slice(0, 20)
                .map((table: any) => {
                  const tone =
                    table.status === 'OCCUPIED'
                      ? { border: '1px solid #f87171', background: '#fef2f2', color: '#991b1b' }
                      : table.status === 'RESERVED'
                        ? { border: '1px solid #a78bfa', background: '#f5f3ff', color: '#5b21b6' }
                        : { border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' };
                  return (
                    <button
                      key={table.id}
                      onClick={() => navigate('/app/tables')}
                      className="rounded-xl px-2 py-3 text-left transition hover:brightness-105"
                      style={tone}
                    >
                      <p className="truncate text-[11px] font-black uppercase tracking-[0.12em]">{table.name}</p>
                      <p className="mt-1 text-[10px] font-semibold uppercase opacity-90">{table.status}</p>
                    </button>
                  );
                })}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-3">
            <section
              className="rounded-3xl border p-4"
              style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)', boxShadow: 'var(--card-shadow)' }}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-1)' }}>
                  Live Orders
                </p>
                <button
                  onClick={() => navigate('/app/orders')}
                  className="text-xs font-bold underline-offset-4 hover:underline"
                  style={{ color: 'var(--brand)' }}
                >
                  Open Orders
                </button>
              </div>
              <div className="space-y-2">
                {latestOrders.length === 0 && (
                  <p
                    className="rounded-xl px-3 py-2 text-xs font-semibold"
                    style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-3)' }}
                  >
                    No live orders right now.
                  </p>
                )}
                {latestOrders.map((order: any) => (
                  <button
                    key={order.id}
                    onClick={() => navigate('/app/orders')}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:brightness-105"
                    style={{ border: '1px solid var(--border)', background: 'var(--surface-2)' }}
                  >
                    <div>
                      <p className="text-xs font-black" style={{ color: 'var(--text-1)' }}>
                        {order.orderNumber || `#${shortCode(order?.id)}`}
                      </p>
                      <p className="text-[10px] font-semibold" style={{ color: 'var(--text-3)' }}>
                        {formatTime(order?.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black" style={{ color: 'var(--text-1)' }}>
                        {formatINR(toAmount(order?.totalAmount))}
                      </p>
                      <p className="text-[10px] font-semibold" style={{ color: 'var(--success)' }}>
                        {order.status}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section
              className="rounded-3xl border p-4"
              style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)', boxShadow: 'var(--card-shadow)' }}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-1)' }}>
                  Popular Items
                </p>
                <button
                  onClick={() => navigate('/app/menu')}
                  className="text-xs font-bold underline-offset-4 hover:underline"
                  style={{ color: 'var(--brand)' }}
                >
                  Open Menu
                </button>
              </div>
              <div className="space-y-2">
                {popularItems.length === 0 && (
                  <p
                    className="rounded-xl px-3 py-2 text-xs font-semibold"
                    style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-3)' }}
                  >
                    Item trends appear after orders.
                  </p>
                )}
                {popularItems.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between rounded-xl px-3 py-2"
                    style={{ border: '1px solid var(--border)', background: 'var(--surface-2)' }}
                  >
                    <div>
                      <p className="text-xs font-black" style={{ color: 'var(--text-1)' }}>
                        {item.name}
                      </p>
                      <p className="text-[10px] font-semibold" style={{ color: 'var(--text-3)' }}>
                        {item.count} units
                      </p>
                    </div>
                    <p className="text-xs font-black" style={{ color: 'var(--brand)' }}>
                      {formatINR(item.revenue)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <section
          className="rounded-3xl border p-4"
          style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)', boxShadow: 'var(--card-shadow)' }}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-1)' }}>
              Revenue (Hourly)
            </p>
            <button
              onClick={() => navigate('/app/analytics')}
              className="text-xs font-bold underline-offset-4 hover:underline"
              style={{ color: 'var(--brand)' }}
            >
              Open Analytics
            </button>
          </div>
          <div className="grid grid-cols-8 gap-2">
            {hourlyRevenue.map((point) => (
              <div key={point.label} className="flex flex-col items-center gap-2">
                <div
                  className="relative flex h-24 w-full items-end justify-center overflow-hidden rounded-lg"
                  style={{ border: '1px solid var(--border)', background: 'var(--surface-2)' }}
                >
                  <div
                    className="w-3/4 rounded-t-md"
                    style={{
                      height: `${point.height}%`,
                      background: 'linear-gradient(180deg, #60a5fa, var(--brand))',
                    }}
                  />
                </div>
                <p className="text-[10px] font-semibold" style={{ color: 'var(--text-3)' }}>
                  {point.label}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
