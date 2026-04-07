import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { FloorBuilder } from '../components/FloorBuilder';
import { Plus } from 'lucide-react';

export function FloorPlan() {
  const queryClient = useQueryClient();
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['zones'],
    queryFn: async () => {
      const res = await api.get('/venue/zones');
      return res.data;
    }
  });

  const createZoneMutation = useMutation({
    mutationFn: (name: string) => api.post('/venue/zones', { name, width: 800, height: 600 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] }),
    onError: (err: any) => alert(err?.response?.data?.error || 'Failed to create zone'),
  });

  if (isLoading) return (
    <div className="p-8">
      <div className="w-48 h-10 rounded-lg animate-pulse mb-8" style={{ background: 'var(--surface-3)' }}></div>
      <div className="flex gap-8 flex-wrap">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="rounded-2xl w-[120px] h-[120px] animate-pulse border-4" style={{ background: 'var(--surface-3)', borderColor: 'var(--border)' }}></div>
        ))}
      </div>
    </div>
  );

  const zones = data?.zones || [];
  const tenantSlug = data?.tenantSlug || '';
  const selectedZone = zones.length > 0 ? (zones.find((z: any) => z.id === selectedZoneId) || zones[0]) : null;

  // Compute live table stats across all zones
  const allTables = zones.flatMap((z: any) => z.tables || []);
  const available = allTables.filter((t: any) => t.status === 'AVAILABLE' || (!t.status)).length;
  const occupied = allTables.filter((t: any) => t.status === 'OCCUPIED').length;
  const cleaning = allTables.filter((t: any) => t.status === 'CLEANING').length;
  const reserved = allTables.filter((t: any) => t.status === 'RESERVED').length;

  return (
    <div className="flex w-full h-full" style={{ background: 'var(--bg)' }}>
      {/* Zone Sidebar */}
      <div className="w-56 h-full flex flex-col shadow-sm" style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
        <div className="p-4 flex justify-between items-center sticky top-0 z-10" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-black text-sm uppercase tracking-wider" style={{ color: 'var(--text-1)' }}>Zones</h2>
          <button
            onClick={() => {
              const name = prompt('Zone name:');
              if (name) createZoneMutation.mutate(name);
            }}
            className="w-7 h-7 flex items-center justify-center bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {zones.map((zone: any) => (
            <div
              key={zone.id}
              onClick={() => setSelectedZoneId(zone.id)}
              className={`mx-2 mb-1 px-3 py-2.5 rounded-xl cursor-pointer text-sm font-semibold transition-all ${
                selectedZone?.id === zone.id
                  ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-sm'
                  : 'hover:bg-gray-500/5'
              }`}
              style={selectedZone?.id === zone.id ? {} : { color: 'var(--text-3)' }}
            >
              {zone.name}
              <span className="ml-2 text-xs font-bold" style={{ color: 'var(--text-3)' }}>{zone.tables?.length || 0}</span>
            </div>
          ))}
          {zones.length === 0 && <div className="p-4 text-xs text-center" style={{ color: 'var(--text-3)' }}>No zones yet. Create one ↑</div>}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Summary Stats Bar */}
        <div className="px-6 py-3 flex items-center gap-4 shadow-sm" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: 'var(--success)' }}>
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-xs font-black">Available</span>
            <span className="font-black text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(16, 185, 129, 0.2)' }}>{available}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--error)' }}>
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-xs font-black">Occupied</span>
            <span className="font-black text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239, 68, 68, 0.2)' }}>{occupied}</span>
          </div>
          {reserved > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.2)', color: '#f97316' }}>
              <div className="w-2 h-2 rounded-full bg-orange-400"></div>
              <span className="text-xs font-black">Reserved</span>
              <span className="font-black text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(249, 115, 22, 0.2)' }}>{reserved}</span>
            </div>
          )}
          {cleaning > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              <div className="w-2 h-2 rounded-full bg-gray-500"></div>
              <span className="text-xs font-black">Cleaning</span>
              <span className="font-black text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--border)' }}>{cleaning}</span>
            </div>
          )}
          <div className="ml-auto text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
            {allTables.length} total tables
          </div>
        </div>

        {/* Floor Builder Canvas */}
        <div className="flex-1 overflow-auto p-6" style={{ background: 'var(--bg)' }}>
          {selectedZone ? (
            <FloorBuilder zone={selectedZone} tenantSlug={tenantSlug} />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center gap-3" style={{ color: 'var(--text-3)' }}>
              <div className="text-4xl">🍽️</div>
              <p className="font-semibold">Select or create a zone to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
