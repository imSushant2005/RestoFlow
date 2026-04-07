import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Sparkles, Loader2 } from 'lucide-react';

export function ItemModal({ isOpen, onClose, categoryId, editingItem }: any) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(0);
  const [imageUrl, setImageUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateAI = async () => {
    if (!name) return alert('Please enter a Dish Name first to give the AI context.');
    setIsGenerating(true);
    try {
      const res = await api.post('/ai/generate-description', { name, category: 'Restaurant Dish' });
      if (res.data?.description) {
        setDescription(res.data.description);
      }
    } catch (e) {
      console.error('AI Gen Failed', e);
      alert('Failed to generate description. Check plan limit or API keys.');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name);
      setDescription(editingItem.description || '');
      setPrice(editingItem.price);
      setImageUrl(editingItem?.images?.[0] || editingItem?.imageUrl || '');
    } else {
      setName('');
      setDescription('');
      setPrice(0);
      setImageUrl('');
    }
  }, [editingItem, isOpen]);

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (editingItem?.id) {
        return api.patch(`/menus/items/${editingItem.id}`, data);
      }
      return api.post('/menus/items', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      onClose();
    },
    onError: (err: any) => alert(err?.response?.data?.error || 'Failed to save item'),
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) return alert('Category is required');
    mutation.mutate({ name, description, price: Number(price), imageUrl, categoryId });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'var(--surface-overlay)' }}>
      <div className="p-6 rounded-xl w-full max-w-md shadow-2xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-1)' }}>{editingItem ? 'Edit Item' : 'New Menu Item'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-2)' }}>Name</label>
            <input
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full p-2.5 rounded-lg outline-none transition-colors"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
              placeholder="Cheeseburger"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium" style={{ color: 'var(--text-2)' }}>Description</label>
              <button 
                type="button" 
                onClick={handleGenerateAI}
                disabled={isGenerating || !name}
                className="text-xs font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
                style={{ color: '#a855f7', background: 'rgba(168,85,247,0.1)' }}
              >
                {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                Magic Auto-Write
              </button>
            </div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full p-2.5 rounded-lg outline-none transition-colors"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
              rows={3}
              placeholder="Juicy beef patty..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-2)' }}>Price (₹)</label>
            <input
              type="number"
              step="0.01"
              required
              value={price}
              onChange={e => setPrice(Number(e.target.value))}
              className="w-full p-2.5 rounded-lg outline-none transition-colors"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-2)' }}>Image URL</label>
            <input
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              className="w-full p-2.5 rounded-lg outline-none transition-colors"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
              placeholder="https://..."
            />
            {imageUrl && (
              <div className="mt-2 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface-3)' }}>
                <img src={imageUrl} alt="Preview" className="w-full h-28 object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium transition-colors"
              style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">Save Item</button>
          </div>
        </form>
      </div>
    </div>
  );
}
