import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Cell, FunnelChart, Funnel, LabelList } from 'recharts';
import { Download, TrendingUp, Lightbulb, TrendingDown, Clock, AlertTriangle } from 'lucide-react';
import { formatINR } from '../lib/currency';

export function Analytics() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: async () => {
      const res = await api.get('/analytics');
      return res.data;
    }
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

  // USP 7: Rule-based Smart Insights (Zero AI)
  const insights = useMemo(() => {
    if (!data) return [];
    const tips: { icon: React.ReactNode; text: string; type: 'warning' | 'tip' | 'info' }[] = [];

    // Peak hour detection
    if (data.peakHours?.length > 0) {
      const peak = [...data.peakHours].sort((a: any, b: any) => b.count - a.count)[0];
      if (peak) tips.push({ icon: <Clock size={16} />, text: `Peak hour is ${peak.hour} with ${peak.count} orders. Consider adding extra staff during this window.`, type: 'info' });
    }

    // Low performers
    if (data.topItems?.length > 3) {
      const lowest = data.topItems[data.topItems.length - 1];
      if (lowest?.count < 5) {
        tips.push({ icon: <TrendingDown size={16} />, text: `"${lowest.name}" has only ${lowest.count} orders. Consider a combo deal or removing it.`, type: 'warning' });
      }
    }

    // Conversion rate
    if (data.summary?.conversionRate < 30) {
      tips.push({ icon: <AlertTriangle size={16} />, text: `Conversion rate is ${data.summary.conversionRate}%. Add item photos and descriptions to boost orders.`, type: 'warning' });
    } else if (data.summary?.conversionRate > 60) {
      tips.push({ icon: <TrendingUp size={16} />, text: `Excellent ${data.summary.conversionRate}% conversion! Your menu is performing above industry average.`, type: 'tip' });
    }

    // Revenue trend
    if (data.revenueChart?.length >= 7) {
      const recent = data.revenueChart.slice(-3);
      const older = data.revenueChart.slice(-7, -3);
      const recentAvg = recent.reduce((s: number, r: any) => s + r.revenue, 0) / recent.length;
      const olderAvg = older.reduce((s: number, r: any) => s + r.revenue, 0) / Math.max(older.length, 1);
      if (recentAvg < olderAvg * 0.7) {
        tips.push({ icon: <TrendingDown size={16} />, text: `Revenue dropped ~${Math.round((1 - recentAvg / olderAvg) * 100)}% in the last 3 days vs prior period. Consider promotions.`, type: 'warning' });
      }
    }

    // Top item insight
    if (data.topItems?.[0]) {
      const topItem = data.topItems[0];
      tips.push({ icon: <Lightbulb size={16} />, text: `"${topItem.name}" is your #1 seller (${topItem.count} orders, ${formatINR(topItem.revenue)}). Feature it prominently!`, type: 'tip' });
    }

    return tips;
  }, [data]);

  if (isLoading || !data) return <div className="p-8 text-gray-500 text-xl font-medium animate-pulse">Loading Analytics Data...</div>;

  return (
    <div className="flex-1 p-8 bg-gray-50 overflow-y-auto w-full">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Analytics Insights</h2>
        <button 
          onClick={downloadCSV}
          className="bg-blue-600 text-white px-5 py-2.5 flex items-center gap-2 rounded-xl font-bold shadow-md shadow-blue-500/20 hover:bg-blue-700 hover:-translate-y-0.5 transition-all active:scale-[0.98]"
        >
          <Download size={18} strokeWidth={2.5} /> Export CSV
        </button>
      </div>

      {/* USP 7: Smart Insights */}
      {insights.length > 0 && (
        <div className="mb-8 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-6">
          <h3 className="font-black text-indigo-900 text-lg mb-4 flex items-center gap-2">
            <Lightbulb size={20} className="text-indigo-600" />
            Smart Insights
            <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold uppercase">Auto-generated</span>
          </h3>
          <div className="space-y-3">
            {insights.map((insight, idx) => (
              <div key={idx} className={`flex items-start gap-3 p-3 rounded-xl ${
                insight.type === 'warning' ? 'bg-amber-50 text-amber-800' :
                insight.type === 'tip' ? 'bg-emerald-50 text-emerald-800' :
                'bg-blue-50 text-blue-800'
              }`}>
                <div className="mt-0.5 flex-shrink-0">{insight.icon}</div>
                <p className="text-sm font-semibold">{insight.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center transition-shadow hover:shadow-md">
          <span className="text-blue-600 font-bold mb-2 uppercase tracking-widest text-sm">Total Revenue (30 Days)</span>
          <span className="text-4xl lg:text-5xl font-black text-gray-900 tracking-tight">{formatINR(data.summary.totalRevenue)}</span>
        </div>
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center transition-shadow hover:shadow-md">
          <span className="text-blue-600 font-bold mb-2 uppercase tracking-widest text-sm">Orders Fulfilled</span>
          <span className="text-4xl lg:text-5xl font-black text-gray-900 tracking-tight">{data.summary.totalOrders} <span className="text-xl text-gray-400 font-medium">orders</span></span>
        </div>
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center transition-shadow hover:shadow-md relative overflow-hidden">
          <span className="text-green-600 font-bold mb-2 uppercase tracking-widest text-sm">Menu Conversion Rate</span>
          <span className="text-4xl lg:text-5xl font-black text-gray-900 tracking-tight">{data.summary.conversionRate}%</span>
          <TrendingUp className="absolute -bottom-4 -right-4 text-green-500 opacity-10" size={120} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-2xl mb-8 text-gray-900">Revenue Growth</h3>
          <div className="h-80 select-none">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.revenueChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 500}} dy={15} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 500}} tickFormatter={v => formatINR(v)} dx={-10} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', padding: '12px 16px' }}
                  labelStyle={{ color: '#64748b', fontWeight: 600, marginBottom: '4px' }}
                  itemStyle={{ fontWeight: 800, color: '#1e293b' }}
                  formatter={(val: any) => [formatINR(Number(val)), 'Revenue']}
                />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={4} dot={{r: 4, strokeWidth: 3, fill: '#fff', stroke: '#3b82f6'}} activeDot={{r: 8, strokeWidth: 0, fill: '#2563eb'}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-2xl mb-8 text-gray-900">Heatmap: Peak Dining Hours</h3>
          <div className="h-80 select-none">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.peakHours}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 500}} dy={15} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}} 
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-2xl mb-6 text-gray-900">Customer Retention Funnel</h3>
          <div className="h-80 select-none">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip />
                <Funnel
                  dataKey="value"
                  data={data.funnelSteps}
                  isAnimationActive
                >
                  <LabelList position="right" fill="#1e293b" stroke="none" dataKey="name" fontWeight={700} />
                  {data.funnelSteps && data.funnelSteps.map((_entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#22c55e'} />
                  ))}
                </Funnel>
              </FunnelChart>
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
                   <span className="font-medium text-gray-500">{item.count} units sold historically</span>
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
