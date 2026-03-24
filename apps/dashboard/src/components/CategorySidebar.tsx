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
      style={style}
      className={`flex items-center gap-2 p-3 text-sm font-medium cursor-pointer border-b bg-white ${
        isSelected ? 'bg-blue-50 text-blue-700 border-l-4 border-l-blue-600' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <div {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600 p-1">
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

  if (isLoading) return <div className="p-4 text-sm text-gray-500">Loading...</div>;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b flex justify-between items-center bg-white sticky top-0 z-10">
        <h2 className="font-semibold text-gray-800">Categories</h2>
        <button 
          onClick={() => {
            const name = prompt('Category name:');
            if (name) createMutation.mutate(name);
          }}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"
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
