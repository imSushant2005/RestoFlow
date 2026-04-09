import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getCustomerAppUrl } from '../lib/network';
import { CategorySidebar } from '../components/CategorySidebar';
import { ItemList } from '../components/ItemList';
import { AiMenuImporter } from '../components/AiMenuImporter';
import { ExternalLink, Sparkles } from 'lucide-react';

export function MenuBuilder() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showAiImporter, setShowAiImporter] = useState(false);

  const { data: categories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/menus/categories');
      return res.data;
    }
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await api.get('/settings/business');
      return res.data;
    }
  });

  const tenantSlug = settings?.slug || '';

  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  return (
    <div className="flex flex-col w-full h-full">
      {/* Top Action Bar */}
      <div className="px-6 py-4 flex justify-between items-center shadow-xs" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', backdropFilter: 'blur(12px)' }}>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            {tenantSlug && (
              <a 
                href={`${getCustomerAppUrl()}/order/${tenantSlug}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-3 flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold tracking-widest uppercase text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full hover:bg-blue-500/20 transition-colors"
              >
                <ExternalLink size={12} />
                Live Preview
              </a>
            )}
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Drag to reorder • Inline edit on cards • Bulk show/hide supported</p>
        </div>
        <button 
          onClick={() => setShowAiImporter(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(147,51,234,0.3)] hover:shadow-[0_0_20px_rgba(147,51,234,0.5)] border border-purple-400/20 group hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Sparkles size={16} className="text-purple-200 group-hover:text-white transition-colors" />
          AI Magic Import
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-64 h-full overflow-y-auto custom-scrollbar" style={{ borderRight: '1px solid var(--border)', background: 'var(--surface)' }}>
          <CategorySidebar 
            categories={categories} 
            selectedId={selectedCategoryId}
            onSelect={setSelectedCategoryId}
            isLoading={isLoadingCategories}
          />
        </div>
        <div id="item-list-container" className="flex-1 p-6 h-full overflow-y-auto custom-scrollbar bg-transparent">
          {selectedCategoryId ? (
            <ItemList categoryId={selectedCategoryId} />
          ) : (
            <div className="h-full flex items-center justify-center font-medium" style={{ color: 'var(--text-3)' }}>
              Select a category to manage items
            </div>
          )}
        </div>
      </div>

      {showAiImporter && (
        <AiMenuImporter onClose={() => setShowAiImporter(false)} />
      )}
    </div>
  );
}
