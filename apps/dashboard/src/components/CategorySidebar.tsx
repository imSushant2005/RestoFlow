import { Plus, GripVertical, Layers, Trash2 } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface Category {
  id: string;
  name: string;
}

type CategorySidebarProps = {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  isLoading?: boolean;
  showHeader?: boolean;
  onCreateRequest?: () => void;
};

function SortableCategoryItem({ id, category, isSelected, onSelect, onDeleteClick }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-center gap-3 p-3 mb-2 rounded-2xl cursor-pointer transition-all duration-200 border ${isSelected
          ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-600/20 text-white'
          : 'bg-[var(--surface-raised)] border-[var(--border)] hover:border-blue-500/50 hover:bg-blue-500/5 text-[var(--text-1)]'
        }`}
      onClick={() => onSelect(id)}
    >
      <div {...attributes} {...listeners} className={`cursor-grab p-1 opacity-40 group-hover:opacity-100 transition-opacity ${isSelected ? 'text-blue-100' : 'text-[var(--text-3)]'}`}>
        <GripVertical size={14} />
      </div>
      <div className={`p-2 rounded-xl transition-colors ${isSelected ? 'bg-white/20' : 'bg-blue-500/10 text-blue-500'}`}>
        <Layers size={16} />
      </div>
      <div className="flex-1 font-bold text-sm tracking-tight truncate">
        {category.name}
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); onDeleteClick(category); }}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-all flex-shrink-0"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function CategorySidebar({
  categories: initialCategories,
  selectedId,
  onSelect,
  isLoading,
  showHeader = true,
  onCreateRequest,
}: CategorySidebarProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [categoryToDelete, setCategoryToDelete] = useState<any>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const reorderMutation = useMutation({
    mutationFn: (orderIds: string[]) => api.put('/menus/categories/reorder', { orderIds }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] })
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setCategories((items: Category[]) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over?.id);
        const newArray = arrayMove(items, oldIndex, newIndex);
        reorderMutation.mutate(newArray.map(c => c.id));
        return newArray;
      });
    }
  };

  const handleCreateClick = () => {
    onCreateRequest?.();
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/menus/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (selectedId === categoryToDelete?.id) onSelect(null);
      setCategoryToDelete(null);
    }
  });

  if (isLoading) return <div className="p-4 text-sm" style={{ color: 'var(--text-3)' }}>Loading...</div>;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface)' }}>
      {showHeader && (
        <div className="p-4 flex justify-between items-center sticky top-0 z-10" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold" style={{ color: 'var(--text-1)' }}>Categories</h2>
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-black text-blue-500">
              {categories.length}
            </span>
          </div>
          <button
            onClick={handleCreateClick}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: 'var(--brand)' }}
          >
            <Plus size={18} />
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-3 pb-10 custom-scrollbar">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={categories.map((c: any) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {categories.map((c: any) => (
                <SortableCategoryItem
                  key={c.id}
                  id={c.id}
                  category={c}
                  isSelected={selectedId === c.id}
                  onSelect={onSelect}
                  onDeleteClick={setCategoryToDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Delete Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] text-[var(--text-1)] rounded-3xl p-6 sm:p-8 max-w-sm w-full mx-auto shadow-2xl animate-in zoom-in-95 duration-200" style={{ border: '1px solid var(--border)' }}>
            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
              <Trash2 className="text-red-500" size={32} />
            </div>
            <h2 className="text-center text-xl font-black mb-2">Delete Category?</h2>
            <p className="text-center text-sm font-semibold mb-8 text-[var(--text-3)] leading-relaxed">
              Are you sure you want to delete <span className="text-[var(--text-1)]">"{categoryToDelete.name}"</span>? This will also remove any items within it and cannot be undone.
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setCategoryToDelete(null)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-3 px-4 rounded-xl font-bold bg-[var(--surface-3)] text-[var(--text-2)] hover:bg-[var(--surface-raised)] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(categoryToDelete.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-red-600 hover:bg-red-500 transition-all shadow-lg shadow-red-500/20 active:scale-95 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
