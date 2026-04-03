import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Plus, QrCode, Trash2, Power } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toPng } from 'html-to-image';
import { ErrorBoundary } from './ErrorBoundary';
import { io } from 'socket.io-client';
import { getCustomerAppUrl, getSocketUrl } from '../lib/network';

const TableCard = ({ table, setSelectedTable, onDelete, onToggleStatus, highlight }: any) => {
  const [showActions, setShowActions] = useState(false);
  const actionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showActions) return;
    const onClickOutside = (event: MouseEvent) => {
      if (actionRef.current && !actionRef.current.contains(event.target as Node)) {
        setShowActions(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showActions]);
  const occupiedList = table.occupiedSeats || [];
  const isAllSeatsTaken = occupiedList.length >= (table.seats || table.capacity || 4);
  const isGloballyOccupied = table.status === 'OCCUPIED';
  
  const isOccupied = isGloballyOccupied || isAllSeatsTaken || table.orders?.length > 0;
  const isReserved = table.status === 'RESERVED';
  const isCleaning = table.status === 'CLEANING';
  const isOrdering = table.status === 'ORDERING';
  const isActiveMeal = table.status === 'ACTIVE_MEAL';
  const isAwaitingBill = table.status === 'AWAITING_BILL';

  let statusColor = 'bg-white border-green-500 text-green-900 shadow-green-100';
  let badgeText = occupiedList.length > 0 ? 'Partially Full' : 'Available';
  let badgeColor = occupiedList.length > 0 ? 'bg-green-600 text-white' : 'bg-green-500 text-white';
  
  if (isReserved) {
    statusColor = 'bg-white border-purple-400 text-purple-900 shadow-purple-100';
    badgeText = 'Reserved';
    badgeColor = 'bg-purple-400 text-white';
  } else if (isOrdering) {
    statusColor = 'bg-blue-50 border-blue-500 text-blue-900 shadow-blue-100';
    badgeText = 'Ordering...';
    badgeColor = 'bg-blue-500 text-white animate-pulse';
  } else if (isActiveMeal) {
    statusColor = 'bg-orange-50 border-orange-500 text-orange-900 shadow-orange-100';
    badgeText = 'Active Meal';
    badgeColor = 'bg-orange-500 text-white';
  } else if (isAwaitingBill) {
    statusColor = 'bg-yellow-50 border-yellow-500 text-yellow-900 shadow-yellow-100';
    badgeText = 'Awaiting Bill';
    badgeColor = 'bg-yellow-500 text-white animate-pulse';
  } else if (isOccupied) {
    statusColor = 'bg-white border-red-500 text-red-900 shadow-red-100';
    badgeText = 'Occupied';
    badgeColor = 'bg-red-500 text-white animate-pulse';
  } else if (isCleaning) {
    statusColor = 'bg-gray-100 border-gray-400 text-gray-700 shadow-gray-200';
    badgeText = 'Cleaning';
    badgeColor = 'bg-gray-500 text-white';
  }

  const seatsTotal = table.seats || table.capacity || 4;
  const seatsArray = Array.from({ length: seatsTotal }, (_, i) => i + 1);
  const cols = Math.ceil(Math.sqrt(seatsTotal));

  return (
    <div
      className={`relative min-w-[120px] min-h-[120px] rounded-2xl flex flex-col items-center justify-center hover:scale-105 shadow-sm hover:shadow-lg group border-4 transition-all duration-300 ${statusColor} overflow-hidden ${highlight ? 'ring-4 ring-blue-300 animate-pulse' : ''}`}
      onClick={() => setShowActions((v) => !v)}
    >
      <div className="absolute inset-0 grid gap-1 p-1.5 pointer-events-none" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {seatsArray.map(seat => {
          const isSeatOccupied = occupiedList.includes(seat.toString()) || isGloballyOccupied;
          const seatColor = isSeatOccupied 
            ? 'bg-red-500 border-red-600 opacity-60' 
            : 'bg-green-400 border-green-500 opacity-30';
            
          return (
            <div key={seat} className={`border-2 rounded-lg flex items-center justify-center ${seatColor} transition-all`}>
              <span className="text-[11px] font-black text-white/90 mix-blend-overlay">{seat}</span>
            </div>
          );
        })}
      </div>

      <span className="font-bold text-3xl mb-1 z-10">{table.name}</span>
      <span className="text-xs font-medium opacity-80 z-10">{seatsTotal} Seats</span>
      <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 px-3 py-1 rounded-full z-10 backdrop-blur-sm ${badgeColor}`}>
        {badgeText}
      </span>
      
      {showActions && (
        <div ref={actionRef} className="absolute bottom-2 left-2 right-2 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-2 space-y-1">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleStatus(table); setShowActions(false); }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-50 text-xs font-bold text-gray-700 flex items-center gap-2"
          >
            <Power size={13} className={table.status === 'OCCUPIED' ? 'text-red-500' : 'text-green-500'} />
            {table.status === 'OCCUPIED' ? 'Mark Available' : 'Mark Occupied'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedTable(table); setShowActions(false); }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-50 text-xs font-bold text-blue-700 flex items-center gap-2"
          >
            <QrCode size={13} />
            View QR Code
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(table); setShowActions(false); }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-50 text-xs font-bold text-red-600 flex items-center gap-2"
          >
            <Trash2 size={13} />
            Delete Table
          </button>
        </div>
      )}
    </div>
  );
};

export function FloorBuilder({ zone, tenantSlug }: any) {
  const queryClient = useQueryClient();
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [selectedSeatQR, setSelectedSeatQR] = useState<number | 'FULL'>('FULL');
  const [highlightedTableId, setHighlightedTableId] = useState<string | null>(null);

  // Real-time socket listener for table status changes
  useEffect(() => {
    const token =
      localStorage.getItem('restoflow_token') ||
      localStorage.getItem('dineflow_token') ||
      localStorage.getItem('accessToken');
    const socket = io(getSocketUrl(), { auth: { token } });
    
    socket.on('table:status_change', (payload: any) => {
      if (payload?.tableId) {
        setHighlightedTableId(payload.tableId);
        setTimeout(() => setHighlightedTableId(null), 1800);
      }
      // Invalidate the cache to trigger an immediate refetch when any table status changes
      queryClient.invalidateQueries({ queryKey: ['zones'] });
    });

    return () => { socket.disconnect(); };
  }, [queryClient]);
  
  const createTableMutation = useMutation({
    mutationFn: ({ name, capacity }: any) => api.post('/venue/tables', { 
      name, 
      capacity,
      zoneId: zone.id, 
      positionX: 0, 
      positionY: 0 
    }),
    onSuccess: (res) => {
      queryClient.setQueryData(['zones'], (oldData: any) => {
        if (!oldData || !oldData.zones) return oldData;
        return {
          ...oldData,
          zones: oldData.zones.map((z: any) => {
            if (z.id === zone.id) {
              const exists = z.tables?.some((t: any) => t.id === res.data.id);
              return { ...z, tables: exists ? z.tables : [...(z.tables || []), res.data] };
            }
            return z;
          })
        };
      });
      queryClient.invalidateQueries({ queryKey: ['zones'] });
    },
    onError: (error: any) => {
      console.error('Failed to create table:', error);
      alert('Failed to add table: ' + (error.response?.data?.error || error.message));
    }
  });

  const deleteTableMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/venue/tables/${id}`),
    onMutate: (id) => ({ deletedId: id }),
    onSuccess: (_, __, context: any) => {
      queryClient.setQueryData(['zones'], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          zones: oldData.zones.map((z: any) => ({
            ...z,
            tables: z.tables.filter((t: any) => t.id !== context?.deletedId)
          }))
        };
      });
      setSelectedTable(null);
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: any) => api.patch(`/venue/tables/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] })
  });

  const handleDelete = (table: any) => {
    if (window.confirm(`Are you sure you want to delete Table ${table.name}?`)) {
      deleteTableMutation.mutate(table.id, { context: { deletedId: table.id } } as any);
    }
  };

  const handleToggleStatus = (table: any) => {
    const newStatus = table.status === 'AVAILABLE' ? 'OCCUPIED' : 'AVAILABLE';
    toggleStatusMutation.mutate({ id: table.id, status: newStatus });
  };

  const qrRef = useRef<HTMLDivElement>(null);

  const downloadQR = async () => {
    if (!qrRef.current || !selectedTable) return;
    const dataUrl = await toPng(qrRef.current, { quality: 1, backgroundColor: '#ffffff', skipFonts: true });
    const link = document.createElement('a');
    let filename = `table-${selectedTable.name}-qr.png`;
    if (selectedSeatQR !== 'FULL') {
      filename = `table-${selectedTable.name}-seat-${selectedSeatQR}-qr.png`;
    }
    link.download = filename;
    link.href = dataUrl;
    link.click();
  };

  // Compute summary stats
  const availableCount = zone.tables?.filter((t: any) => t.status === 'AVAILABLE' && !(t.orders?.length > 0)).length || 0;
  const occupiedCount = zone.tables?.filter((t: any) => t.status === 'OCCUPIED' || t.orders?.length > 0).length || 0;
  const reservedCount = zone.tables?.filter((t: any) => t.status === 'RESERVED').length || 0;

  const customerAppUrl = getCustomerAppUrl();

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
        <h2 className="text-xl font-bold">{zone.name} Details</h2>
        <div className="flex gap-3">
          <button 
            onClick={() => setSelectedTable('roaming')}
            className="flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-lg font-medium hover:bg-purple-200 transition-colors"
          >
            <QrCode size={18} /> Roaming QR
          </button>
          <button 
            onClick={() => {
              const name = prompt('Table Number/Name (e.g., "12"):');
              if (!name) return;
              const seatsRaw = prompt('Table Capacity (default 4):');
              const capacity = seatsRaw ? parseInt(seatsRaw, 10) : 4;
              createTableMutation.mutate({ name, capacity });
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} /> Add Table
          </button>
        </div>
      </div>
      
      {/* Summary Stats Bar */}
      <div className="flex gap-4">
        <div className="bg-white border-l-4 border-green-500 shadow-sm px-5 py-3 rounded-r-xl font-medium flex-1 flex flex-col">
          <span className="text-gray-500 text-xs">Available</span>
          <span className="text-2xl font-bold text-gray-900">{availableCount}</span>
        </div>
        <div className="bg-white border-l-4 border-red-500 shadow-sm px-5 py-3 rounded-r-xl font-medium flex-1 flex flex-col">
          <span className="text-gray-500 text-xs">Occupied</span>
          <span className="text-2xl font-bold text-gray-900">{occupiedCount}</span>
        </div>
        <div className="bg-white border-l-4 border-yellow-500 shadow-sm px-5 py-3 rounded-r-xl font-medium flex-1 flex flex-col">
          <span className="text-gray-500 text-xs">Reserved</span>
          <span className="text-2xl font-bold text-gray-900">{reservedCount}</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-wrap gap-3 text-xs font-semibold text-gray-600">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Available</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Occupied</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Ordering</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Active Meal</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Awaiting Bill</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-500" /> Cleaning</span>
      </div>

      {/* CSS Grid Floor Plan */}
      <div className="bg-slate-50 border border-gray-200 rounded-xl p-6 flex-1 shadow-inner overflow-y-auto">
        {zone.tables?.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <Plus size={48} className="mb-2 opacity-20" />
            <p>No tables configured for this zone yet.</p>
            <p className="text-sm">Click 'Add Table' to begin mapping your floor plan.</p>
          </div>
        ) : (
          <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-6">
            {zone.tables.map((table: any) => (
              <ErrorBoundary key={table.id}>
                <TableCard 
                  table={table} 
                  setSelectedTable={setSelectedTable} 
                  onDelete={handleDelete}
                  onToggleStatus={handleToggleStatus}
                  highlight={highlightedTableId === table.id}
                />
              </ErrorBoundary>
            ))}
          </div>
        )}
      </div>

      {/* QR Modal */}
      {selectedTable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl max-w-sm w-full shadow-2xl flex flex-col items-center text-center">
            <h3 className="text-2xl font-bold mb-2">
              {selectedTable === 'roaming' ? 'Roaming Vendor QR' : `Table ${selectedTable.name}`}
            </h3>
            <div className="flex flex-wrap gap-2 mb-4 justify-center select-none">
              <button 
                onClick={() => setSelectedSeatQR('FULL')} 
                className={`px-3 py-1.5 text-xs rounded-full font-bold transition-colors ${selectedSeatQR === 'FULL' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Full Table
              </button>
              {selectedTable !== 'roaming' && (selectedTable.seats || selectedTable.capacity) && Array.from({ length: selectedTable.seats || selectedTable.capacity }, (_, i) => i + 1).map(seat => (
                <button 
                  key={seat}
                  onClick={() => setSelectedSeatQR(seat)} 
                  className={`px-3 py-1.5 text-xs rounded-full font-bold transition-colors ${selectedSeatQR === seat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  Seat {seat}
                </button>
              ))}
            </div>
            
            <div className="p-4 bg-white rounded-xl shadow-inner border border-gray-100" ref={qrRef}>
              <QRCodeSVG 
                value={
                  selectedTable === 'roaming' 
                    ? `${customerAppUrl}/order/${tenantSlug}` 
                    : selectedSeatQR === 'FULL' 
                      ? `${customerAppUrl}/order/${tenantSlug}/${selectedTable.id}`
                      : `${customerAppUrl}/order/${tenantSlug}/${selectedTable.id}?seat=${selectedSeatQR}`
                } 
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="flex gap-3 mt-8 w-full">
              <button onClick={() => { setSelectedTable(null); setSelectedSeatQR('FULL'); }} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors">Close</button>
              <button onClick={downloadQR} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2">
                Download PNG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
