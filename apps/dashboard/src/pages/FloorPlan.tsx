import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { FloorBuilder } from '../components/FloorBuilder';
import { Plus, Lock, ChevronLeft, Menu, MapPin, X, Trash2 } from 'lucide-react';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import { useNavigate } from 'react-router-dom';
import { UpgradeModal } from '../components/UpgradeModal';
import { PromptModal } from '../components/PromptModal';
import { useLanguage } from '../contexts/LanguageContext';



// ─── Stats chip ───────────────────────────────────────────────────────────────
function StatChip({ color, label, count }: { color: string; label: string; count: number }) {
  const colorMap: Record<string, { bg: string; border: string; dot: string }> = {
    green: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', dot: 'bg-green-500' },
    red: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', dot: 'bg-red-500 animate-pulse' },
    orange: { bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.2)', dot: 'bg-orange-400' },
    gray: { bg: 'var(--surface-3)', border: 'var(--border)', dot: 'bg-gray-400' },
  };
  const c = colorMap[color] || colorMap.gray;
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] sm:text-xs font-black" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      <span className="hidden sm:inline" style={{ color: color === 'green' ? 'var(--success)' : color === 'red' ? 'var(--error)' : color === 'orange' ? '#f97316' : 'var(--text-2)' }}>{label}</span>
      <span className="font-black px-1 py-0.5 rounded-md text-[9px]" style={{ background: c.bg, color: color === 'green' ? 'var(--success)' : color === 'red' ? 'var(--error)' : color === 'orange' ? '#f97316' : 'var(--text-2)' }}>{count}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function FloorPlan() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [floorToDelete, setFloorToDelete] = useState<any>(null);
  const { features } = usePlanFeatures();
  const navigate = useNavigate();

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

  const deleteZoneMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/venue/zones/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      if (selectedZoneId === floorToDelete?.id) setSelectedZoneId(null);
      setFloorToDelete(null);
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error || 'Failed to delete floor');
      setFloorToDelete(null);
    }
  });

  // Auto-select first zone to bypass landing dashboard
  useEffect(() => {
    if (data?.zones?.length > 0 && !selectedZoneId && !isLoading) {
      setSelectedZoneId(data.zones[0].id);
    }
  }, [data?.zones, selectedZoneId, isLoading]);

  if (isLoading) return (
    <div className="p-6 sm:p-10 space-y-8">
      <div className="h-10 w-56 rounded-2xl animate-pulse" style={{ background: 'var(--surface-3)' }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-52 rounded-[2rem] animate-pulse" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }} />
        ))}
      </div>
    </div>
  );

  const zones = data?.zones || [];
  const tenantSlug = data?.tenantSlug || '';
  const selectedZone = zones.find((z: any) => z.id === selectedZoneId) ?? null;

  const allTables = zones.flatMap((z: any) => z.tables || []);
  const available = allTables.filter((t: any) => t.status === 'AVAILABLE' || !t.status).length;
  const occupied = allTables.filter((t: any) => t.status === 'OCCUPIED').length;
  const cleaning = allTables.filter((t: any) => t.status === 'CLEANING').length;
  const reserved = allTables.filter((t: any) => t.status === 'RESERVED').length;

  function handleZoneSelect(zoneId: string) {
    setSelectedZoneId(zoneId);
    setIsMobileSheetOpen(false);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  }

  function handleAddZone() {
    if (zones.length >= features.maxFloors) {
      setShowUpgradeModal(true);
      return;
    }
    setShowPromptModal(true);
  }

  // ── Zone list (reused in sidebar + bottom sheet) ──
  const ZoneList = () => (
    <>
      {zones.map((zone: any) => (
        <div
          key={zone.id}
          onClick={() => handleZoneSelect(zone.id)}
          className={`group flex items-center justify-between px-4 py-3.5 rounded-2xl cursor-pointer transition-all duration-200 border ${
            selectedZone?.id === zone.id
              ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-600/20'
              : 'bg-[var(--surface-raised)] border-[var(--border)] hover:border-blue-500/40 hover:bg-blue-500/5'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-xl transition-colors ${
              selectedZone?.id === zone.id ? 'bg-white/20 text-white' : 'bg-blue-500/10 text-blue-500'
            }`}>
              <MapPin size={15} />
            </div>
            <div>
              <span className={`font-bold text-sm tracking-tight block truncate ${
                selectedZone?.id === zone.id ? 'text-white' : ''
              }`} style={{ color: selectedZone?.id === zone.id ? undefined : 'var(--text-1)' }}>
                {zone.name}
              </span>
              <span className={`text-[10px] font-bold ${selectedZone?.id === zone.id ? 'text-blue-100' : ''}`}
                style={{ color: selectedZone?.id === zone.id ? undefined : 'var(--text-3)' }}>
                {zone.tables?.length || 0} tables
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className={`text-[10px] font-black h-6 w-6 flex items-center justify-center rounded-lg ${
              selectedZone?.id === zone.id ? 'bg-white/20 text-white' : 'bg-slate-500/10'
            }`} style={{ color: selectedZone?.id === zone.id ? undefined : 'var(--text-3)' }}>
              {zone.tables?.length || 0}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setFloorToDelete(zone); }}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-all flex-shrink-0 lg:flex hidden"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setFloorToDelete(zone); }}
              className="p-1.5 rounded-lg bg-red-500/10 text-red-500 flex-shrink-0 lg:hidden ml-1"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
      {zones.length === 0 && (
        <div className="py-10 text-center">
          <div className="text-3xl mb-3">🗺️</div>
          <p className="text-xs font-bold italic" style={{ color: 'var(--text-3)' }}>{t('floor.noZones')}</p>
        </div>
      )}
    </>
  );

  return (
    <div className="flex w-full min-h-full" style={{ background: 'var(--bg)' }}>

      {/* ══════════════════════════════════════════
          MOBILE: Floating Action Button + Popover
          ══════════════════════════════════════════ */}
      
      {/* Popover overlay (invisible, closes popover when clicked outside) */}
      {isMobileSheetOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden" onClick={() => setIsMobileSheetOpen(false)} />
      )}

      {/* Popover Menu */}
      <div 
        className={`fixed bottom-24 right-5 z-[90] lg:hidden flex flex-col items-end gap-2 transition-all duration-300 origin-bottom-right ${isMobileSheetOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-75 opacity-0 pointer-events-none'}`}
      >
        <div className="bg-[var(--surface)] rounded-3xl shadow-2xl border border-[var(--border)] overflow-hidden flex flex-col max-h-[60vh] w-[260px] shadow-blue-900/10">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-3)] flex justify-between items-center">
            <div className="flex flex-col">
              <span className="font-black text-sm" style={{ color: 'var(--text-1)' }}>{t('floor.zones')}</span>
              <span className="text-[10px] font-bold" style={{ color: 'var(--text-3)' }}>{zones.length} areas</span>
            </div>
          </div>
          <div className="overflow-y-auto custom-scrollbar p-2 space-y-1">
             <ZoneList />
          </div>
          <div className="p-2 border-t border-[var(--border)] bg-[var(--surface-3)]">
             <button
               onClick={() => { setIsMobileSheetOpen(false); handleAddZone(); }}
               className="w-full py-2.5 rounded-xl font-bold text-sm text-blue-600 bg-blue-600/10 hover:bg-blue-600/20 transition-colors flex items-center justify-center gap-2"
             >
               <Plus size={16} /> {t('floor.addZone')}
             </button>
          </div>
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setIsMobileSheetOpen(!isMobileSheetOpen)}
        className="fixed bottom-6 right-5 z-[100] lg:hidden w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-600/30 active:scale-95 transition-all outline-none"
      >
         {isMobileSheetOpen ? <X size={24} /> : <MapPin size={24} />}
      </button>

      {/* ══════════════════════════════════════════
          DESKTOP: Collapsible Left Sidebar
          ══════════════════════════════════════════ */}
      <div
        className={`hidden lg:flex flex-col shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex-shrink-0 ${
          isSidebarOpen ? 'w-64' : 'w-0 overflow-hidden'
        }`}
        style={{ background: 'var(--surface)', borderRight: isSidebarOpen ? '1px solid var(--border)' : 'none' }}
      >
        <div className={`flex h-full flex-col overflow-hidden transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
          {/* Sidebar Header */}
          <div className="p-4 flex justify-between items-center sticky top-0 z-10" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-sm uppercase tracking-wider" style={{ color: 'var(--text-1)' }}>{t('floor.zones')}</h2>
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-black text-blue-500">{zones.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddZone}
                className={`w-7 h-7 flex items-center justify-center text-white rounded-lg transition-colors ${
                  zones.length >= features.maxFloors ? 'bg-slate-500' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {zones.length >= features.maxFloors ? <Lock size={12} /> : <Plus size={15} />}
              </button>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-500/10 transition-colors"
                style={{ color: 'var(--text-3)' }}
              >
                <ChevronLeft size={18} />
              </button>
            </div>
          </div>

          {/* Zone list */}
          <div className="flex-1 overflow-y-auto py-3 px-3 space-y-2 custom-scrollbar">
            <ZoneList />
          </div>

          {/* Collapse button */}
          <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="flex w-full items-center justify-center gap-2 py-2 rounded-xl border text-[11px] font-black uppercase tracking-widest hover:bg-gray-500/5 transition-all"
              style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
            >
              <ChevronLeft size={13} /> {t('floor.collapseSidebar')}
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          MAIN CONTENT
          ══════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Top Stats Bar ── */}
        <div
          className="px-3 sm:px-5 py-2.5 flex items-center gap-2 sm:gap-3 overflow-x-auto custom-scrollbar sticky top-0 z-30 flex-nowrap"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        >
          {/* Desktop: show sidebar toggle */}
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="hidden lg:flex p-2 rounded-xl border hover:bg-blue-500/5 transition-all flex-shrink-0"
              style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
            >
              <Menu size={16} />
            </button>
          )}
          {/* Mobile: Zone name indicator (passive) */}
          <div className="lg:hidden flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface-3)] text-[var(--text-1)] text-xs font-black flex-shrink-0 border border-[var(--border)]">
            <MapPin size={13} className="text-blue-500" />
            {selectedZone ? selectedZone.name : t('floor.zones')}
          </div>

          {/* Stats chips */}
          <div className="flex items-center gap-2 flex-nowrap">
            <StatChip color="green" label={t('floor.available')} count={available} />
            <StatChip color="red" label={t('floor.occupied')} count={occupied} />
            {reserved > 0 && <StatChip color="orange" label={t('floor.reserved')} count={reserved} />}
            {cleaning > 0 && <StatChip color="gray" label={t('floor.cleaning')} count={cleaning} />}
          </div>

          <div className="ml-auto text-[10px] font-bold flex-shrink-0" style={{ color: 'var(--text-3)' }}>
            {allTables.length} {t('floor.totalTables')}
          </div>
        </div>

        {/* ── Content: Floor builder OR Empty State ── */}
        {selectedZoneId && selectedZone ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-hidden">
              <FloorBuilder zone={selectedZone} tenantSlug={tenantSlug} />
            </div>
          </div>
        ) : zones.length === 0 && !isLoading ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar flex items-center justify-center flex-col text-center">
             <div className="h-16 w-16 mb-4 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
               <MapPin size={24} />
             </div>
             <h2 className="text-xl font-black text-[var(--text-1)] mb-1">No Floors Found</h2>
             <p className="text-sm font-semibold text-[var(--text-3)] mb-6">Create your first floor to start adding tables.</p>
             <button
               onClick={handleAddZone}
               className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
             >
               <Plus size={16} />
               {t('floor.addZone')}
             </button>
          </div>
        ) : null}
      </div>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={() => navigate('/app/subscription')}
        title="Upgrade Your Capacity"
        description="Your current plan has reached its room/floor limit. Upgrade to unlock multi-zone management."
        tierName={features.name}
        limitText={`${zones.length} / ${features.maxFloors} floors used`}
      />

      <PromptModal
        isOpen={showPromptModal}
        onClose={() => setShowPromptModal(false)}
        title="Create New Floor"
        label="Floor Name"
        placeholder="e.g. Ground Floor, Rooftop"
        onSubmit={(name) => createZoneMutation.mutate(name)}
      />

      {/* Delete Confirmation Modal */}
      {floorToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] text-[var(--text-1)] rounded-3xl p-6 sm:p-8 max-w-sm w-full mx-auto shadow-2xl animate-in zoom-in-95 duration-200" style={{ border: '1px solid var(--border)' }}>
            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
              <Trash2 className="text-red-500" size={32} />
            </div>
            <h2 className="text-center text-xl font-black mb-2">Delete Floor?</h2>
            <p className="text-center text-sm font-semibold mb-8 text-[var(--text-3)] leading-relaxed">
              Are you sure you want to delete <span className="text-[var(--text-1)]">"{floorToDelete.name}"</span>? This will also remove any tables within it and cannot be undone.
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setFloorToDelete(null)}
                disabled={deleteZoneMutation.isPending}
                className="flex-1 py-3 px-4 rounded-xl font-bold bg-[var(--surface-3)] text-[var(--text-2)] hover:bg-[var(--surface-raised)] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteZoneMutation.mutate(floorToDelete.id)}
                disabled={deleteZoneMutation.isPending}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-red-600 hover:bg-red-500 transition-all shadow-lg shadow-red-500/20 active:scale-95 disabled:opacity-50"
              >
                {deleteZoneMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
