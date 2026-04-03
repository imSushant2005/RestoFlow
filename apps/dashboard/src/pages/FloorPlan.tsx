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
      <div className="w-48 h-10 bg-gray-200 rounded-lg animate-pulse mb-8"></div>
      <div className="flex gap-8 flex-wrap">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-gray-100 rounded-2xl w-[120px] h-[120px] animate-pulse border-4 border-gray-200"></div>
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
    <div className="flex w-full h-full bg-gray-50">
      {/* Zone Sidebar */}
      <div className="w-56 border-r border-gray-200 bg-white h-full flex flex-col shadow-sm">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10 bg-white">
          <h2 className="font-black text-gray-800 text-sm uppercase tracking-wider">Zones</h2>
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
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {zone.name}
              <span className="ml-2 text-xs font-bold text-gray-400">{zone.tables?.length || 0}</span>
            </div>
          ))}
          {zones.length === 0 && <div className="p-4 text-xs text-gray-400 text-center">No zones yet. Create one ↑</div>}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Summary Stats Bar */}
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4 shadow-sm">
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-xs font-black">Available</span>
            <span className="bg-green-100 text-green-800 font-black text-xs px-1.5 py-0.5 rounded-full">{available}</span>
          </div>
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-xs font-black">Occupied</span>
            <span className="bg-red-100 text-red-800 font-black text-xs px-1.5 py-0.5 rounded-full">{occupied}</span>
          </div>
          {reserved > 0 && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-700 px-3 py-1.5 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-orange-400"></div>
              <span className="text-xs font-black">Reserved</span>
              <span className="bg-orange-100 text-orange-800 font-black text-xs px-1.5 py-0.5 rounded-full">{reserved}</span>
            </div>
          )}
          {cleaning > 0 && (
            <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-gray-500"></div>
              <span className="text-xs font-black">Cleaning</span>
              <span className="bg-gray-200 text-gray-700 font-black text-xs px-1.5 py-0.5 rounded-full">{cleaning}</span>
            </div>
          )}
          <div className="ml-auto text-xs text-gray-400 font-semibold">
            {allTables.length} total tables
          </div>
        </div>

        {/* Floor Builder Canvas */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          {selectedZone ? (
            <FloorBuilder zone={selectedZone} tenantSlug={tenantSlug} />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center text-gray-400 gap-3">
              <div className="text-4xl">🍽️</div>
              <p className="font-semibold">Select or create a zone to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
