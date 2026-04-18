import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getCustomerAppUrl } from '../lib/network';
import { CategorySidebar } from '../components/CategorySidebar';
import { ItemList } from '../components/ItemList';
import { AiMenuImporter } from '../components/AiMenuImporter';
import { ExternalLink, Layers, Plus, Sparkles, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export function MenuBuilder() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showAiImporter, setShowAiImporter] = useState(false);
  const [isMobileCategorySheetOpen, setIsMobileCategorySheetOpen] = useState(false);

  const { data: categories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/menus/categories');
      return res.data;
    }
  });

  // Auto-select first category to bypass landing dashboard
  useEffect(() => {
    if (categories.length > 0 && !selectedCategoryId && !isLoadingCategories) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId, isLoadingCategories]);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await api.get('/settings/business');
      return res.data;
    }
  });

  const tenantSlug = settings?.slug || '';

  function handleAddCategory() {
    const name = prompt('Category name:');
    if (name) {
      api.post('/menus/categories', { name, description: '' })
        .then(() => queryClient.invalidateQueries({ queryKey: ['categories'] }));
    }
  }

  // Shared category list used in sidebar + mobile sheet
  const CategoryListItems = () => (
    <>
      {(categories as any[]).map((c: any, idx: number) => (
        <button
          key={c.id}
          onClick={() => {
            setSelectedCategoryId(c.id);
            setIsMobileCategorySheetOpen(false);
          }}
          className={`group w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all duration-200 ${
            selectedCategoryId === c.id
              ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-600/20'
              : 'border-[var(--border)] bg-[var(--surface-raised)] hover:border-blue-500/40 hover:bg-blue-500/5'
          }`}
          style={{
            animationDelay: `${idx * 40}ms`,
          }}
        >
          <div className={`p-2 rounded-xl transition-colors flex-shrink-0 ${
            selectedCategoryId === c.id ? 'bg-white/20 text-white' : 'bg-blue-500/10 text-blue-500'
          }`}>
            <Layers size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-sm truncate ${selectedCategoryId === c.id ? 'text-white' : ''}`}
               style={{ color: selectedCategoryId === c.id ? undefined : 'var(--text-1)' }}>
              {c.name}
            </p>
          </div>
        </button>
      ))}
    </>
  );

  return (
    <div className="flex flex-col w-full h-full" style={{ background: 'var(--bg)' }}>


      {/* ══════════════════════════════════════════
          MOBILE: Floating Action Button + Popover
          ══════════════════════════════════════════ */}
      
      {/* Popover overlay (invisible, closes popover when clicked outside) */}
      {isMobileCategorySheetOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden" onClick={() => setIsMobileCategorySheetOpen(false)} />
      )}

      {/* Popover Menu */}
      <div 
        className={`fixed bottom-24 right-5 z-[90] lg:hidden flex flex-col items-end gap-2 transition-all duration-300 origin-bottom-right ${isMobileCategorySheetOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-75 opacity-0 pointer-events-none'}`}
      >
        <div className="bg-[var(--surface)] rounded-3xl shadow-2xl border border-[var(--border)] overflow-hidden flex flex-col max-h-[60vh] w-[260px] shadow-blue-900/10">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-3)] flex justify-between items-center">
            <div className="flex flex-col">
              <span className="font-black text-sm" style={{ color: 'var(--text-1)' }}>{t('menu.categories')}</span>
              <span className="text-[10px] font-bold" style={{ color: 'var(--text-3)' }}>{categories.length} sections</span>
            </div>
          </div>
          <div className="overflow-y-auto custom-scrollbar p-2 space-y-1">
             <CategoryListItems />
          </div>
          <div className="p-2 border-t border-[var(--border)] bg-[var(--surface-3)]">
             <button
               onClick={() => { setIsMobileCategorySheetOpen(false); handleAddCategory(); }}
               className="w-full py-2.5 rounded-xl font-bold text-sm text-blue-600 bg-blue-600/10 hover:bg-blue-600/20 transition-colors flex items-center justify-center gap-2"
             >
               <Plus size={16} /> {t('menu.createCategory')}
             </button>
          </div>
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setIsMobileCategorySheetOpen(!isMobileCategorySheetOpen)}
        className="fixed bottom-6 right-5 z-[100] lg:hidden w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-600/30 active:scale-95 transition-all outline-none"
      >
         {isMobileCategorySheetOpen ? <X size={24} /> : <Layers size={24} />}
      </button>

      {/* ── Top Action Bar ── */}
      <div
        className="px-3 sm:px-6 py-3 flex items-center justify-between gap-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Spacer if needed */}          {tenantSlug && (
            <a
              href={`${getCustomerAppUrl()}/order/${tenantSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold tracking-widest uppercase text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full hover:bg-blue-500/20 transition-colors"
            >
              <ExternalLink size={11} />
              {t('menu.livePreview')}
            </a>
          )}
          <p className="hidden md:block text-xs" style={{ color: 'var(--text-3)' }}>{t('menu.dragHint')}</p>
        </div>

        <button
          onClick={() => setShowAiImporter(true)}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-[0_0_15px_rgba(147,51,234,0.3)] hover:shadow-[0_0_20px_rgba(147,51,234,0.5)] border border-purple-400/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex-shrink-0"
        >
          <Sparkles size={14} className="text-purple-200" />
          <span className="hidden sm:inline">{t('menu.aiImport')}</span>
          <span className="sm:hidden">AI</span>
        </button>
      </div>

      {/* ── Body: Sidebar + Content ── */}
      <div className="flex flex-1 min-h-0">

        {/* Desktop Sidebar */}
        <div
          className="hidden lg:flex flex-col w-64 flex-shrink-0 h-full overflow-hidden"
          style={{ borderRight: '1px solid var(--border)', background: 'var(--surface)' }}
        >
          <CategorySidebar
            categories={categories}
            selectedId={selectedCategoryId}
            onSelect={setSelectedCategoryId}
            isLoading={isLoadingCategories}
          />
        </div>

        {/* Content Area */}
        <div id="item-list-container" className="flex-1 min-w-0 h-full overflow-y-auto custom-scrollbar">
          {selectedCategoryId ? (
            <div className="p-4 sm:p-6">
              <ItemList categoryId={selectedCategoryId} />
            </div>
          ) : (categories as any[]).length === 0 && !isLoadingCategories ? (
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar flex items-center justify-center flex-col text-center">
               <div className="h-16 w-16 mb-4 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                 <Layers size={24} />
               </div>
               <h2 className="text-xl font-black text-[var(--text-1)] mb-1">No Categories Found</h2>
               <p className="text-sm font-semibold text-[var(--text-3)] mb-6">Your menu is empty. Create a category to start organizing your items.</p>
               <button
                 onClick={handleAddCategory}
                 className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
               >
                 <Plus size={16} />
                 {t('menu.createCategory')}
               </button>
            </div>
          ) : null}
        </div>
      </div>

      {showAiImporter && (
        <AiMenuImporter onClose={() => setShowAiImporter(false)} />
      )}
    </div>
  );
}
