import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ExternalLink, Layers, Menu, Plus, Sparkles, X } from 'lucide-react';
import { api } from '../lib/api';
import { getCustomerAppUrl } from '../lib/network';
import { CategorySidebar } from '../components/CategorySidebar';
import { ItemList } from '../components/ItemList';
import { AiMenuImporter } from '../components/AiMenuImporter';
import { PromptModal } from '../components/PromptModal';
import { useLanguage } from '../contexts/LanguageContext';

export function MenuBuilder() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showAiImporter, setShowAiImporter] = useState(false);
  const [showCreateCategoryPrompt, setShowCreateCategoryPrompt] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileCategorySheetOpen, setIsMobileCategorySheetOpen] = useState(false);

  const { data: categories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/menus/categories');
      return res.data;
    },
  });

  useEffect(() => {
    if (categories.length > 0 && !selectedCategoryId && !isLoadingCategories) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId, isLoadingCategories]);

  const { data: settings } = useQuery({
    queryKey: ['settings-business'],
    queryFn: async () => {
      const res = await api.get('/settings/business');
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await api.post('/menus/categories', { name, description: '' });
      return res.data;
    },
    onSuccess: (createdCategory: any) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (createdCategory?.id) {
        setSelectedCategoryId(createdCategory.id);
      }
    },
  });

  const tenantSlug = settings?.slug || '';
  const selectedCategory = (categories as any[]).find((category: any) => category.id === selectedCategoryId) || null;

  function handleCategorySelect(categoryId: string) {
    setSelectedCategoryId(categoryId);
    setIsMobileCategorySheetOpen(false);
  }

  function handleAddCategory() {
    setShowCreateCategoryPrompt(true);
  }

  const CategoryListItems = () => (
    <>
      {(categories as any[]).map((category: any) => (
        <button
          key={category.id}
          onClick={() => handleCategorySelect(category.id)}
          className={`group flex items-center justify-between px-4 py-3.5 rounded-2xl cursor-pointer transition-all duration-200 border w-full ${
            selectedCategoryId === category.id
              ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-600/20'
              : 'bg-[var(--surface-raised)] border-[var(--border)] hover:border-blue-500/40 hover:bg-blue-500/5'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`p-2 rounded-xl transition-colors ${
                selectedCategoryId === category.id ? 'bg-white/20 text-white' : 'bg-blue-500/10 text-blue-500'
              }`}
            >
              <Layers size={15} />
            </div>
            <div className="min-w-0">
              <span
                className={`font-bold text-sm tracking-tight block truncate ${selectedCategoryId === category.id ? 'text-white' : ''}`}
                style={{ color: selectedCategoryId === category.id ? undefined : 'var(--text-1)' }}
              >
                {category.name}
              </span>
            </div>
          </div>
          <div
            className={`text-[10px] font-black h-6 min-w-[24px] px-2 flex items-center justify-center rounded-lg ${
              selectedCategoryId === category.id ? 'bg-white/20 text-white' : 'bg-slate-500/10'
            }`}
            style={{ color: selectedCategoryId === category.id ? undefined : 'var(--text-3)' }}
          >
            <Layers size={10} />
          </div>
        </button>
      ))}
      {(categories as any[]).length === 0 && (
        <div className="py-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500">
            <Layers size={18} />
          </div>
          <p className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>
            No categories yet
          </p>
        </div>
      )}
    </>
  );

  return (
    <div className="flex w-full min-h-full" style={{ background: 'var(--bg)' }}>
      {isMobileCategorySheetOpen && (
        <div className="fixed inset-0 z-[80] bg-slate-950/50 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileCategorySheetOpen(false)} />
      )}

      <div
        className={`fixed bottom-24 right-5 z-[90] lg:hidden flex flex-col items-end gap-2 transition-all duration-300 origin-bottom-right ${
          isMobileCategorySheetOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-75 opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-[var(--surface)] rounded-3xl shadow-2xl border border-[var(--border)] overflow-hidden flex flex-col max-h-[60vh] w-[260px] shadow-blue-900/10">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-3)]">
            <div className="flex flex-col">
              <span className="font-black text-sm" style={{ color: 'var(--text-1)' }}>
                {t('menu.categories')}
              </span>
              <span className="text-[10px] font-bold" style={{ color: 'var(--text-3)' }}>
                {(categories as any[]).length} sections
              </span>
            </div>
          </div>
          <div className="overflow-y-auto custom-scrollbar p-2 space-y-1">
            <CategoryListItems />
          </div>
          <div className="p-2 border-t border-[var(--border)] bg-[var(--surface-3)]">
            <button
              onClick={() => {
                setIsMobileCategorySheetOpen(false);
                handleAddCategory();
              }}
              className="w-full py-2.5 rounded-xl font-bold text-sm text-blue-600 bg-blue-600/10 hover:bg-blue-600/20 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} /> {t('menu.createCategory')}
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={() => setIsMobileCategorySheetOpen(!isMobileCategorySheetOpen)}
        className="fixed bottom-6 right-5 z-[100] lg:hidden w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-600/30 active:scale-95 transition-all outline-none"
      >
        {isMobileCategorySheetOpen ? <X size={24} /> : <Layers size={24} />}
      </button>

      <div
        className={`hidden lg:flex flex-col shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex-shrink-0 ${
          isSidebarOpen ? 'w-72' : 'w-0 overflow-hidden'
        }`}
        style={{ background: 'var(--surface)', borderRight: isSidebarOpen ? '1px solid var(--border)' : 'none' }}
      >
        <div className={`flex h-full flex-col overflow-hidden transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
          <div className="p-4 flex justify-between items-center sticky top-0 z-10" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-sm uppercase tracking-wider" style={{ color: 'var(--text-1)' }}>
                {t('menu.categories')}
              </h2>
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-black text-blue-500">
                {(categories as any[]).length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddCategory}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
              >
                <Plus size={15} />
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

          <div className="flex-1 overflow-hidden">
            <CategorySidebar
              categories={categories}
              selectedId={selectedCategoryId}
              onSelect={setSelectedCategoryId}
              isLoading={isLoadingCategories}
              showHeader={false}
              onCreateRequest={handleAddCategory}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div
          className="px-3 sm:px-5 py-2.5 flex items-center gap-2 sm:gap-3 overflow-x-auto custom-scrollbar sticky top-0 z-30 flex-nowrap"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        >
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="hidden lg:flex p-2 rounded-xl border hover:bg-blue-500/5 transition-all flex-shrink-0"
              style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
            >
              <Menu size={16} />
            </button>
          )}

          <div className="lg:hidden flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface-3)] text-[var(--text-1)] text-xs font-black flex-shrink-0 border border-[var(--border)]">
            <Layers size={13} className="text-blue-500" />
            {selectedCategory?.name || t('menu.categories')}
          </div>

          <div className="flex items-center gap-2 flex-nowrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-[var(--surface-3)] flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
              <Layers size={13} className="text-blue-500" />
              <span className="text-xs font-black" style={{ color: 'var(--text-1)' }}>
                {selectedCategory?.name || 'No category selected'}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-[0.14em] flex-shrink-0" style={{ borderColor: 'var(--border)', color: 'var(--text-3)', background: 'var(--surface-3)' }}>
              {(categories as any[]).length} sections
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {tenantSlug && (
              <a
                href={`${getCustomerAppUrl()}/order/${tenantSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold tracking-widest uppercase text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full hover:bg-blue-500/20 transition-colors"
              >
                <ExternalLink size={11} />
                {t('menu.livePreview')}
              </a>
            )}
            <button
              onClick={() => setShowAiImporter(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-[0_0_15px_rgba(147,51,234,0.3)] hover:shadow-[0_0_20px_rgba(147,51,234,0.5)] border border-purple-400/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Sparkles size={14} className="text-purple-200" />
              <span className="hidden sm:inline">{t('menu.aiImport')}</span>
              <span className="sm:hidden">AI</span>
            </button>
          </div>
        </div>

        {selectedCategoryId ? (
          <div id="item-list-container" className="flex-1 min-w-0 overflow-y-auto custom-scrollbar p-4 sm:p-6">
            <ItemList categoryId={selectedCategoryId} />
          </div>
        ) : (categories as any[]).length === 0 && !isLoadingCategories ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar flex items-center justify-center flex-col text-center">
            <div className="h-16 w-16 mb-4 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Layers size={24} />
            </div>
            <h2 className="text-xl font-black text-[var(--text-1)] mb-1">No Categories Found</h2>
            <p className="text-sm font-semibold text-[var(--text-3)] mb-6">
              Your menu is empty. Create a category to start organizing your items.
            </p>
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

      <PromptModal
        isOpen={showCreateCategoryPrompt}
        onClose={() => setShowCreateCategoryPrompt(false)}
        title="Create New Category"
        label="Category Name"
        placeholder="e.g. Burgers, Drinks, Desserts"
        onSubmit={(name) => createCategoryMutation.mutate(name)}
      />

      {showAiImporter && <AiMenuImporter onClose={() => setShowAiImporter(false)} />}
    </div>
  );
}
