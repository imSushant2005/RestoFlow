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
import { Download, TrendingUp, Lightbulb, TrendingDown, Clock, AlertTriangle, ArrowUpRight, ArrowDownRight, Plus, ReceiptText, Trash2, Calculator } from 'lucide-react';
import { formatINR } from '../lib/currency';

import { usePlanFeatures } from '../hooks/usePlanFeatures';
import { useNavigate } from 'react-router-dom';

type RangeType = '7d' | '30d' | 'custom';

export function Analytics() {
  const [range, setRange] = useState<RangeType>('30d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const navigate = useNavigate();

  const { features } = usePlanFeatures();
  const isBasicsOnly = features.analyticsLevel === 'BASIC';
  const showExpenses = features.hasExpenseTracking;

  const queryParams = useMemo(() => {
    if (range === '7d') return '?days=7';
    if (range === '30d') return '?days=30';
    if (from && to) return `?from=${from}&to=${to}`;
    return '?days=30';
  }, [range, from, to]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['analytics', queryParams],
    queryFn: async () => {
      const res = await api.get(`/analytics${queryParams}`);
      return res.data;
    },
  });

  const { data: expenses = [], refetch: refetchExpenses } = useQuery({
    queryKey: ['expenses', queryParams],
    queryFn: async () => {
      if (!showExpenses) return [];
      const res = await api.get(`/expenses${queryParams}`);
      return res.data;
    },
    enabled: showExpenses
  });

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', category: 'General', date: new Date().toISOString().split('T')[0] });

  const addExpenseMutation = async () => {
    try {
      await api.post('/expenses', expenseForm);
      setIsExpenseModalOpen(false);
      setExpenseForm({ description: '', amount: '', category: 'General', date: new Date().toISOString().split('T')[0] });
      refetch();
      refetchExpenses();
    } catch (err) {
      alert('Failed to add expense');
    }
  };

  const deleteExpenseMutation = async (id: string) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await api.delete(`/expenses/${id}`);
      refetch();
      refetchExpenses();
    } catch (err) {
      alert('Failed to delete expense');
    }
  };

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
      <span className={`inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-full shadow-sm ${positive ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-red-500/10 text-red-600 border border-red-500/20'}`}>
        {positive ? <ArrowUpRight size={12} className="stroke-[3]" /> : <ArrowDownRight size={12} className="stroke-[3]" />}
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto w-full" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>{isBasicsOnly ? 'Standard Tracking' : 'Advanced Analytics'}</h2>
          <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">
            {features.name} Tier Active
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
          icon={<TrendingUp size={24} />}
        />
        <InsightMetric
          title="Orders"
          value={`${data.summary.totalOrders}`}
          subtitle="Fulfilled orders"
          trend={<TrendBadge value={trend.orders} />}
          accent="emerald"
          icon={<Clock size={24} />}
        />
        {showExpenses ? (
          <InsightMetric
            title="Net Profit"
            value={formatINR(data.summary.netProfit)}
            subtitle={`After ${formatINR(data.summary.totalExpenses)} expenses`}
            trend={<TrendBadge value={trend.revenue * 0.9} />}
            accent="violet"
            icon={<Calculator size={24} />}
          />
        ) : (
          <InsightMetric
            title="Conversion"
            value={`${data.summary.conversionRate}%`}
            subtitle="Menu to order"
            trend={<TrendBadge value={trend.conversion} />}
            accent="violet"
            icon={<ArrowUpRight size={24} />}
          />
        )}
      </div>

      {showExpenses && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
           <div className="lg:col-span-2 p-6 rounded-2xl border" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
             <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-xl flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
                 <ReceiptText size={20} className="text-blue-500" />
                 Recent Expenses
               </h3>
               <button 
                onClick={() => setIsExpenseModalOpen(true)}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 hover:bg-blue-500 transition-all"
               >
                 <Plus size={14} /> ADD EXPENSE
               </button>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-left">
                 <thead>
                   <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                     <th className="pb-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Description</th>
                     <th className="pb-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Category</th>
                     <th className="pb-3 text-[10px] font-black uppercase text-slate-500 tracking-wider text-right">Amount</th>
                     <th className="pb-3 text-[10px] font-black uppercase text-slate-500 tracking-wider text-right">Action</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                   {expenses.map((exp: any) => (
                     <tr key={exp.id} className="group">
                       <td className="py-3 text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{exp.description}</td>
                       <td className="py-3">
                         <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 border" style={{ background: 'var(--surface-3)', color: 'var(--text-2)', borderColor: 'var(--border)' }}>
                           {exp.category}
                         </span>
                       </td>
                       <td className="py-3 text-sm font-black text-right" style={{ color: 'var(--text-1)' }}>{formatINR(exp.amount)}</td>
                       <td className="py-3 text-right">
                         <button onClick={() => deleteExpenseMutation(exp.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                           <Trash2 size={14} />
                         </button>
                       </td>
                     </tr>
                   ))}
                   {expenses.length === 0 && (
                     <tr>
                       <td colSpan={4} className="py-8 text-center text-xs font-bold text-slate-500">No expenses recorded for this period.</td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>
           </div>
           
           <div className="p-6 rounded-2xl border flex flex-col justify-between" style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', borderColor: 'rgba(255,255,255,0.1)' }}>
             <div>
               <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                 <Calculator size={18} className="text-blue-400" />
                 Profit Analysis
               </h3>
               <div className="space-y-4">
                 <div className="flex justify-between items-end">
                   <span className="text-slate-400 text-xs font-bold uppercase">Gross Revenue</span>
                   <span className="text-white font-black">{formatINR(data.summary.totalRevenue)}</span>
                 </div>
                 <div className="flex justify-between items-end">
                   <span className="text-slate-400 text-xs font-bold uppercase">Total Expenses</span>
                   <span className="text-red-400 font-black">- {formatINR(data.summary.totalExpenses)}</span>
                 </div>
                 <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                   <span className="text-blue-400 text-sm font-black uppercase">Net Profit</span>
                   <span className="text-emerald-400 text-2xl font-black">{formatINR(data.summary.netProfit)}</span>
                 </div>
               </div>
             </div>
             <div className="mt-8 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
               <p className="text-[10px] text-blue-300 font-bold leading-tight">
                 Your profit margin is {((data.summary.netProfit / (data.summary.totalRevenue || 1)) * 100).toFixed(1)}% for this period.
               </p>
             </div>
           </div>
        </div>
      )}

      {insights.length > 0 && (
        <div className="mb-8 rounded-2xl p-6 relative overflow-hidden" style={{ background: 'linear-gradient(to right, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
          <h3 className="font-black text-lg mb-4 flex items-center justify-between" style={{ color: 'var(--text-1)' }}>
            <div className="flex items-center gap-2">
              <Lightbulb size={20} className="text-indigo-400" />
              Smart Insights
            </div>
            {isBasicsOnly && (
              <button 
                onClick={() => navigate('/app/subscription')}
                className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-widest border border-indigo-500/20 hover:bg-indigo-500/20 transition-all cursor-pointer"
              >
                 Upgrade to Unlock All
              </button>
            )}
          </h3>
          <div className="space-y-3">
            {insights.slice(0, isBasicsOnly ? 2 : undefined).map((insight, idx) => (
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
            {isBasicsOnly && (
               <div className="p-3 text-xs font-bold text-slate-500 italic opacity-50">
                 + {insights.length - 2} more insights locked for {features.name} users
               </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        <div className="p-8 rounded-2xl shadow-sm relative group" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <h3 className="font-bold text-2xl mb-8" style={{ color: 'var(--text-1)' }}>Revenue Growth</h3>
          {isBasicsOnly && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center backdrop-blur-[6px] bg-slate-950/40 rounded-2xl transition-all group-hover:bg-slate-950/50">
               <div className="bg-slate-900/80 p-5 rounded-2xl border border-blue-500/30 text-center shadow-2xl">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <TrendingUp size={24} className="text-blue-500" />
                  </div>
                  <h4 className="text-white font-black text-sm uppercase tracking-tighter">Pro Revenue Analytics</h4>
                  <p className="text-slate-400 text-[10px] font-bold mt-1">Unlock growth trends and custom range insights</p>
                  <button onClick={() => navigate('/app/subscription')} className="mt-4 w-full py-2 bg-blue-600 rounded-lg text-xs font-black text-white hover:bg-blue-500 transition-all">UPGRADE NOW</button>
               </div>
            </div>
          )}
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

        <div className="p-8 rounded-2xl shadow-sm relative group" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <h3 className="font-bold text-2xl mb-8" style={{ color: 'var(--text-1)' }}>Peak Dining Hours</h3>
          {isBasicsOnly && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center backdrop-blur-[6px] bg-slate-950/40 rounded-2xl transition-all group-hover:bg-slate-950/50">
               <div className="bg-slate-900/80 p-5 rounded-2xl border border-orange-500/30 text-center shadow-2xl">
                  <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock size={24} className="text-orange-500" />
                  </div>
                  <h4 className="text-white font-black text-sm uppercase tracking-tighter">Peak Hour Tracking</h4>
                  <p className="text-slate-400 text-[10px] font-bold mt-1">Analyze when your restaurant is busiest</p>
                  <button onClick={() => navigate('/app/subscription')} className="mt-4 w-full py-2 bg-orange-600 rounded-lg text-xs font-black text-white hover:bg-orange-500 transition-all">UPGRADE NOW</button>
               </div>
            </div>
          )}
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

      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-[32px] p-8 shadow-2xl animate-in fade-in zoom-in duration-200" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <h3 className="text-2xl font-black mb-6" style={{ color: 'var(--text-1)' }}>Record Expense</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-1">Description</label>
                <input 
                  type="text" 
                  placeholder="e.g. Electricity Bill, Fresh Produce"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                  className="w-full bg-slate-100 border p-3 rounded-2xl outline-none text-sm font-semibold"
                  style={{ background: 'var(--surface-3)', borderColor: 'var(--border)', color: 'var(--text-1)' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-1">Amount</label>
                  <input 
                    type="number" 
                    placeholder="₹0.00"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})}
                    className="w-full bg-slate-100 border p-3 rounded-2xl outline-none text-sm font-semibold"
                    style={{ background: 'var(--surface-3)', borderColor: 'var(--border)', color: 'var(--text-1)' }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-1">Category</label>
                  <select 
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({...expenseForm, category: e.target.value})}
                    className="w-full bg-slate-100 border p-3 rounded-2xl outline-none text-sm font-semibold"
                    style={{ background: 'var(--surface-3)', borderColor: 'var(--border)', color: 'var(--text-1)' }}
                  >
                    <option value="General">General</option>
                    <option value="Inventory">Inventory</option>
                    <option value="Salaries">Salaries</option>
                    <option value="Rent">Rent</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-1">Date</label>
                <input 
                  type="date" 
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})}
                  className="w-full bg-slate-100 border p-3 rounded-2xl outline-none text-sm font-semibold"
                  style={{ background: 'var(--surface-3)', borderColor: 'var(--border)', color: 'var(--text-1)' }}
                />
              </div>
            </div>
            <div className="mt-8 flex gap-3">
              <button 
                onClick={() => setIsExpenseModalOpen(false)}
                className="flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
              >
                Cancel
              </button>
              <button 
                onClick={addExpenseMutation}
                className="flex-1 py-3 rounded-2xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all"
              >
                Save Expense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InsightMetric({
  title,
  value,
  subtitle,
  trend,
  accent,
  icon
}: {
  title: string;
  value: string;
  subtitle: string;
  trend: React.ReactNode;
  accent: 'blue' | 'emerald' | 'violet';
  icon?: React.ReactNode;
}) {
  const shadowColor = accent === 'blue' ? 'rgba(37,99,235,0.15)' : accent === 'emerald' ? 'rgba(16,185,129,0.15)' : 'rgba(139,92,246,0.15)';
  const iconColor = accent === 'blue' ? 'var(--brand)' : accent === 'emerald' ? 'var(--success)' : '#8b5cf6';

  return (
    <div
      className="p-8 rounded-[2rem] border transition-all hover:scale-[1.02] duration-300 relative overflow-hidden group"
      style={{
        background: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
        boxShadow: `0 20px 40px -15px ${shadowColor}`,
      }}
    >
      <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-500" style={{ color: iconColor }}>
        {icon}
      </div>
      
      <div className="flex items-center justify-between mb-6">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center`} style={{ background: `${iconColor}15`, color: iconColor }}>
          {icon}
        </div>
        {trend}
      </div>
      
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1" style={{ color: 'var(--text-3)' }}>{title}</p>
        <p className="text-4xl font-black tracking-tighter" style={{ color: 'var(--text-1)' }}>{value}</p>
        <p className="text-sm mt-2 font-bold opacity-60" style={{ color: 'var(--text-3)' }}>{subtitle}</p>
      </div>
    </div>
  );
}
