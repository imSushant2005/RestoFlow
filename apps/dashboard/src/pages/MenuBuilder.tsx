import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CategorySidebar } from '../components/CategorySidebar';
import { ItemList } from '../components/ItemList';

export function MenuBuilder() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const { data: categories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/menus/categories');
      return res.data;
    }
  });

  return (
    <div className="flex w-full h-full">
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
  );
}
