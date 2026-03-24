import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Store, UtensilsCrossed, LayoutDashboard } from 'lucide-react';

export function Onboarding() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [businessData, setBusinessData] = useState({ name: '', slug: '' });
  const [tableData, setTableData] = useState({ zoneName: 'Main Dining', tableCount: 5 });
  const [menuData, setMenuData] = useState({ categoryName: 'Mains', itemName: 'Signature Burger', itemPrice: 12.99 });

  const setupMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/settings/business', { 
        name: businessData.name, 
        slug: businessData.slug,
        onboardingCompleted: true
      });
      
      if (tableData.tableCount > 0) {
        const zoneRes = await api.post('/venue/zones', { name: tableData.zoneName, width: 800, height: 600 });
        const zoneId = zoneRes.data.id;
        for (let i = 1; i <= tableData.tableCount; i++) {
          await api.post('/venue/tables', { name: `${i}`, zoneId, x: i * 100, y: 100 });
        }
      }

      if (menuData.itemName) {
        const catRes = await api.post('/menus/categories', { name: menuData.categoryName, description: 'Our starting menu' });
        await api.post('/menus/items', { 
          categoryId: catRes.data.id, 
          name: menuData.itemName, 
          price: Number(menuData.itemPrice), 
          description: 'A delicious starting item',
          dietaryTags: [] 
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      navigate('/');
    }
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        
        <div className="bg-blue-600 p-8 text-white flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Welcome to RESTOFLOW</h1>
            <p className="opacity-80 font-medium mt-1">Let's set up your venue in 3 easy steps.</p>
          </div>
          <div className="bg-white/20 p-3 rounded-2xl backdrop-blur flex gap-2">
             {[1, 2, 3].map(s => (
               <div key={s} className={`w-3 h-3 rounded-full ${step >= s ? 'bg-white' : 'bg-white/30 transition-all font-bold text-transparent'}`} />
             ))}
          </div>
        </div>

        <div className="p-8">
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-300">
              <div className="flex items-center gap-4 mb-8 text-blue-600 border-b pb-5">
                <Store size={28} />
                <h2 className="text-xl font-bold text-gray-900">1. Business Details</h2>
              </div>
              <div className="flex flex-col gap-6">
                <div>
                  <label className="font-bold text-sm text-gray-700 block mb-2">Venue Name</label>
                  <input 
                    value={businessData.name} 
                    onChange={e => setBusinessData({...businessData, name: e.target.value})} 
                    className="w-full border-2 border-gray-200 p-3.5 rounded-xl font-medium focus:border-blue-600 outline-none transition-colors"
                    placeholder="e.g. The Rustic Cafe" autoFocus
                  />
                </div>
                <div>
                  <label className="font-bold text-sm text-gray-700 block mb-2">Order URL Slug</label>
                  <div className="flex items-stretch focus-within:ring-2 focus-within:ring-blue-200 rounded-xl overflow-hidden">
                    <span className="bg-gray-100 border-2 border-r-0 border-gray-200 px-4 flex items-center text-gray-500 font-medium text-sm select-none">restoflow.com/order/</span>
                    <input 
                      value={businessData.slug} 
                      onChange={e => setBusinessData({...businessData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})} 
                      className="flex-1 border-2 border-gray-200 p-3.5 font-bold text-blue-600 outline-none transition-colors"
                      placeholder="rustic-cafe"
                    />
                  </div>
                </div>
                <button 
                  disabled={!businessData.name || !businessData.slug}
                  onClick={() => setStep(2)}
                  className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl mt-4 flex justify-center items-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md active:scale-[0.98]"
                >
                  Continue <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-300">
               <div className="flex items-center gap-4 mb-8 text-blue-600 border-b pb-5">
                <LayoutDashboard size={28} />
                <h2 className="text-xl font-bold text-gray-900">2. Floor Plan Basics</h2>
              </div>
              <div className="flex flex-col gap-6">
                <div>
                  <label className="font-bold text-sm text-gray-700 block mb-2">Primary Zone Name</label>
                  <input 
                    value={tableData.zoneName} 
                    onChange={e => setTableData({...tableData, zoneName: e.target.value})} 
                    className="w-full border-2 border-gray-200 p-3.5 rounded-xl font-medium focus:border-blue-600 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="font-bold text-sm text-gray-700 block mb-2">How many tables to generate?</label>
                  <input 
                    type="number" min="0" max="50"
                    value={tableData.tableCount} 
                    onChange={e => setTableData({...tableData, tableCount: Number(e.target.value)})} 
                    className="w-full border-2 border-gray-200 p-3.5 rounded-xl font-bold focus:border-blue-600 outline-none transition-colors"
                  />
                  <p className="text-xs text-gray-400 mt-2 font-medium">You can reposition them in the Dashboard later.</p>
                </div>
                <button 
                  onClick={() => setStep(3)}
                  className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl mt-4 flex justify-center items-center gap-2 hover:bg-blue-700 transition-all shadow-md active:scale-[0.98]"
                >
                  Continue <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-300">
               <div className="flex items-center gap-4 mb-8 text-blue-600 border-b pb-5">
                <UtensilsCrossed size={28} />
                <h2 className="text-xl font-bold text-gray-900">3. First Menu Item</h2>
              </div>
              <div className="flex flex-col gap-6">
                <div>
                  <label className="font-bold text-sm text-gray-700 block mb-2">Category Name</label>
                  <input 
                    value={menuData.categoryName} 
                    onChange={e => setMenuData({...menuData, categoryName: e.target.value})} 
                    className="w-full border-2 border-gray-200 p-3.5 rounded-xl font-medium focus:border-blue-600 outline-none transition-colors"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="font-bold text-sm text-gray-700 block mb-2">Item Name</label>
                    <input 
                      value={menuData.itemName} 
                      onChange={e => setMenuData({...menuData, itemName: e.target.value})} 
                      className="w-full border-2 border-gray-200 p-3.5 rounded-xl font-bold focus:border-blue-600 outline-none transition-colors"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="font-bold text-sm text-gray-700 block mb-2">Price ($)</label>
                    <input 
                      type="number" step="0.01" min="0"
                      value={menuData.itemPrice} 
                      onChange={e => setMenuData({...menuData, itemPrice: Number(e.target.value)})} 
                      className="w-full border-2 border-gray-200 p-3.5 rounded-xl font-bold focus:border-blue-600 outline-none transition-colors"
                    />
                  </div>
                </div>
                
                <button 
                  disabled={setupMutation.isPending || !menuData.itemName}
                  onClick={() => setupMutation.mutate()}
                  className="w-full bg-green-600 text-white font-bold py-4 rounded-xl mt-4 flex justify-center items-center gap-2 hover:bg-green-700 disabled:opacity-50 transition-all shadow-lg shadow-green-600/20 active:scale-[0.98]"
                >
                  {setupMutation.isPending ? 'Building Venue...' : 'Complete Setup'} <Check size={20} strokeWidth={3} />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
