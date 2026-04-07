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
      style={{
        ...style,
        background: 'var(--card-bg)',
        border: `1px solid ${isSelected ? 'var(--brand)' : 'var(--card-border)'}`,
        boxShadow: 'var(--card-shadow)',
      }}
      className={`rounded-xl transition-all flex flex-col overflow-hidden ${
        !item.isAvailable ? 'opacity-75' : 'hover:shadow-md'
      } ${isSelected ? 'ring-2 ring-blue-400/30' : ''}`}
    >
      <div className="relative h-36" style={{ background: 'var(--surface-3)', borderBottom: '1px solid var(--border)' }}>
        {imageUrl ? (
          <img src={imageUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl opacity-40">🍽️</div>
        )}
        <button
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 rounded-lg p-1.5 cursor-grab active:cursor-grabbing"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text-3)' }}
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>
        <label className="absolute top-2 right-2 rounded-lg px-2 py-1 flex items-center gap-1.5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
          <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(item.id)} />
          <span className="text-[11px] font-bold" style={{ color: 'var(--text-2)' }}>Select</span>
        </label>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-3">
        {!isEditing ? (
          <>
            <div className="flex justify-between items-start gap-2">
              <h3 className="font-semibold leading-tight" style={{ color: 'var(--text-1)' }}>{item.name}</h3>
              <button
                onClick={() => onStartEdit(item)}
                className="p-1 rounded-md transition-colors"
                style={{ color: 'var(--text-3)' }}
                title="Inline edit"
              >
                <Pencil size={14} />
              </button>
            </div>
            <p className="text-sm line-clamp-2 min-h-[38px]" style={{ color: 'var(--text-3)' }}>{item.description || 'No description provided.'}</p>
            <div className="flex items-center justify-between mt-auto pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="font-bold" style={{ color: 'var(--text-1)' }}>{formatINR(item.price)}</span>
              <button
                onClick={() => onToggleVisibility(item)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
                style={{
                  background: item.isAvailable ? 'rgba(16,185,129,0.12)' : 'var(--surface-3)',
                  color: item.isAvailable ? 'var(--success)' : 'var(--text-3)',
                  border: `1px solid ${item.isAvailable ? 'rgba(16,185,129,0.25)' : 'var(--border)'}`,
                }}
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
              className="w-full rounded-lg px-2.5 py-2 text-sm font-medium outline-none"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
              placeholder="Item name"
            />
            <textarea
              value={draft.description}
              onChange={(e) => onDraftChange({ ...draft, description: e.target.value })}
              className="w-full rounded-lg px-2.5 py-2 text-sm min-h-[72px] outline-none"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
              placeholder="Description"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.01"
                value={draft.price}
                onChange={(e) => onDraftChange({ ...draft, price: Number(e.target.value) || 0 })}
                className="w-full rounded-lg px-2.5 py-2 text-sm outline-none"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
                placeholder="Price"
              />
              <input
                value={draft.imageUrl}
                onChange={(e) => onDraftChange({ ...draft, imageUrl: e.target.value })}
                className="w-full rounded-lg px-2.5 py-2 text-sm outline-none"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
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
                className="px-3 text-sm font-bold rounded-lg flex items-center justify-center"
                style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}
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
    onError: (err: any) => alert(err?.response?.data?.error || 'Failed to update item visibility'),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderIds: string[]) => api.put('/menus/items/reorder', { orderIds }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
    onError: (err: any) => alert(err?.response?.data?.error || 'Failed to reorder items'),
  });

  const inlineEditMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.patch(`/menus/items/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setEditingId(null);
    },
    onError: (err: any) => alert(err?.response?.data?.error || 'Failed to save item'),
  });

  const bulkVisibilityMutation = useMutation({
    mutationFn: ({ itemIds, isAvailable }: { itemIds: string[]; isAvailable: boolean }) =>
      api.patch('/menus/items/bulk-availability', { itemIds, isAvailable }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setSelectedIds([]);
    },
    onError: (err: any) => alert(err?.response?.data?.error || 'Failed to update items'),
  });

  useEffect(() => {
    const token =
      localStorage.getItem('restoflow_token') ||
      localStorage.getItem('dineflow_token') ||
      localStorage.getItem('accessToken');
    const socket = io(getSocketUrl(), {
      auth: { token, client: 'dashboard-menu' },
      transports: ['websocket'],
      rememberUpgrade: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 10000,
    });

    const handleAvailabilityChange = (payload: any) => {
      queryClient.setQueryData(['items', categoryId], (old: any) => {
        if (!old) return old;
        return old.map((item: any) =>
          item.id === payload.itemId ? { ...item, isAvailable: payload.isAvailable } : item
        );
      });
    };

    const handleConnectError = () => {
      queryClient.invalidateQueries({ queryKey: ['items', categoryId] });
    };

    socket.on('menu:availability_changed', handleAvailabilityChange);
    socket.on('connect_error', handleConnectError);

    return () => {
      socket.off('menu:availability_changed', handleAvailabilityChange);
      socket.off('connect_error', handleConnectError);
      socket.disconnect();
    };
  }, [categoryId, queryClient]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedItems((current) => {
      const oldIndex = current.findIndex((item) => item.id === active.id);
      const newIndex = current.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return current;
      const next = arrayMove(current, oldIndex, newIndex);
      reorderMutation.mutate(next.map((item) => item.id));
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const startInlineEdit = (item: any) => {
    if (!item) return;
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

  if (isLoading) return <div style={{ color: 'var(--text-3)' }}>Loading items...</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Menu Items</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <>
              <button
                onClick={() => bulkVisibilityMutation.mutate({ itemIds: selectedIds, isAvailable: true })}
                className="px-3 py-2 rounded-lg text-xs font-bold"
                style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.25)' }}
              >
                Show {selectedIds.length} Selected
              </button>
              <button
                onClick={() => bulkVisibilityMutation.mutate({ itemIds: selectedIds, isAvailable: false })}
                className="px-3 py-2 rounded-lg text-xs font-bold"
                style={{ background: 'var(--surface-3)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
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
              <div className="col-span-full py-16 text-center rounded-xl" style={{ background: 'var(--card-bg)', border: '2px dashed var(--border)', color: 'var(--text-3)' }}>
                <p className="text-lg font-medium" style={{ color: 'var(--text-2)' }}>No menu items</p>
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
