import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Save, Plus, Trash2, KeyRound, Clock, Settings2, ShieldCheck, QrCode, Lock } from 'lucide-react';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import { QRCodeSVG } from 'qrcode.react';

// Helpers
function sanitizeSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

function buildUsername(name: string, slug?: string) {
  const handle = sanitizeSegment(name) || 'staff';
  const tenant = sanitizeSegment(slug || 'restaurant') || 'restaurant';
  return `${handle}@${tenant}.restoflow`;
}

function buildEmployeeCode(name: string, slug?: string) {
  const tenantPrefix = sanitizeSegment(slug || 'resto').slice(0, 4).toUpperCase() || 'REST';
  const namePrefix = sanitizeSegment(name).replace(/-/g, '').slice(0, 6).toUpperCase() || 'STAFF';
  return `${tenantPrefix}-${namePrefix}`;
}

const DEFAULT_HOURS = {
  monday: { open: '09:00', close: '22:00', isOpen: true },
  tuesday: { open: '09:00', close: '22:00', isOpen: true },
  wednesday: { open: '09:00', close: '22:00', isOpen: true },
  thursday: { open: '09:00', close: '22:00', isOpen: true },
  friday: { open: '09:00', close: '23:00', isOpen: true },
  saturday: { open: '10:00', close: '23:00', isOpen: true },
  sunday: { open: '10:00', close: '22:00', isOpen: true },
};

