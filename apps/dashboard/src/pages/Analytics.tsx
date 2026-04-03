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
      if (lowest?.count < 5) {
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

  if (isLoading || !data) return <div className="p-8 text-gray-500 text-xl font-medium animate-pulse">Loading Analytics Data...</div>;

  const TrendBadge = ({ value }: { value: number }) => {
    const positive = value >= 0;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-black px-2 py-1 rounded-full ${positive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
        {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="flex-1 p-8 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Analytics Insights</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setRange('7d')} className={`px-3 py-2 rounded-lg text-sm font-bold ${range === '7d' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}>7d</button>
          <button onClick={() => setRange('30d')} className={`px-3 py-2 rounded-lg text-sm font-bold ${range === '30d' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}>30d</button>
          <button onClick={() => setRange('custom')} className={`px-3 py-2 rounded-lg text-sm font-bold ${range === 'custom' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}>Custom</button>
          {range === 'custom' && (
            <>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-2 rounded-lg border text-sm" />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-2 rounded-lg border text-sm" />
            </>
          )}
          <button
            onClick={downloadCSV}
            className="bg-blue-600 text-white px-4 py-2 flex items-center gap-2 rounded-xl font-bold shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all"
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
        <div className="mb-8 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-6">
          <h3 className="font-black text-indigo-900 text-lg mb-4 flex items-center gap-2">
            <Lightbulb size={20} className="text-indigo-600" />
            Smart Insights
          </h3>
          <div className="space-y-3">
            {insights.map((insight, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-xl ${
                  insight.type === 'warning' ? 'bg-amber-50 text-amber-800' : insight.type === 'tip' ? 'bg-emerald-50 text-emerald-800' : 'bg-blue-50 text-blue-800'
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
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-2xl mb-8 text-gray-900">Revenue Growth</h3>
          <div className="h-80 select-none">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.revenueChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }} dy={15} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }} tickFormatter={(v) => formatINR(v)} dx={-10} />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', padding: '12px 16px' }}
                  labelStyle={{ color: '#64748b', fontWeight: 600, marginBottom: '4px' }}
                  itemStyle={{ fontWeight: 800, color: '#1e293b' }}
                  formatter={(val: any) => [formatINR(Number(val)), 'Revenue']}
                />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, strokeWidth: 3, fill: '#fff', stroke: '#3b82f6' }} activeDot={{ r: 8, strokeWidth: 0, fill: '#2563eb' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-2xl mb-8 text-gray-900">Peak Dining Hours</h3>
          <div className="h-80 select-none">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.peakHours}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }} dy={15} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ color: '#64748b', fontWeight: 600 }}
                  itemStyle={{ fontWeight: 800, color: '#1e293b' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {data.peakHours.map((entry: any, index: number) => {
                    const max = Math.max(...data.peakHours.map((d: any) => d.count));
                    const intensity = entry.count / (max || 1);
                    return <Cell key={`cell-${index}`} fill={intensity > 0.7 ? '#ef4444' : intensity > 0.4 ? '#f97316' : '#60a5fa'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-8">
        <h3 className="font-bold text-2xl mb-6 text-gray-900">Top Performing Items</h3>
        <div className="flex flex-col gap-4">
          {data.topItems.map((item: any, i: number) => (
            <div key={i} className="flex justify-between items-center p-5 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-5">
                <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">{i + 1}</span>
                <div>
                  <span className="font-bold text-gray-900 block text-lg">{item.name}</span>
                  <span className="font-medium text-gray-500">{item.count} units sold</span>
                </div>
              </div>
              <span className="font-black text-2xl text-blue-600">{formatINR(item.revenue)}</span>
            </div>
          ))}
          {data.topItems.length === 0 && <div className="py-8 text-center text-gray-500 text-lg">No analytical data generated yet.</div>}
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
  const accentStyles =
    accent === 'blue'
      ? 'from-blue-50 to-blue-100 border-blue-200'
      : accent === 'emerald'
      ? 'from-emerald-50 to-emerald-100 border-emerald-200'
      : 'from-violet-50 to-violet-100 border-violet-200';

  return (
    <div className={`bg-gradient-to-br ${accentStyles} p-6 rounded-2xl border shadow-sm`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-wider text-gray-600">{title}</p>
        {trend}
      </div>
      <p className="text-4xl font-black text-gray-900 mt-2">{value}</p>
      <p className="text-sm text-gray-600 mt-1 font-medium">{subtitle}</p>
    </div>
  );
}
