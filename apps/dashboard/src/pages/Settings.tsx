import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Save, Plus, Trash2 } from 'lucide-react';

export function Settings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'business' | 'staff' | 'qr'>('business');

  const { data: business, isLoading: loadingBusiness } = useQuery({
    queryKey: ['settings-business'],
    queryFn: async () => (await api.get('/settings/business')).data
  });

  const businessMutation = useMutation({
    mutationFn: (data: any) => api.patch('/settings/business', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-business'] });
      alert('Business settings updated');
    }
  });

  const handleBusinessSave = (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    businessMutation.mutate({
      businessName: formData.get('businessName'),
      slug: formData.get('slug'),
      description: formData.get('description'),
      logoUrl: formData.get('logoUrl'),
      coverImageUrl: formData.get('coverImageUrl'),
      primaryColor: formData.get('primaryColor'),
      accentColor: formData.get('accentColor'),
    });
  };

  const { data: staff, isLoading: loadingStaff } = useQuery({
    queryKey: ['settings-staff'],
    queryFn: async () => (await api.get('/settings/staff')).data
  });

  const staffMutation = useMutation({
    mutationFn: (data: any) => api.post('/settings/staff', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-staff'] });
    }
  });

  const deleteStaffMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/staff/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings-staff'] })
  });

  const handleStaffAdd = (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    staffMutation.mutate({
      name: formData.get('name'),
      email: formData.get('email'),
      role: formData.get('role'),
      password: formData.get('password'),
    });
    e.target.reset();
  };

  if (loadingBusiness || loadingStaff) return <div className="p-8 font-medium text-gray-500 animate-pulse">Loading settings...</div>;

  return (
    <div className="flex-1 p-8 bg-gray-50 overflow-y-auto w-full">
      <h2 className="text-3xl font-bold tracking-tight text-gray-900 mb-8">System Settings</h2>
      
      <div className="flex gap-4 mb-8 border-b">
        <button className={`pb-4 px-2 font-semibold ${activeTab === 'business' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`} onClick={() => setActiveTab('business')}>Business Profile</button>
        <button className={`pb-4 px-2 font-semibold ${activeTab === 'staff' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`} onClick={() => setActiveTab('staff')}>Staff Management</button>
        <button className={`pb-4 px-2 font-semibold ${activeTab === 'qr' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`} onClick={() => setActiveTab('qr')}>QR Customization</button>
      </div>

      {activeTab === 'business' && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border max-w-3xl">
          <form onSubmit={handleBusinessSave} className="flex flex-col gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Business Name</label>
              <input name="businessName" defaultValue={business?.businessName} required className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Tagline / Description</label>
              <textarea
                name="description"
                defaultValue={business?.description || ''}
                rows={3}
                placeholder="Describe your restaurant vibe in one short line..."
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Venue Slug (URL)</label>
              <input name="slug" defaultValue={business?.slug} required className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium" />
              <p className="text-xs text-gray-500 mt-2">Customers will order at: restoflow.com/order/<strong>{business?.slug}</strong></p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Brand Logo URL</label>
                <input
                  name="logoUrl"
                  type="url"
                  defaultValue={business?.logoUrl || ''}
                  placeholder="https://.../logo.png"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Hero Cover Image URL</label>
                <input
                  name="coverImageUrl"
                  type="url"
                  defaultValue={business?.coverImageUrl || ''}
                  placeholder="https://.../cover.jpg"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Primary Color</label>
                <div className="flex items-center gap-3 p-2 border rounded-lg bg-gray-50">
                  <input type="color" name="primaryColor" defaultValue={business?.primaryColor || '#3B82F6'} className="w-12 h-12 rounded cursor-pointer border-0 p-0" />
                  <span className="text-sm font-medium text-gray-500">{business?.primaryColor || '#3B82F6'}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Accent Color</label>
                <div className="flex items-center gap-3 p-2 border rounded-lg bg-gray-50">
                  <input type="color" name="accentColor" defaultValue={business?.accentColor || '#111827'} className="w-12 h-12 rounded cursor-pointer border-0 p-0" />
                  <span className="text-sm font-medium text-gray-500">{business?.accentColor || '#111827'}</span>
                </div>
              </div>
            </div>

            <button type="submit" disabled={businessMutation.isPending} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 mt-4 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-70">
              <Save size={18} /> Save Branding & Profile
            </button>
          </form>
        </div>
      )}

      {activeTab === 'staff' && (
        <div className="flex flex-col gap-8 max-w-4xl">
          <div className="bg-white p-8 rounded-2xl shadow-sm border">
            <h3 className="font-bold text-lg mb-6">Add New Staff Member</h3>
            <form onSubmit={handleStaffAdd} className="grid grid-cols-2 gap-4">
              <input name="name" placeholder="Full Name" required className="p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-medium" />
              <input name="email" type="email" placeholder="Email Address" required className="p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-medium" />
              <input name="password" type="password" placeholder="Temporary Password" required className="p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-medium" />
              <select name="role" className="p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium cursor-pointer">
                <option value="STAFF">Staff (POS & Tables)</option>
                <option value="KITCHEN">Kitchen (KDS Only)</option>
                <option value="MANAGER">Manager (Full Access)</option>
              </select>
              <button type="submit" disabled={staffMutation.isPending} className="col-span-2 bg-gray-900 text-white font-bold py-3 rounded-lg mt-2 flex justify-center items-center gap-2 hover:bg-black active:scale-[0.99] transition-all disabled:opacity-70">
                <Plus size={18} /> Send Team Invitation
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-4 font-semibold text-gray-600">Name</th>
                  <th className="p-4 font-semibold text-gray-600">Email</th>
                  <th className="p-4 font-semibold text-gray-600">Role</th>
                  <th className="p-4 font-semibold text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {staff?.map((s: any) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-4 font-bold text-gray-900">{s.name}</td>
                    <td className="p-4 text-gray-500 font-medium">{s.email}</td>
                    <td className="p-4"><span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full">{s.role}</span></td>
                    <td className="p-4">
                      <button onClick={() => deleteStaffMutation.mutate(s.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'qr' && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border max-w-2xl">
          <form onSubmit={handleBusinessSave} className="flex flex-col gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Brand Primary Color (used in QRs too)</label>
              <div className="flex gap-4 items-center p-2 border rounded-xl bg-gray-50">
                <input type="color" name="primaryColor" defaultValue={business?.primaryColor || '#3B82F6'} className="w-16 h-16 rounded-xl cursor-pointer border-0 p-0" />
                <span className="text-gray-500 text-sm font-medium pr-4">This color injects into generated QR codes and storefront highlights to match your venue branding.</span>
              </div>
            </div>
            {/* hidden fields to prevent unsetting */}
            <input type="hidden" name="businessName" value={business?.businessName} />
            <input type="hidden" name="slug" value={business?.slug} />
            <input type="hidden" name="description" value={business?.description || ''} />
            <input type="hidden" name="logoUrl" value={business?.logoUrl || ''} />
            <input type="hidden" name="coverImageUrl" value={business?.coverImageUrl || ''} />
            <input type="hidden" name="accentColor" value={business?.accentColor || '#111827'} />
            <button type="submit" disabled={businessMutation.isPending} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 mt-4 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-70">
              <Save size={18} /> Apply Branding Parameters
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
