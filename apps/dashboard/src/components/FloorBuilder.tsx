import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Plus, QrCode, Trash2, Power, Lock, CheckCircle } from 'lucide-react';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import { useNavigate } from 'react-router-dom';
import { UpgradeModal } from './UpgradeModal';
import { PromptModal } from './PromptModal';
import { ConfirmModal } from './ConfirmModal';
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

  let statusColor = 'bg-[var(--surface-raised)] border-green-500/50 text-green-700 shadow-lg';
  let badgeText = occupiedList.length > 0 ? 'Partially Full' : 'Available';
  let badgeColor = occupiedList.length > 0 ? 'bg-gradient-to-r from-green-600 to-green-500 text-white' : 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-white';
  
  if (isReserved) {
    statusColor = 'bg-[var(--surface-raised)] border-purple-500/50 text-purple-700 shadow-lg';
    badgeText = 'Reserved';
    badgeColor = 'bg-gradient-to-r from-purple-500 to-pink-500 text-white';
  } else if (isOrdering) {
    statusColor = 'bg-[var(--surface-raised)] border-blue-500/50 text-blue-700 shadow-lg';
    badgeText = 'Ordering...';
    badgeColor = 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white animate-pulse';
  } else if (isActiveMeal) {
    statusColor = 'bg-[var(--surface-raised)] border-orange-500/50 text-orange-700 shadow-lg';
    badgeText = 'Active Meal';
    badgeColor = 'bg-gradient-to-r from-orange-500 to-amber-500 text-white';
  } else if (isAwaitingBill) {
    statusColor = 'bg-[var(--surface-raised)] border-yellow-500/50 text-yellow-700 shadow-lg';
    badgeText = 'Awaiting Bill';
    badgeColor = 'bg-gradient-to-r from-yellow-500 to-amber-400 text-white animate-pulse';
  } else if (isOccupied) {
    statusColor = 'bg-[var(--surface-raised)] border-red-500/50 text-red-700 shadow-lg';
    badgeText = 'Occupied';
    badgeColor = 'bg-gradient-to-r from-red-500 to-rose-500 text-white animate-pulse';
  } else if (isCleaning) {
    statusColor = 'bg-[var(--surface-raised)] border-gray-500/50 text-gray-400 shadow-lg opacity-80';
    badgeText = 'Cleaning';
    badgeColor = 'bg-gradient-to-r from-gray-500 to-slate-400 text-white';
  }

  const seatsTotal = table.seats || table.capacity || 4;
  const seatsArray = Array.from({ length: seatsTotal }, (_, i) => i + 1);
  const cols = Math.ceil(Math.sqrt(seatsTotal));

  return (
    <div
      className={`relative min-w-[120px] min-h-[120px] rounded-2xl flex flex-col items-center justify-center hover:scale-105 group border-2 backdrop-blur-xl transition-all duration-300 ${statusColor} overflow-hidden ${highlight ? 'ring-4 ring-blue-500/50 animate-pulse' : ''}`}
      onClick={() => setShowActions((v) => !v)}
    >
      <div className="absolute inset-0 grid gap-1 p-1.5 pointer-events-none" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {seatsArray.map(seat => {
          const isSeatOccupied = occupiedList.includes(seat.toString()) || isGloballyOccupied;
          const seatColor = isSeatOccupied 
            ? 'bg-red-500/30 border-red-500/40' 
            : 'bg-emerald-500/20 border-emerald-500/30';
            
          return (
            <div key={seat} className={`border rounded-lg flex items-center justify-center ${seatColor} transition-all`}>
              <span className="text-[11px] font-black text-[var(--text-1)] mix-blend-overlay opacity-60">{seat}</span>
            </div>
          );
        })}
      </div>

      <span className="font-bold text-3xl mb-1 z-10" style={{ color: 'var(--text-1)' }}>{table.name}</span>
      <span className="text-xs font-medium opacity-80 z-10" style={{ color: 'var(--text-2)' }}>{seatsTotal} Seats</span>
      <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 px-3 py-1 rounded-full z-10 shadow-lg ${badgeColor}`}>
        {badgeText}
      </span>
      
      {showActions && (
    <div ref={actionRef} className="absolute bottom-2 left-2 right-2 z-20 border rounded-xl shadow-2xl p-2 space-y-1 backdrop-blur-3xl" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}>
          {table.currentSessionId && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleStatus(table, 'CLEAR'); setShowActions(false); }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-emerald-500/10 text-xs font-bold text-emerald-600 flex items-center gap-2 transition-colors"
            >
              <CheckCircle size={13} />
              Clear Session
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleStatus(table); setShowActions(false); }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-500/10 text-xs font-bold flex items-center gap-2 transition-colors"
            style={{ color: 'var(--text-1)' }}
          >
            <Power size={13} className={table.status === 'OCCUPIED' ? 'text-red-500' : 'text-emerald-500'} />
            {table.status === 'OCCUPIED' ? 'Mark Available' : 'Mark Occupied'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedTable(table); setShowActions(false); }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-500/10 text-xs font-bold text-blue-500 flex items-center gap-2 transition-colors"
          >
            <QrCode size={13} />
            View QR Code
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(table); setShowActions(false); }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 text-xs font-bold text-red-500 flex items-center gap-2 transition-colors"
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
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showTablePrompt, setShowTablePrompt] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<any>(null);
  const [showClearConfirm, setShowClearConfirm] = useState<any>(null);
  const { features } = usePlanFeatures();
  const navigate = useNavigate();

  const currentTablesCount = zone.tables?.length || 0;
  const isLimitReached = currentTablesCount >= features.tables;

  // Real-time socket listener for table status changes
  useEffect(() => {
    const token =
      localStorage.getItem('restoflow_token') ||
      localStorage.getItem('dineflow_token') ||
      localStorage.getItem('accessToken');
    const socket = io(getSocketUrl(), {
      auth: { token, client: 'dashboard-floor' },
      transports: ['websocket'],
      rememberUpgrade: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 10000,
    });

    const handleStatusChange = (payload: any) => {
      if (payload?.tableId) {
        setHighlightedTableId(payload.tableId);
        setTimeout(() => setHighlightedTableId(null), 1800);
      }
      // Invalidate the cache to trigger an immediate refetch when any table status changes
      queryClient.invalidateQueries({ queryKey: ['zones'] });
    };

    const handleConnectError = () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
    };

    socket.on('table:status_change', handleStatusChange);
    socket.on('connect_error', handleConnectError);

    return () => {
      socket.off('table:status_change', handleStatusChange);
      socket.off('connect_error', handleConnectError);
      socket.disconnect();
    };
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
      // Fallback for unexpected errors, though mostly handled by plan limits
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
    setShowDeleteConfirm(table);
  };

  const handleToggleStatus = async (table: any, mode?: 'TOGGLE' | 'CLEAR') => {
    if (mode === 'CLEAR') {
      if (!table.currentSessionId) return;
      setShowClearConfirm(table);
      return;
    }

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
      <div className="flex justify-between items-center p-4 rounded-xl shadow-sm border border-transparent backdrop-blur-md" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>{zone.name} Details</h2>
        <div className="flex gap-3">
          <button 
            onClick={() => setSelectedTable('roaming')}
            className="flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-lg font-medium hover:bg-purple-200 transition-colors"
          >
            <QrCode size={18} /> Roaming QR
          </button>
          <button 
            onClick={() => {
              if (isLimitReached) {
                setShowUpgradeModal(true);
                return;
              }
              setShowTablePrompt(true);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${isLimitReached ? 'bg-slate-700 text-slate-300' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            {isLimitReached ? <Lock size={18} /> : <Plus size={18} />} 
            Add Table
          </button>
        </div>
      </div>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={() => navigate('/app/subscription')}
        title="Table Limit Reached"
        description={`Your ${features.name} plan allows up to ${features.tables} tables. Upgrade to add more capacity to your restaurant.`}
        tierName={features.name}
        limitText={`${features.tables} Table Limit`}
      />

      <PromptModal
        isOpen={showTablePrompt}
        onClose={() => setShowTablePrompt(false)}
        onSubmit={(name) => createTableMutation.mutate({ name, capacity: 4 })}
        title="Quick Table Add"
        label="Table Number/Name"
        placeholder="e.g. 101, T5, or Garden-1"
      />

      <ConfirmModal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={() => deleteTableMutation.mutate(showDeleteConfirm.id, { context: { deletedId: showDeleteConfirm.id } } as any)}
        variant="danger"
        title="Delete Table"
        description={`Are you sure you want to delete Table ${showDeleteConfirm?.name}? This action cannot be undone.`}
        confirmLabel="Delete"
      />

      <ConfirmModal
        isOpen={!!showClearConfirm}
        onClose={() => setShowClearConfirm(null)}
        onConfirm={async () => {
          try {
            await api.post(`/sessions/${showClearConfirm.currentSessionId}/complete`, { 
              paymentMethod: 'cash', 
              shouldClose: true 
            });
            queryClient.invalidateQueries({ queryKey: ['zones'] });
          } catch (err) {
            console.error('Failed to clear session', err);
          }
        }}
        title="Clear Session"
        description={`This will force close the current active session for Table ${showClearConfirm?.name}. All unpaid orders will be marked as paid via Cash.`}
        confirmLabel="Clear & Archive"
      />
      
      {/* Summary Stats Bar */}
      <div className="flex gap-4">
        <div className="border-l-4 border-green-500 shadow-sm px-5 py-3 rounded-r-xl font-medium flex-1 flex flex-col" style={{ background: 'var(--surface-raised)' }}>
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>Available</span>
          <span className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>{availableCount}</span>
        </div>
        <div className="border-l-4 border-red-500 shadow-sm px-5 py-3 rounded-r-xl font-medium flex-1 flex flex-col" style={{ background: 'var(--surface-raised)' }}>
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>Occupied</span>
          <span className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>{occupiedCount}</span>
        </div>
        <div className="border-l-4 border-yellow-500 shadow-sm px-5 py-3 rounded-r-xl font-medium flex-1 flex flex-col" style={{ background: 'var(--surface-raised)' }}>
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>Reserved</span>
          <span className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>{reservedCount}</span>
        </div>
      </div>

      <div className="rounded-xl p-3 flex flex-wrap gap-3 text-xs font-semibold shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', borderWidth: 1, color: 'var(--text-2)' }}>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Available</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Occupied</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Ordering</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Active Meal</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Awaiting Bill</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-500" /> Cleaning</span>
      </div>

      {/* CSS Grid Floor Plan */}
      <div className="rounded-xl p-6 flex-1 overflow-y-auto" style={{ background: 'var(--shell-bg)', border: '1px solid var(--border)', boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.02)' }}>
        {zone.tables?.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center" style={{ color: 'var(--text-3)' }}>
            <Plus size={48} className="mb-2 opacity-20" />
            <p className="font-semibold text-lg">No tables configured for this zone yet.</p>
            <p className="text-sm mt-1">Click 'Add Table' to begin mapping your floor plan.</p>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="p-8 rounded-3xl max-w-sm w-full shadow-[0_24px_64px_rgba(0,0,0,0.2)] flex flex-col items-center text-center transform transition-all border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h3 className="text-2xl font-black mb-3 tracking-tight" style={{ color: 'var(--text-1)' }}>
              {selectedTable === 'roaming' ? 'Roaming Vendor QR' : `Table ${selectedTable.name}`}
            </h3>
            <div className="flex flex-wrap gap-2 mb-6 justify-center select-none w-full">
              <button 
                onClick={() => setSelectedSeatQR('FULL')} 
                className={`px-4 py-2 text-xs rounded-full font-bold transition-all shadow-sm ${selectedSeatQR === 'FULL' ? 'bg-blue-600 text-white ring-2 ring-blue-600/30' : 'bg-[var(--surface-3)] hover:bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)]'}`}
              >
                Full Table
              </button>
              {selectedTable !== 'roaming' && (selectedTable.seats || selectedTable.capacity) && Array.from({ length: selectedTable.seats || selectedTable.capacity }, (_, i) => i + 1).map(seat => (
                <button 
                  key={seat}
                  onClick={() => setSelectedSeatQR(seat)} 
                  className={`px-4 py-2 text-xs rounded-full font-bold transition-all shadow-sm ${selectedSeatQR === seat ? 'bg-blue-600 text-white ring-2 ring-blue-600/30' : 'bg-[var(--surface-3)] hover:bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)]'}`}
                >
                  Seat {seat}
                </button>
              ))}
            </div>
            
            <div className="p-5 rounded-2xl shadow-inner border w-full flex justify-center bg-white" style={{ borderColor: 'var(--border)' }} ref={qrRef}>
              <QRCodeSVG 
                value={
                  selectedTable === 'roaming' 
                    ? `${customerAppUrl}/order/${tenantSlug}` 
                    : selectedSeatQR === 'FULL' 
                      ? `${customerAppUrl}/order/${tenantSlug}/${selectedTable.id}?qr=${encodeURIComponent(selectedTable.qrSecret)}`
                      : `${customerAppUrl}/order/${tenantSlug}/${selectedTable.id}?seat=${selectedSeatQR}&qr=${encodeURIComponent(selectedTable.qrSecret)}`
                } 
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="flex gap-3 mt-8 w-full">
              <button onClick={() => { setSelectedTable(null); setSelectedSeatQR('FULL'); }} className="flex-1 py-3 text-sm font-bold rounded-xl transition-colors border" style={{ background: 'var(--surface-3)', color: 'var(--text-2)', borderColor: 'var(--border)' }}>Close</button>
              <button onClick={downloadQR} className="flex-1 py-3 text-sm bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25">
                Download PNG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
