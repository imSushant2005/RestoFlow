import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Plus, ToggleLeft, ToggleRight, GripVertical, Pencil, Check, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { ItemModal } from './ItemModal';
import { formatINR } from '../lib/currency';
import { getSocketUrl } from '../lib/network';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type DraftState = {
  name: string;
  description: string;
  price: number;
  imageUrl: string;
};

function SortableItemCard({
  item,
  isSelected,
  onToggleSelect,
  onToggleVisibility,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  isEditing,
  draft,
  onDraftChange,
  isSaving,
}: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const imageUrl = item?.images?.[0] || item?.imageUrl || '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border bg-white shadow-sm transition-all flex flex-col overflow-hidden ${
        !item.isAvailable ? 'opacity-75' : 'hover:shadow-md'
      } ${isSelected ? 'ring-2 ring-blue-400 border-blue-300' : 'border-gray-200'}`}
    >
      <div className="relative h-36 bg-gray-100 border-b border-gray-100">
        {imageUrl ? (
          <img src={imageUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl opacity-40">🍽️</div>
        )}
        <button
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 bg-white/90 hover:bg-white text-gray-500 rounded-lg p-1.5 border border-gray-200 cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>
        <label className="absolute top-2 right-2 bg-white/90 rounded-lg px-2 py-1 border border-gray-200 flex items-center gap-1.5">
          <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(item.id)} />
          <span className="text-[11px] font-bold text-gray-600">Select</span>
        </label>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-3">
        {!isEditing ? (
          <>
            <div className="flex justify-between items-start gap-2">
              <h3 className="font-semibold text-gray-900 leading-tight">{item.name}</h3>
              <button
                onClick={() => onStartEdit(item)}
                className="text-gray-500 hover:text-blue-600 p-1 rounded-md hover:bg-blue-50"
                title="Inline edit"
              >
                <Pencil size={14} />
              </button>
            </div>
            <p className="text-sm text-gray-500 line-clamp-2 min-h-[38px]">{item.description || 'No description provided.'}</p>
            <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
              <span className="font-bold text-gray-900">{formatINR(item.price)}</span>
              <button
                onClick={() => onToggleVisibility(item)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                  item.isAvailable
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}
                title={item.isAvailable ? 'Hide from customer menu' : 'Show on customer menu'}
              >
                {item.isAvailable ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                {item.isAvailable ? 'Visible' : 'Hidden'}
              </button>
            </div>
          </>
        ) : (
          <>
            <input
              value={draft.name}
              onChange={(e) => onDraftChange({ ...draft, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm font-medium"
              placeholder="Item name"
            />
            <textarea
              value={draft.description}
              onChange={(e) => onDraftChange({ ...draft, description: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm min-h-[72px]"
              placeholder="Description"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.01"
                value={draft.price}
                onChange={(e) => onDraftChange({ ...draft, price: Number(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm"
                placeholder="Price"
              />
              <input
                value={draft.imageUrl}
                onChange={(e) => onDraftChange({ ...draft, imageUrl: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm"
                placeholder="Image URL"
              />
            </div>
            <div className="flex gap-2 mt-auto">
              <button
                onClick={() => onSaveEdit(item.id)}
                disabled={isSaving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <Check size={14} /> Save
              </button>
              <button
                onClick={onCancelEdit}
                className="px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-lg flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ItemList({ categoryId }: { categoryId: string }) {
  const queryClient = useQueryClient();
  const [isModalOpen, setModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>({ name: '', description: '', price: 0, imageUrl: '' });
  const [orderedItems, setOrderedItems] = useState<any[]>([]);

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['items', categoryId],
    queryFn: async () => {
      const res = await api.get('/menus/items');
      return res.data.filter((i: any) => i.categoryId === categoryId);
    }
  });

  const items = useMemo(
    () => [...allItems].sort((a: any, b: any) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
    [allItems]
  );

  useEffect(() => {
    setOrderedItems(items);
    setSelectedIds([]);
    setEditingId(null);
  }, [items, categoryId]);

  const sensors = useSensors(useSensor(PointerSensor));

  const toggleMutation = useMutation({
    mutationFn: ({ id, isAvailable }: any) => api.patch(`/menus/items/${id}/availability`, { isAvailable }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderIds: string[]) => api.put('/menus/items/reorder', { orderIds }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  });

  const inlineEditMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.patch(`/menus/items/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setEditingId(null);
    },
  });

  const bulkVisibilityMutation = useMutation({
    mutationFn: ({ itemIds, isAvailable }: { itemIds: string[]; isAvailable: boolean }) =>
      api.patch('/menus/items/bulk-availability', { itemIds, isAvailable }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setSelectedIds([]);
    },
  });

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const socket = io(getSocketUrl(), { auth: { token } });

    socket.on('menu:availability_changed', (payload) => {
      queryClient.setQueryData(['items', categoryId], (old: any) => {
        if (!old) return old;
        return old.map((item: any) =>
          item.id === payload.itemId ? { ...item, isAvailable: payload.isAvailable } : item
        );
      });
    });

    return () => { socket.disconnect() };
  }, [categoryId, queryClient]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedItems((current) => {
      const oldIndex = current.findIndex((item) => item.id === active.id);
      const newIndex = current.findIndex((item) => item.id === over.id);
      const next = arrayMove(current, oldIndex, newIndex);
      reorderMutation.mutate(next.map((item) => item.id));
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const startInlineEdit = (item: any) => {
    setEditingId(item.id);
    setDraft({
      name: item.name || '',
      description: item.description || '',
      price: Number(item.price || 0),
      imageUrl: item?.images?.[0] || item?.imageUrl || '',
    });
  };

  const saveInlineEdit = (id: string) => {
    inlineEditMutation.mutate({
      id,
      payload: {
        name: draft.name,
        description: draft.description,
        price: draft.price,
        imageUrl: draft.imageUrl,
      },
    });
  };

  if (isLoading) return <div>Loading items...</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h2 className="text-xl font-bold text-gray-800">Menu Items</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <>
              <button
                onClick={() => bulkVisibilityMutation.mutate({ itemIds: selectedIds, isAvailable: true })}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
              >
                Show {selectedIds.length} Selected
              </button>
              <button
                onClick={() => bulkVisibilityMutation.mutate({ itemIds: selectedIds, isAvailable: false })}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200"
              >
                Hide {selectedIds.length} Selected
              </button>
            </>
          )}
          <button
            onClick={() => setModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 flex items-center gap-2 shadow-sm"
          >
            <Plus size={16} /> Add Item
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedItems.map((item) => item.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orderedItems.map((item) => (
              <SortableItemCard
                key={item.id}
                item={item}
                isSelected={selectedIds.includes(item.id)}
                onToggleSelect={toggleSelect}
                onToggleVisibility={(target: any) =>
                  toggleMutation.mutate({ id: target.id, isAvailable: !target.isAvailable })
                }
                onStartEdit={startInlineEdit}
                onSaveEdit={saveInlineEdit}
                onCancelEdit={() => setEditingId(null)}
                isEditing={editingId === item.id}
                draft={draft}
                onDraftChange={setDraft}
                isSaving={inlineEditMutation.isPending}
              />
            ))}
            {orderedItems.length === 0 && (
              <div className="col-span-full py-16 text-center text-gray-400 bg-white border-2 border-dashed border-gray-200 rounded-xl">
                <p className="text-lg font-medium text-gray-500">No menu items</p>
                <p className="text-sm mt-1">Add items to this category to see them here.</p>
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <ItemModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} categoryId={categoryId} />
    </div>
  );
}
