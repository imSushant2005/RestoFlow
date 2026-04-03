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
      <div className="px-6 py-3 border-b bg-white flex justify-between items-center shadow-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Menu Management</h1>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Drag to reorder • Inline edit on cards • Bulk show/hide supported</p>
          {tenantSlug && (
            <a 
              href={`${getCustomerAppUrl()}/order/${tenantSlug}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <ExternalLink size={12} />
              View Live Site
            </a>
          )}
        </div>
        <button 
          onClick={() => setShowAiImporter(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Sparkles size={16} />
          AI Magic Import
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-64 border-r bg-white h-full overflow-y-auto">
          <CategorySidebar 
            categories={categories} 
            selectedId={selectedCategoryId}
            onSelect={setSelectedCategoryId}
            isLoading={isLoadingCategories}
          />
        </div>
        <div className="flex-1 p-6 h-full overflow-y-auto bg-gray-50">
          {selectedCategoryId ? (
            <ItemList categoryId={selectedCategoryId} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
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