export function Settings() {
  const queryClient = useQueryClient();
  const { plan } = usePlanFeatures();
  const [activeTab, setActiveTab] = useState<'business' | 'menu' | 'staff' | 'qr' | 'hours'>('business');
  
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Queries
  const { data: business, isLoading: loadingBusiness } = useQuery({
    queryKey: ['settings-business'],
    queryFn: async () => (await api.get('/settings/business')).data
  });

  const { data: staff, isLoading: loadingStaff } = useQuery({
    queryKey: ['settings-staff'],
    queryFn: async () => (await api.get('/settings/staff')).data
  });

  // Mutations
  const businessMutation = useMutation({
    mutationFn: (data: any) => api.patch('/settings/business', data),
    onSuccess: () => {
      setErrorMessage('');
      queryClient.invalidateQueries({ queryKey: ['settings-business'] });
      showSuccess('Settings updated successfully.');
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.error || 'Failed to update settings.');
    },
  });

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3500);
  };

  // Forms State
  const [staffForm, setStaffForm] = useState({ name: '', username: '', employeeCode: '', role: 'WAITER', password: '' });
  const [manualUsername, setManualUsername] = useState(false);
  const [manualEmployeeCode, setManualEmployeeCode] = useState(false);


  // Business Hours State
  const [hours, setHours] = useState<any>(DEFAULT_HOURS);
  
  // QR Studio State
  const [qrConfig, setQrConfig] = useState(() => {
    const saved = localStorage.getItem('rf_qr_style');
    return saved ? JSON.parse(saved) : { fgColor: '#0f172a', bgColor: '#ffffff', watermarkText: '', includeLogo: true };
  });

  useEffect(() => {
    if (business?.businessHours) {
      if (typeof business.businessHours === 'string') {
        try { setHours(JSON.parse(business.businessHours)); } catch(e){}
      } else {
        setHours(business.businessHours);
      }
    }
  }, [business?.businessHours]);

  useEffect(() => {
    localStorage.setItem('rf_qr_style', JSON.stringify(qrConfig));
  }, [qrConfig]);

  useEffect(() => {
    const slug = business?.slug || 'restaurant';
    if (!staffForm.name.trim()) return;
    if (!manualUsername) setStaffForm(p => ({ ...p, username: buildUsername(p.name, slug) }));
    if (!manualEmployeeCode) setStaffForm(p => ({ ...p, employeeCode: buildEmployeeCode(p.name, slug) }));
  }, [business?.slug, staffForm.name, manualEmployeeCode, manualUsername]);

  const handleBusinessSave = (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    businessMutation.mutate({
      businessName: formData.get('businessName'),
      slug: formData.get('slug'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      gstin: formData.get('gstin'),
      description: formData.get('description'),
      logoUrl: formData.get('logoUrl'),
      coverImageUrl: formData.get('coverImageUrl'),
      primaryColor: formData.get('primaryColor'),
      accentColor: formData.get('accentColor'),
      currencySymbol: formData.get('currencySymbol'),
      taxRate: parseFloat(formData.get('taxRate') as string) || 0,
    });
  };

  const handleHoursSave = () => {
    businessMutation.mutate({ businessHours: hours });
  };

  // Staff Mutations
  const staffMutation = useMutation({
    mutationFn: (data: any) => api.post('/settings/staff', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-staff'] });
      showSuccess('Staff created.');
      setStaffForm({ name: '', username: '', employeeCode: '', role: 'WAITER', password: '' });
      setManualUsername(false); setManualEmployeeCode(false);
    },
    onError: (err: any) => setErrorMessage(err.response?.data?.error || 'Failed to create staff.'),
  });



  const deleteStaffMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/staff/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings-staff'] }),
  });

  const handleStaffAdd = (e: any) => {
    e.preventDefault();
    staffMutation.mutate({
      name: staffForm.name.trim(),
      username: staffForm.username.trim() || buildUsername(staffForm.name, business?.slug),
      employeeCode: staffForm.employeeCode.trim() || buildEmployeeCode(staffForm.name, business?.slug),
      role: staffForm.role,
      password: staffForm.password,
    });
  };

  if (loadingBusiness || loadingStaff) return <div className="p-8 font-medium animate-pulse text-slate-500">Loading Configuration...</div>;

  const tabs: { id: string, label: string, icon: any, locked?: boolean }[] = [
    { id: 'business', label: 'Profile', icon: Settings2 },
    { id: 'menu', label: 'Menu & Tax', icon: Save },
    { id: 'hours', label: 'Business Hours', icon: Clock },
    { id: 'staff', label: 'Team', icon: ShieldCheck, locked: plan === 'MINI' },
    { id: 'qr', label: 'QR Studio', icon: QrCode },
  ];

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-slate-50/50">
      {/* ── Navigation: Desktop Sidebar / Mobile Tabs ── */}
      <div className="flex-shrink-0 lg:w-72 bg-white border-b lg:border-r border-slate-200 lg:h-full z-10 flex flex-col">
        <div className="p-6 hidden lg:block border-b border-slate-100">
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Workspace</h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Configuration</p>
        </div>
        
        {/* Nav list - Horizontal on mobile, vertical on desktop */}
        <nav className="flex lg:flex-col overflow-x-auto lg:overflow-y-auto hide-scrollbar p-2 lg:p-4 gap-1 lg:gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.locked && setActiveTab(tab.id as any)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all whitespace-nowrap min-w-max lg:min-w-0 ${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                  : tab.locked 
                    ? 'text-slate-300 cursor-not-allowed grayscale' 
                    : 'text-slate-600 hover:bg-slate-50 active:scale-[0.98]'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${activeTab === tab.id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                <tab.icon size={16} />
              </div>
              <span className="flex-1 text-left">{tab.label}</span>
              {tab.locked && <Lock size={12} className="opacity-40" />}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Content Area ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto p-4 md:p-8 lg:p-12">
          
          <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 capitalize">{activeTab} Tools</h1>
                <p className="text-slate-500 font-medium mt-1">Manage your venue's core settings and preferences.</p>
             </div>
             
             {/* Dynamic Status Badges */}
             <div className="flex items-center gap-2">
               {successMessage && (
                 <div className="animate-in fade-in slide-in-from-right-4 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 text-xs font-bold border border-emerald-500/20 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {successMessage}
                 </div>
               )}
               {errorMessage && (
                 <div className="animate-in fade-in slide-in-from-right-4 px-4 py-2 rounded-xl bg-red-500/10 text-red-600 text-xs font-bold border border-red-500/20">
                    ✕ {errorMessage}
                 </div>
               )}
             </div>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* --- BUSINESS PROFILE TAB --- */}
            {activeTab === 'business' && (
              <div className="space-y-6">
                <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                  <div className="mb-8">
                    <h3 className="text-xl font-bold text-slate-900">Brand Identity</h3>
                    <p className="text-sm text-slate-500 font-medium mt-1 leading-relaxed">This identity is visible across your digital menu and physical invoices.</p>
                  </div>
                  
                  <form onSubmit={handleBusinessSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Business Name</label>
                      <input name="businessName" defaultValue={business?.businessName} required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Venue URL Slug</label>
                      <div className="relative group/slug">
                        <input name="slug" defaultValue={business?.slug} required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all pr-12" />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">/order</span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 italic">restoflow.com/order/<span className="text-blue-500 font-black">{business?.slug}</span></p>
                    </div>

                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Tagline / Public Description</label>
                      <textarea name="description" defaultValue={business?.description || ''} rows={3} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-semibold text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none" placeholder="A brief hook for your customers..." />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Logo URL</label>
                      <input name="logoUrl" type="url" defaultValue={business?.logoUrl || ''} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-semibold text-slate-900 focus:bg-white" placeholder="https://..." />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Hero Cover URL</label>
                      <input name="coverImageUrl" type="url" defaultValue={business?.coverImageUrl || ''} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-semibold text-slate-900 focus:bg-white" placeholder="https://..." />
                    </div>

                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 mt-2 border-t border-slate-100">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Public Support Email</label>
                        <input name="email" defaultValue={business?.email || ''} type="email" required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-900 focus:bg-white" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Business Phone</label>
                        <input name="phone" defaultValue={business?.phone || ''} required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-900 focus:bg-white" />
                      </div>
                    </div>

                    <div className="md:col-span-2 flex justify-end pt-4">
                      <button type="submit" disabled={businessMutation.isPending} className="bg-slate-900 text-white font-bold py-4 px-10 rounded-2xl flex items-center gap-2 hover:bg-slate-800 active:scale-95 transition-all shadow-xl shadow-slate-900/10 disabled:opacity-50">
                        <Save size={18} /> Sync Account Details
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* --- MENU & TAX TAB --- */}
            {activeTab === 'menu' && (
              <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-slate-900">Taxation & Regional</h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">Configure global tax rates applied to all orders.</p>
                </div>
                <form onSubmit={handleBusinessSave} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Currency Symbol</label>
                    <input name="currencySymbol" defaultValue={business?.currencySymbol || '₹'} required className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-2xl text-slate-900 focus:bg-white focus:border-emerald-500 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Default Tax Rate (%)</label>
                    <div className="relative">
                      <input name="taxRate" type="number" step="0.1" defaultValue={business?.taxRate ?? 5} required className="w-full p-5 pr-12 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-2xl text-slate-900 focus:bg-white focus:border-emerald-500 transition-all" />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-slate-400">%</span>
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">GSTIN / Tax Registration Number</label>
                    <input name="gstin" defaultValue={business?.gstin || ''} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-xl text-slate-900 focus:bg-white focus:border-emerald-500 uppercase transition-all" placeholder="REGISTRATION NUMBER" />
                    <p className="text-[10px] font-bold text-slate-400 italic">This will appear on every customer invoice for compliance.</p>
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <button type="submit" disabled={businessMutation.isPending} className="bg-emerald-600 text-white font-bold py-4 px-10 rounded-2xl flex items-center gap-2 hover:bg-emerald-700 active:scale-95 transition-all shadow-xl shadow-emerald-600/10">
                      <Save size={18} /> Update Regional Profile
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* --- HOURS TAB --- */}
            {activeTab === 'hours' && (
              <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-orange-500" />
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-slate-900">Service Hours</h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">Venue status is strictly enforced for automated QR ordering.</p>
                </div>
                <div className="space-y-3">
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                    <div key={day} className={`flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-2xl border transition-all ${hours[day]?.isOpen ? 'bg-slate-50 border-slate-100' : 'bg-slate-50/50 border-dashed border-slate-200 opacity-60'}`}>
                      <div className="w-32 flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={hours[day]?.isOpen}
                            onChange={e => setHours({...hours, [day]: {...hours[day], isOpen: e.target.checked}})}
                          />
                          <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                        <span className="font-black text-slate-700 capitalize text-sm">{day}</span>
                      </div>
                      
                      {hours[day]?.isOpen ? (
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex items-center gap-2 flex-1 max-w-[140px]">
                            <Clock size={14} className="text-slate-400" />
                            <input 
                              type="time" 
                              value={hours[day].open} 
                              onChange={e => setHours({...hours, [day]: {...hours[day], open: e.target.value}})}
                              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-black text-slate-700 outline-none focus:border-orange-500 w-full" 
                            />
                          </div>
                          <span className="text-slate-400 font-black text-[10px] uppercase tracking-widest">UNTIL</span>
                          <div className="flex items-center gap-2 flex-1 max-w-[140px]">
                            <Clock size={14} className="text-slate-400" />
                            <input 
                              type="time" 
                              value={hours[day].close} 
                              onChange={e => setHours({...hours, [day]: {...hours[day], close: e.target.value}})}
                              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-black text-slate-700 outline-none focus:border-orange-500 w-full" 
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest flex-1">Facility Closed</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-8">
                   <button onClick={handleHoursSave} disabled={businessMutation.isPending} className="bg-orange-600 text-white font-bold py-4 px-10 rounded-2xl flex items-center gap-2 hover:bg-orange-700 active:scale-95 transition-all shadow-xl shadow-orange-600/10">
                      <Clock size={18} /> Broadcast Operating Hours
                    </button>
                </div>
              </div>
            )}

            {/* --- STAFF TAB --- */}
            {activeTab === 'staff' && (
              <div className="space-y-8">
                 <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                    <div className="mb-8">
                      <h3 className="text-xl font-bold text-slate-900">Add Team Member</h3>
                      <p className="text-sm text-slate-500 font-medium mt-1">Provision new access for waiters, kitchen, or managers.</p>
                    </div>
                    <form onSubmit={handleStaffAdd} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Full Name</label>
                        <input value={staffForm.name} onChange={e => setStaffForm({...staffForm, name: e.target.value})} required placeholder="e.g. Rahul Singh" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-900 focus:bg-white" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Workspace Role</label>
                        <select value={staffForm.role} onChange={e => setStaffForm({...staffForm, role: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-900 focus:bg-white appearance-none">
                           <option value="WAITER">Waiter Ops</option>
                           <option value="KITCHEN">Kitchen / KDS</option>
                           <option value="MANAGER">Store Manager</option>
                        </select>
                      </div>
                      <div className="space-y-1.5 opacity-60">
                         <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Generated Handle</label>
                         <input value={staffForm.username} readOnly className="w-full p-4 bg-slate-100 border border-transparent rounded-2xl outline-none font-mono text-xs font-bold text-slate-500" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Default Password</label>
                        <div className="relative">
                          <input type="password" value={staffForm.password} onChange={e => setStaffForm({...staffForm, password: e.target.value})} required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-900 focus:bg-white pr-12" />
                          <KeyRound size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        </div>
                      </div>
                      <div className="md:col-span-2 flex justify-end">
                        <button type="submit" disabled={staffMutation.isPending} className="bg-indigo-600 text-white font-bold py-4 px-10 rounded-2xl flex items-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all shadow-xl shadow-indigo-600/10">
                           <Plus size={18} /> Provision Access
                        </button>
                      </div>
                    </form>
                 </div>

                 <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                       <h3 className="font-black text-slate-900">Active Directory</h3>
                    </div>
                    <div className="divide-y divide-slate-50">
                       {staff?.length === 0 ? (
                         <div className="p-12 text-center text-slate-400 font-bold italic">No secondary staff provisioned yet.</div>
                       ) : staff?.map((member: any) => (
                         <div key={member.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-all">
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 font-black">
                                  {member.name.charAt(0)}
                               </div>
                               <div>
                                  <p className="font-bold text-slate-900">{member.name}</p>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{member.role} • {member.username}</p>
                               </div>
                            </div>
                            <button onClick={() => deleteStaffMutation.mutate(member.id)} className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                               <Trash2 size={18} />
                            </button>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
            )}

            {/* --- QR STUDIO TAB --- */}
            {activeTab === 'qr' && (
              <div className="flex flex-col xl:flex-row gap-8">
                 <div className="flex-1 space-y-8">
                    <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-1 h-full bg-slate-900" />
                       <div className="mb-8">
                          <h3 className="text-xl font-bold text-slate-900">Module Aesthetics</h3>
                          <p className="text-sm text-slate-500 font-medium mt-1">Fine-tune the appearance of generated table assets.</p>
                       </div>
                       
                       <div className="space-y-8">
                          <div className="grid grid-cols-2 gap-6">
                             <div className="space-y-3">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 pl-1">Primary Grid</label>
                                <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                                   <input type="color" value={qrConfig.fgColor} onChange={e => setQrConfig({...qrConfig, fgColor: e.target.value})} className="w-12 h-12 rounded-xl cursor-pointer border-0 p-0 shadow-sm" />
                                   <input type="text" value={qrConfig.fgColor} onChange={e => setQrConfig({...qrConfig, fgColor: e.target.value})} className="flex-1 bg-transparent border-0 font-mono font-black text-xs outline-none uppercase" />
                                </div>
                             </div>
                             <div className="space-y-3">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 pl-1">Canvas Fill</label>
                                <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                                   <input type="color" value={qrConfig.bgColor} onChange={e => setQrConfig({...qrConfig, bgColor: e.target.value})} className="w-12 h-12 rounded-xl cursor-pointer border-0 p-0 shadow-sm" />
                                   <input type="text" value={qrConfig.bgColor} onChange={e => setQrConfig({...qrConfig, bgColor: e.target.value})} className="flex-1 bg-transparent border-0 font-mono font-black text-xs outline-none uppercase" />
                                </div>
                             </div>
                          </div>

                          <div className="pt-6 border-t border-slate-100">
                             <label className="group flex items-center justify-between p-5 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 cursor-pointer transition-all">
                                <div>
                                   <p className="font-bold text-slate-900">Perceptual Watermarking</p>
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Embed venue icon for security</p>
                                </div>
                                <input type="checkbox" checked={qrConfig.includeLogo} onChange={e => setQrConfig({...qrConfig, includeLogo: e.target.checked})} className="w-6 h-6 text-slate-900 rounded-lg border-slate-300 focus:ring-0" />
                             </label>
                          </div>

                          <div className="space-y-3">
                             <label className="text-xs font-black uppercase tracking-widest text-slate-400 pl-1">Canvas Signature</label>
                             <input type="text" value={qrConfig.watermarkText} onChange={e => setQrConfig({...qrConfig, watermarkText: e.target.value})} placeholder="e.g. Scan to Pay" className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-sm uppercase focus:bg-white transition-all shadow-inner" />
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Premium Live Preview Pane */}
                 <div className="xl:w-[380px] flex-shrink-0">
                    <div className="sticky top-8 space-y-6">
                       <div className="bg-slate-900 p-10 rounded-[2.5rem] flex flex-col items-center shadow-[0_40px_80px_-15px_rgba(15,23,42,0.3)] relative group">
                          <div className="absolute top-6 left-1/2 -translate-x-1/2 w-12 h-1 bg-slate-800 rounded-full" />
                          <div className="mt-8 bg-white p-6 rounded-3xl shadow-2xl flex flex-col items-center" style={{ backgroundColor: qrConfig.bgColor }}>
                             <QRCodeSVG 
                                value="https://restoflow.com/preview" 
                                size={220}
                                level="H"
                                fgColor={qrConfig.fgColor}
                                bgColor={qrConfig.bgColor}
                                includeMargin={false}
                             />
                             <div className="mt-8 flex flex-col items-center justify-center w-full">
                                <span className="text-2xl font-black tracking-tighter text-center leading-none" style={{ color: qrConfig.fgColor }}>
                                   {business?.businessName || 'VENUE IDENTITY'}
                                </span>
                                <div className="mt-3 flex items-center gap-2 overflow-hidden">
                                   <div className="h-[1px] w-4 bg-slate-200" style={{ backgroundColor: `${qrConfig.fgColor}33` }} />
                                   <span className="text-[9px] font-black tracking-[0.2em] uppercase whitespace-nowrap" style={{ color: qrConfig.fgColor }}>
                                      {qrConfig.watermarkText || 'RESERVED TABLE'}
                                   </span>
                                   <div className="h-[1px] w-4 bg-slate-200" style={{ backgroundColor: `${qrConfig.fgColor}33` }} />
                                </div>
                             </div>
                          </div>
                          
                          <div className="mt-12 w-full space-y-1 text-center">
                             <p className="text-white text-xs font-black uppercase tracking-widest">Physical Rendering Preview</p>
                             <p className="text-slate-400 text-[10px] font-medium leading-relaxed">System applies these perceptual layers to all generated PDF/SVG exports.</p>
                          </div>
                       </div>
                       
                       <div className="p-6 rounded-3xl bg-blue-500/5 border border-blue-500/10 flex items-start gap-3">
                          <QrCode className="text-blue-500 mt-1" size={18} />
                          <p className="text-xs font-bold text-blue-600/80 leading-relaxed italic">PRO TIP: Use high-contrast colors for your primary grid to ensure 100% scanner homography on older mobile devices.</p>
                       </div>
                    </div>
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
