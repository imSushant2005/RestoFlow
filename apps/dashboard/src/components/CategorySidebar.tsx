import { Plus, GripVertical } from 'lucide-react';
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

function SortableCategoryItem({ id, category, isSelected, onSelect }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: isSelected ? 'var(--sidebar-item-active-bg)' : 'var(--card-bg)',
        color: isSelected ? 'var(--sidebar-text-active)' : 'var(--text-1)',
        borderBottom: '1px solid var(--border)',
        borderLeft: isSelected ? '3px solid var(--brand)' : '3px solid transparent',
      }}
      className="flex items-center gap-2 p-3 text-sm font-medium cursor-pointer transition-colors"
    >
      <div {...attributes} {...listeners} className="cursor-grab p-1" style={{ color: 'var(--text-3)' }}>
        <GripVertical size={16} />
      </div>
      <div className="flex-1" onClick={() => onSelect(id)}>
        {category.name}
      </div>
    </div>
  );
}

export function CategorySidebar({ categories: initialCategories, selectedId, onSelect, isLoading }: any) {
  const [categories, setCategories] = useState(initialCategories);
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

  const createMutation = useMutation({
    mutationFn: (name: string) => api.post('/menus/categories', { name, description: '' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] })
  });

  if (isLoading) return <div className="p-4 text-sm" style={{ color: 'var(--text-3)' }}>Loading...</div>;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface)' }}>
      <div className="p-4 flex justify-between items-center sticky top-0 z-10" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <h2 className="font-semibold" style={{ color: 'var(--text-1)' }}>Categories</h2>
        <button 
          onClick={() => {
            const name = prompt('Category name:');
            if (name) createMutation.mutate(name);
          }}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: 'var(--brand)' }}
        >
          <Plus size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto pb-10">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={categories.map((c: any) => c.id)} strategy={verticalListSortingStrategy}>
            {categories.map((c: any) => (
              <SortableCategoryItem 
                key={c.id} 
                id={c.id} 
                category={c} 
                isSelected={selectedId === c.id}
                onSelect={onSelect}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
