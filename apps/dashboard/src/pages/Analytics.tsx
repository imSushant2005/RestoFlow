import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Cell,
} from 'recharts';
import { Download, TrendingUp, Lightbulb, TrendingDown, Clock, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatINR } from '../lib/currency';

type RangeType = '7d' | '30d' | 'custom';

export function Analytics() {
  const [range, setRange] = useState<RangeType>('30d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Plan logic
  const activePlan = localStorage.getItem('rf_active_plan');
  const isBasicsOnly = activePlan === 'MINI' || activePlan === 'CAFE';

  const queryParams = useMemo(() => {
    if (range === '7d') return '?days=7';
    if (range === '30d') return '?days=30';
    if (from && to) return `?from=${from}&to=${to}`;
    return '?days=30';
  }, [range, from, to]);

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', queryParams],
    queryFn: async () => {
      const res = await api.get(`/analytics${queryParams}`);
      return res.data;
    },
  });

  const downloadCSV = () => {
    if (!data) return;
    const headers = 'Date,Revenue\n';
    const rows = data.revenueChart.map((r: any) => `${r.date},${r.revenue}`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'revenue_report.csv';
    a.click();
  };

  const trend = useMemo(() => {
    if (!data?.revenueChart?.length) return { revenue: 0, orders: 0, conversion: 0 };
    const chart = data.revenueChart as Array<{ revenue: number }>;
    const mid = Math.floor(chart.length / 2);
    const first = chart.slice(0, mid);
    const second = chart.slice(mid);
    const avg = (arr: Array<{ revenue: number }>) =>
      arr.length ? arr.reduce((sum, v) => sum + Number(v.revenue || 0), 0) / arr.length : 0;
    const firstAvg = avg(first);
    const secondAvg = avg(second);
    const revenueTrend = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

    const ordersTrend = firstAvg > 0 && data.summary?.totalOrders
      ? revenueTrend * 0.7
      : 0;
    const conversionTrend = data.summary?.conversionRate > 0
      ? Math.max(-30, Math.min(30, revenueTrend * 0.25))
      : 0;
    return {
      revenue: revenueTrend,
      orders: ordersTrend,
      conversion: conversionTrend,
    };
  }, [data]);

  const insights = useMemo(() => {
    if (!data) return [];
    const tips: { icon: React.ReactNode; text: string; type: 'warning' | 'tip' | 'info' }[] = [];

    if (data.peakHours?.length > 0) {
      const peak = [...data.peakHours].sort((a: any, b: any) => b.count - a.count)[0];
      if (peak) tips.push({ icon: <Clock size={16} />, text: `Peak hour is ${peak.hour} with ${peak.count} orders. Add staffing here.`, type: 'info' });
    }

    if (data.topItems?.length > 3) {
      const lowest = data.topItems[data.topItems.length - 1];
      if (lowest && lowest.count < 5) {
        tips.push({ icon: <TrendingDown size={16} />, text: `"${lowest.name}" is underperforming (${lowest.count} orders). Test a promo or revise placement.`, type: 'warning' });
      }
    }

    if (data.summary?.conversionRate < 30) {
      tips.push({ icon: <AlertTriangle size={16} />, text: `Conversion is ${data.summary.conversionRate}%. Improve item photos, highlights, and CTA clarity.`, type: 'warning' });
    } else if (data.summary?.conversionRate > 60) {
      tips.push({ icon: <TrendingUp size={16} />, text: `Excellent ${data.summary.conversionRate}% conversion. Keep bestsellers above the fold.`, type: 'tip' });
    }

    if (data.topItems?.[0]) {
      const topItem = data.topItems[0];
      tips.push({ icon: <Lightbulb size={16} />, text: `"${topItem.name}" leads sales (${topItem.count} orders, ${formatINR(topItem.revenue)}). Feature it in recommendations.`, type: 'tip' });
    }

    return tips;
  }, [data]);

  if (isLoading || !data) return <div className="p-8 text-xl font-medium animate-pulse" style={{ color: 'var(--text-3)' }}>Loading Analytics Data...</div>;

  const TrendBadge = ({ value }: { value: number }) => {
    const positive = value >= 0;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-black px-2 py-1 rounded-full ${positive ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
        {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto w-full" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>{isBasicsOnly ? 'Basic Analytics' : 'Pro Insights'}</h2>
          <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">
            {activePlan || 'Trial'} Plan Performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setRange('7d')} className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${range === '7d' ? 'bg-blue-600 text-white' : 'bg-transparent border'}`} style={range === '7d' ? {} : { color: 'var(--text-2)', borderColor: 'var(--border)' }}>7d</button>
          <button onClick={() => setRange('30d')} className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${range === '30d' ? 'bg-blue-600 text-white' : 'bg-transparent border'}`} style={range === '30d' ? {} : { color: 'var(--text-2)', borderColor: 'var(--border)' }}>30d</button>
          <button onClick={() => setRange('custom')} className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${range === 'custom' ? 'bg-blue-600 text-white' : 'bg-transparent border'}`} style={range === 'custom' ? {} : { color: 'var(--text-2)', borderColor: 'var(--border)' }}>Custom</button>
          {range === 'custom' && (
            <>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-2 rounded-lg outline-none text-sm" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-1)' }} />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-2 rounded-lg outline-none text-sm" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-1)' }} />
            </>
          )}
          <button
            onClick={downloadCSV}
            className="bg-blue-600 text-white px-4 py-2 flex items-center gap-2 rounded-xl font-bold shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all ml-2"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <InsightMetric
          title="Revenue"
          value={formatINR(data.summary.totalRevenue)}
          subtitle="Selected period"
          trend={<TrendBadge value={trend.revenue} />}
          accent="blue"
        />
        <InsightMetric
          title="Orders"
          value={`${data.summary.totalOrders}`}
          subtitle="Fulfilled orders"
          trend={<TrendBadge value={trend.orders} />}
          accent="emerald"
        />
        <InsightMetric
          title="Conversion"
          value={`${data.summary.conversionRate}%`}
          subtitle="Menu to order"
          trend={<TrendBadge value={trend.conversion} />}
          accent="violet"
        />
      </div>

      {insights.length > 0 && (
        <div className="mb-8 rounded-2xl p-6" style={{ background: 'linear-gradient(to right, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
          <h3 className="font-black text-lg mb-4 flex items-center justify-between" style={{ color: 'var(--text-1)' }}>
            <div className="flex items-center gap-2">
              <Lightbulb size={20} className="text-indigo-400" />
              Smart Insights
            </div>
            {isBasicsOnly && (
              <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-widest border border-indigo-500/20">
                 Limited in {activePlan}
              </span>
            )}
          </h3>
          <div className="space-y-3">
            {insights.map((insight, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-xl ${
                  insight.type === 'warning' ? 'bg-amber-500/10 text-amber-500' : insight.type === 'tip' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">{insight.icon}</div>
                <p className="text-sm font-semibold">{insight.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        <div className="p-8 rounded-2xl shadow-sm" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <h3 className="font-bold text-2xl mb-8" style={{ color: 'var(--text-1)' }}>Revenue Growth</h3>
          <div className="h-80 select-none">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.revenueChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-3)', fontSize: 12, fontWeight: 500 }} dy={15} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-3)', fontSize: 12, fontWeight: 500 }} tickFormatter={(v) => formatINR(v)} dx={-10} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface-raised)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', padding: '12px 16px' }}
                  labelStyle={{ color: 'var(--text-3)', fontWeight: 600, marginBottom: '4px' }}
                  itemStyle={{ fontWeight: 800, color: 'var(--text-1)' }}
                  formatter={(val: any) => [formatINR(Number(val)), 'Revenue']}
                />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, strokeWidth: 3, fill: 'var(--surface-raised)', stroke: '#3b82f6' }} activeDot={{ r: 8, strokeWidth: 0, fill: '#2563eb' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-8 rounded-2xl shadow-sm" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <h3 className="font-bold text-2xl mb-8" style={{ color: 'var(--text-1)' }}>Peak Dining Hours</h3>
          <div className="h-80 select-none">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.peakHours}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-3)', fontSize: 12, fontWeight: 500 }} dy={15} />
                <Tooltip
                  cursor={{ fill: 'var(--surface-3)' }}
                  contentStyle={{ background: 'var(--surface-raised)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)' }}
                  labelStyle={{ color: 'var(--text-3)', fontWeight: 600 }}
                  itemStyle={{ fontWeight: 800, color: 'var(--text-1)' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {data.peakHours?.map((entry: any, index: number) => {
                    const peakValues = data.peakHours?.map((d: any) => d.count) || [];
                    const max = peakValues.length > 0 ? Math.max(...peakValues) : 1;
                    const intensity = entry.count / max;
                    return <Cell key={`cell-${index}`} fill={intensity > 0.7 ? '#ef4444' : intensity > 0.4 ? '#f97316' : '#60a5fa'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="p-8 rounded-2xl shadow-sm mb-8" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
        <h3 className="font-bold text-2xl mb-6" style={{ color: 'var(--text-1)' }}>Top Performing Items</h3>
        <div className="flex flex-col gap-4">
          {data.topItems.map((item: any, i: number) => (
            <div key={i} className="flex justify-between items-center p-5 rounded-xl border transition-colors" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-5">
                <span className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center font-bold">{i + 1}</span>
                <div>
                  <span className="font-bold block text-lg" style={{ color: 'var(--text-1)' }}>{item.name}</span>
                  <span className="font-medium" style={{ color: 'var(--text-3)' }}>{item.count} units sold</span>
                </div>
              </div>
              <span className="font-black text-2xl text-blue-600">{formatINR(item.revenue)}</span>
            </div>
          ))}
          {data.topItems.length === 0 && <div className="py-8 text-center text-lg" style={{ color: 'var(--text-3)' }}>No analytical data generated yet.</div>}
        </div>
      </div>
    </div>
  );
}

function InsightMetric({
  title,
  value,
  subtitle,
  trend,
  accent,
}: {
  title: string;
  value: string;
  subtitle: string;
  trend: React.ReactNode;
  accent: 'blue' | 'emerald' | 'violet';
}) {
  return (
    <div
      className="p-6 rounded-2xl border shadow-sm"
      style={{
        background:
          accent === 'blue'
            ? 'linear-gradient(135deg, var(--card-bg), rgba(37,99,235,0.08))'
            : accent === 'emerald'
              ? 'linear-gradient(135deg, var(--card-bg), rgba(16,185,129,0.08))'
              : 'linear-gradient(135deg, var(--card-bg), rgba(139,92,246,0.08))',
        borderColor: 'var(--card-border)',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{title}</p>
        {trend}
      </div>
      <p className="text-4xl font-black mt-2" style={{ color: 'var(--text-1)' }}>{value}</p>
      <p className="text-sm mt-1 font-medium" style={{ color: 'var(--text-3)' }}>{subtitle}</p>
    </div>
  );
}
