import { useState, useEffect } from 'react';
import axios from 'axios';
import { formatINR } from '../lib/currency';
import { Lock, ShieldAlert, Activity, Users, Database } from 'lucide-react';
import { getApiBaseUrl } from '../lib/network';

// Hardcoded for V3 MVP. In prod this comes from a secure admin boundary.
const ADMIN_SECRET = 'super_secret_admin_BHOJFLOW_v3';

export function Admin() {
  const [metrics, setMetrics] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAdminData = async () => {
    try {
      const headers = { 'x-admin-secret': ADMIN_SECRET };
      const url = `${getApiBaseUrl()}/admin`;
      
      const [mtx, tnts] = await Promise.all([
        axios.get(`${url}/metrics`, { headers }),
        axios.get(`${url}/tenants`, { headers })
      ]);

      setMetrics(mtx.data.data);
      setTenants(tnts.data.data);
    } catch (e) {
      console.error('Super Admin lookup failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const toggleSuspension = async (id: string, currentStatus: boolean) => {
    try {
      if (!confirm(`Are you sure you want to ${currentStatus ? 'SUSPEND' : 'ACTIVATE'} this tenant?`)) return;
      const headers = { 'x-admin-secret': ADMIN_SECRET };
      const url = `${getApiBaseUrl()}/admin`;
      
      await axios.patch(`${url}/tenants/${id}/suspend`, { isActive: !currentStatus }, { headers });
      fetchAdminData();
    } catch (e) {
      alert('Failed to suspend globally');
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Authenticating Root Interface...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans p-8">
      <header className="mb-10 border-b border-gray-800 pb-6 flex items-center gap-4">
        <div className="p-3 bg-red-500/10 text-red-500 rounded-xl">
          <ShieldAlert size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-white">BHOJFLOW <span className="text-red-500">ROOT</span></h1>
          <p className="text-gray-400 font-medium">Global Network Commander</p>
        </div>
      </header>

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
            <div className="flex justify-between items-start mb-4">
              <span className="text-gray-400 font-bold text-sm">ACTIVE VENDORS</span>
              <Users className="text-blue-500 opacity-50" />
            </div>
            <p className="text-4xl font-black">{metrics.activeTenants} <span className="text-lg text-gray-500 font-medium">/ {metrics.totalTenants}</span></p>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
            <div className="flex justify-between items-start mb-4">
              <span className="text-gray-400 font-bold text-sm">GLOBAL VOLUME</span>
              <Activity className="text-green-500 opacity-50" />
            </div>
            <p className="text-4xl font-black text-green-400">{formatINR(metrics.grossVolume)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
            <div className="flex justify-between items-start mb-4">
              <span className="text-gray-400 font-bold text-sm">TOTAL ORDERS</span>
              <Database className="text-purple-500 opacity-50" />
            </div>
            <p className="text-4xl font-black text-purple-400">{metrics.totalOrdersProcessed.toLocaleString()}</p>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
        <table className="w-full text-left">
          <thead className="bg-gray-950 border-b border-gray-800">
            <tr>
              <th className="p-5 font-bold text-gray-400 text-sm">VENDOR</th>
              <th className="p-5 font-bold text-gray-400 text-sm">PLAN</th>
              <th className="p-5 font-bold text-gray-400 text-sm">METRICS</th>
              <th className="p-5 font-bold text-gray-400 text-sm">CONTROLS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 focus:outline-none">
            {tenants.map(t => (
              <tr key={t.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="p-5">
                  <p className="font-bold text-lg">{t.businessName}</p>
                  <p className="text-sm text-gray-500">{t.slug} • {t.email}</p>
                </td>
                <td className="p-5">
                  <span className="px-3 py-1 bg-gray-800 rounded-full text-xs font-bold uppercase tracking-wider text-gray-300 border border-gray-700">{t.plan}</span>
                </td>
                <td className="p-5">
                  <p className="text-sm font-medium text-gray-300">{t._count.orders} Orders</p>
                  <p className="text-xs text-gray-500">{t._count.users} Staff</p>
                </td>
                <td className="p-5">
                  <button 
                    onClick={() => toggleSuspension(t.id, t.isActive)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all focus:outline-none ${t.isActive ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'}`}
                  >
                    <Lock size={14} /> {t.isActive ? 'SUSPEND' : 'ACTIVATE'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
