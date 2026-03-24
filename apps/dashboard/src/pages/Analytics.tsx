import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Cell, FunnelChart, Funnel, LabelList } from 'recharts';
import { Download, TrendingUp } from 'lucide-react';
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
