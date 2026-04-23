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
  return `${handle}@${tenant}.BHOJFLOW`;
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

const DEFAULT_QR_CONFIG = {
  fgColor: '#0f172a',
  bgColor: '#ffffff',
};

const QR_PRESETS = [
  { label: 'Classic Ink', fgColor: '#0f172a', bgColor: '#ffffff' },
  { label: 'Royal Blue', fgColor: '#1d4ed8', bgColor: '#ffffff' },
  { label: 'Midnight Card', fgColor: '#f8fafc', bgColor: '#0f172a' },
];

const CUSTOMER_SITE_PRESETS = [
  {
    id: 'warm-bistro',
    label: 'Warm Bistro',
    description: 'Bright, energetic, and good for fast-moving restaurants.',
    primaryColor: '#FF6B35',
    accentColor: '#1E293B',
  },
  {
    id: 'cafe-blue',
    label: 'Cafe Blue',
    description: 'Clean and calm with a stronger premium cafe tone.',
    primaryColor: '#2563EB',
    accentColor: '#0F172A',
  },
  {
    id: 'lounge-emerald',
    label: 'Emerald Lounge',
    description: 'Richer hospitality look for dine-in and hotel-style menus.',
    primaryColor: '#059669',
    accentColor: '#111827',
  },
  {
    id: 'royal-plum',
    label: 'Royal Plum',
    description: 'A darker premium contrast for upscale dining brands.',
    primaryColor: '#B45309',
    accentColor: '#312E81',
  },
];

function readQrConfig() {
  if (typeof window === 'undefined') return DEFAULT_QR_CONFIG;
  try {
    const saved = localStorage.getItem('rf_qr_style');
    if (!saved) return DEFAULT_QR_CONFIG;
    const parsed = JSON.parse(saved);
    return {
      fgColor:
        parsed && typeof parsed === 'object' && typeof parsed.fgColor === 'string'
          ? parsed.fgColor
          : DEFAULT_QR_CONFIG.fgColor,
      bgColor:
        parsed && typeof parsed === 'object' && typeof parsed.bgColor === 'string'
          ? parsed.bgColor
          : DEFAULT_QR_CONFIG.bgColor,
    };
  } catch {
    return DEFAULT_QR_CONFIG;
  }
}

export function Settings() {
  const queryClient = useQueryClient();
  const { plan } = usePlanFeatures();
  const [activeTab, setActiveTab] = useState<'business' | 'menu' | 'staff' | 'qr' | 'hours'>('business');
  
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Queries
  const { data: business, isLoading: loadingBusiness, error: businessError } = useQuery({
    queryKey: ['settings-business'],
    queryFn: async () => (await api.get('/settings/business')).data,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const { data: staff, isLoading: loadingStaff } = useQuery({
    queryKey: ['settings-staff'],
    queryFn: async () => (await api.get('/settings/staff')).data,
    enabled: activeTab === 'staff' && plan !== 'MINI',
    staleTime: 1000 * 60,
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


  // Business Hours State
  const [hours, setHours] = useState<any>(DEFAULT_HOURS);
  
  // QR Studio State
  const [qrConfig, setQrConfig] = useState(() => readQrConfig());
  const [customerSitePalette, setCustomerSitePalette] = useState({
    primaryColor: '#FF6B35',
    accentColor: '#1E293B',
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
    setCustomerSitePalette({
      primaryColor: typeof business?.primaryColor === 'string' && business.primaryColor.trim() ? business.primaryColor : '#FF6B35',
      accentColor: typeof business?.accentColor === 'string' && business.accentColor.trim() ? business.accentColor : '#1E293B',
    });
  }, [business?.accentColor, business?.primaryColor]);

  useEffect(() => {
    const slug = business?.slug || 'restaurant';
    if (!staffForm.name.trim()) return;
    setStaffForm((previous) => {
      const nextUsername = buildUsername(previous.name, slug);
      const nextEmployeeCode = buildEmployeeCode(previous.name, slug);
      if (previous.username === nextUsername && previous.employeeCode === nextEmployeeCode) {
        return previous;
      }
      return { ...previous, username: nextUsername, employeeCode: nextEmployeeCode };
    });
  }, [business?.slug, staffForm.name]);

  const handleBusinessSave = (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload: any = {};
    
    // Define all possible fields
    const fields = [
      'businessName', 'slug', 'email', 'phone', 'gstin', 'description', 
      'logoUrl', 'coverImageUrl', 'primaryColor', 'accentColor', 'currencySymbol', 'upiId'
    ];
    
    fields.forEach(field => {
      const val = formData.get(field);
      if (val !== null) payload[field] = val;
    });

    payload.primaryColor = customerSitePalette.primaryColor;
    payload.accentColor = customerSitePalette.accentColor;

    const taxRateVal = formData.get('taxRate');
    if (taxRateVal !== null) {
      payload.taxRate = parseFloat(taxRateVal as string) || 0;
    }

    payload.hasWaiterService = formData.get('hasWaiterService') === 'on';

    businessMutation.mutate(payload);
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

  const shouldLoadStaff = activeTab === 'staff' && plan !== 'MINI';

  if (loadingBusiness || (shouldLoadStaff && loadingStaff)) {
    return (
      <div
        className="flex min-h-[420px] items-center justify-center rounded-[2rem] border px-6 text-sm font-bold animate-pulse"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-3)' }}
      >
        Loading configuration...
      </div>
    );
  }

  if (!business && businessError) {
    return (
      <div
        className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-[2rem] border px-6 text-center"
        style={{ background: 'var(--surface)', borderColor: 'rgba(239,68,68,0.18)' }}
      >
        <h2 className="text-xl font-black" style={{ color: 'var(--text-1)' }}>
          Workspace details unavailable
        </h2>
        <p className="max-w-md text-sm font-medium" style={{ color: 'var(--text-3)' }}>
          We could not load business settings right now. Refresh once, then try again.
        </p>
      </div>
    );
  }

  const tabs: { id: string, label: string, icon: any, locked?: boolean }[] = [
    { id: 'business', label: 'Profile', icon: Settings2 },
    { id: 'menu', label: 'Menu & Tax', icon: Save },
    { id: 'hours', label: 'Business Hours', icon: Clock },
    { id: 'staff', label: 'Team', icon: ShieldCheck, locked: plan === 'MINI' },
    { id: 'qr', label: 'QR Studio', icon: QrCode },
  ];
  const activeCustomerPreset =
    CUSTOMER_SITE_PRESETS.find(
      (preset) =>
        preset.primaryColor.toLowerCase() === customerSitePalette.primaryColor.toLowerCase() &&
        preset.accentColor.toLowerCase() === customerSitePalette.accentColor.toLowerCase(),
    ) || null;

  return (
    <div
      className="settings-page flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[2rem] border lg:flex-row"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--card-shadow-hover)' }}
    >
      {/* ── Navigation: Desktop Sidebar / Mobile Tabs ── */}
      <div
        className="z-10 flex flex-shrink-0 flex-col border-b lg:h-full lg:w-72 lg:border-r"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
      >
        <div className="hidden border-b p-6 lg:block" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>Workspace</h2>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Configuration</p>
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
                    ? 'cursor-not-allowed grayscale' 
                    : 'hover:bg-white/5 active:scale-[0.98]'
              }`}
              style={
                activeTab === tab.id
                  ? undefined
                  : { color: tab.locked ? 'var(--text-3)' : 'var(--text-2)' }
              }
            >
              <div
                className={`p-1.5 rounded-lg ${activeTab === tab.id ? 'bg-white/20' : ''}`}
                style={activeTab === tab.id ? undefined : { background: 'var(--surface-3)', color: 'var(--text-3)' }}
              >
                <tab.icon size={16} />
              </div>
              <span className="flex-1 text-left">{tab.label}</span>
              {tab.locked && <Lock size={12} className="opacity-40" />}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Content Area ── */}
      <div className="custom-scrollbar flex-1 overflow-y-auto" style={{ background: 'var(--surface-2)' }}>
        <div className="mx-auto min-h-full max-w-4xl p-4 md:p-8 lg:p-12">
          
          <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div>
                <h1 className="text-3xl font-black tracking-tight capitalize" style={{ color: 'var(--text-1)' }}>{activeTab} Tools</h1>
                <p className="mt-1 font-medium" style={{ color: 'var(--text-3)' }}>Manage your venue&apos;s core settings and preferences.</p>
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
                <div className="p-6 md:p-8 rounded-[2rem] border shadow-sm relative overflow-hidden group" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                  <div className="mb-8">
                    <h3 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Brand Identity</h3>
                    <p className="mt-1 text-sm font-medium leading-relaxed" style={{ color: 'var(--text-3)' }}>This identity is visible across your digital menu and physical invoices.</p>
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
                      <p className="text-[10px] font-bold text-slate-400 italic">bhojflow.com/order/<span className="text-blue-500 font-black">{business?.slug}</span></p>
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

                    <div className="md:col-span-2 rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Customer Site Look</p>
                          <h4 className="mt-1 text-lg font-black text-slate-900">Control how guests experience your menu</h4>
                          <p className="mt-1 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
                            These colors carry through the customer menu, cart, tracker, and bill view. Pick a preset or fine-tune the palette.
                          </p>
                        </div>
                        <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                          {activeCustomerPreset ? activeCustomerPreset.label : 'Custom palette'}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-2">
                        {CUSTOMER_SITE_PRESETS.map((preset) => {
                          const isActive =
                            preset.primaryColor.toLowerCase() === customerSitePalette.primaryColor.toLowerCase() &&
                            preset.accentColor.toLowerCase() === customerSitePalette.accentColor.toLowerCase();
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() =>
                                setCustomerSitePalette({
                                  primaryColor: preset.primaryColor,
                                  accentColor: preset.accentColor,
                                })
                              }
                              className={`rounded-[1.5rem] border p-4 text-left transition-all ${
                                isActive ? 'scale-[1.01] shadow-lg shadow-slate-900/5' : 'hover:-translate-y-0.5'
                              }`}
                              style={{
                                borderColor: isActive ? preset.primaryColor : '#e2e8f0',
                                background: isActive ? `${preset.primaryColor}10` : '#ffffff',
                              }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-black text-slate-900">{preset.label}</p>
                                  <p className="mt-1 text-[12px] font-medium leading-relaxed text-slate-500">
                                    {preset.description}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: preset.primaryColor }} />
                                  <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: preset.accentColor }} />
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-widest text-slate-400">Primary Brand Color</label>
                          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                            <input
                              type="color"
                              name="primaryColor"
                              value={customerSitePalette.primaryColor}
                              onChange={(event) =>
                                setCustomerSitePalette((previous) => ({
                                  ...previous,
                                  primaryColor: event.target.value.toUpperCase(),
                                }))
                              }
                              className="h-12 w-12 cursor-pointer rounded-xl border-0 p-0"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-900">{customerSitePalette.primaryColor.toUpperCase()}</p>
                              <p className="text-[11px] font-medium text-slate-500">Main CTA, highlights, and menu emphasis</p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-widest text-slate-400">Accent / Contrast Color</label>
                          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                            <input
                              type="color"
                              name="accentColor"
                              value={customerSitePalette.accentColor}
                              onChange={(event) =>
                                setCustomerSitePalette((previous) => ({
                                  ...previous,
                                  accentColor: event.target.value.toUpperCase(),
                                }))
                              }
                              className="h-12 w-12 cursor-pointer rounded-xl border-0 p-0"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-900">{customerSitePalette.accentColor.toUpperCase()}</p>
                              <p className="text-[11px] font-medium text-slate-500">Depth, overlays, and premium contrast in the guest UI</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
                        <div
                          className="px-5 py-5 text-white"
                          style={{
                            backgroundImage: `linear-gradient(135deg, ${customerSitePalette.primaryColor}, ${customerSitePalette.accentColor})`,
                          }}
                        >
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Guest Preview</p>
                          <h5 className="mt-2 text-2xl font-black tracking-tight">{business?.businessName || 'Your venue'}</h5>
                          <p className="mt-1 max-w-md text-sm font-medium text-white/80">
                            Guests should feel the brand instantly, but ordering should still stay fast and readable.
                          </p>
                        </div>
                        <div className="space-y-4 p-5">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
                            Search dishes, combos, ingredients...
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span
                              className="rounded-full px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-white"
                              style={{ background: customerSitePalette.primaryColor }}
                            >
                              All
                            </span>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                              Veg
                            </span>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                              Non-Veg
                            </span>
                          </div>
                          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-black text-slate-900">Fast Cart CTA</p>
                                <p className="mt-1 text-[12px] font-medium text-slate-500">This is the action guests see right before placing the order.</p>
                              </div>
                              <button
                                type="button"
                                className="rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-white"
                                style={{
                                  backgroundImage: `linear-gradient(135deg, ${customerSitePalette.primaryColor}, ${customerSitePalette.accentColor})`,
                                }}
                              >
                                Review order
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
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

                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Restaurant UPI ID</label>
                        <input
                          name="upiId"
                          defaultValue={business?.upiId || ''}
                          placeholder="bhojflow@upi"
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-900 focus:bg-white"
                        />
                        <p className="text-[10px] font-bold text-slate-400">
                          Used for exact-amount online checkout links on the customer bill page.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Bill Delivery Style</label>
                        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <input
                            type="checkbox"
                            name="hasWaiterService"
                            defaultChecked={Boolean(business?.hasWaiterService)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <p className="text-sm font-black text-slate-900">Waiter brings the bill</p>
                            <p className="mt-1 text-[11px] font-semibold text-slate-500">
                              Turn this on if staff carry the bill to the table. Turn it off for counter-only payment.
                            </p>
                          </div>
                        </label>
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
              <div className="p-6 md:p-8 rounded-[2rem] border shadow-sm relative overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
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
              <div className="p-6 md:p-8 rounded-[2rem] border shadow-sm relative overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
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
                 <div className="p-6 md:p-8 rounded-[2rem] border shadow-sm relative overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
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

                 <div className="rounded-[2rem] border shadow-sm overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
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
                    <div className="p-6 md:p-8 rounded-[2rem] border shadow-sm relative overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                       <div className="absolute top-0 left-0 w-1 h-full bg-slate-900" />
                       <div className="mb-8">
                          <h3 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>QR Styling</h3>
                          <p className="mt-1 text-sm font-medium" style={{ color: 'var(--text-3)' }}>Fine-tune the appearance of generated table assets.</p>
                       </div>
                       
                       <div className="space-y-8">
                          <div className="space-y-3">
                             <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div>
                                   <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Quick presets</p>
                                   <p className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>Use a high-contrast pair so table scans stay readable on older phones.</p>
                                </div>
                             </div>
                             <div className="flex flex-wrap gap-2">
                                {QR_PRESETS.map((preset) => {
                                  const active = qrConfig.fgColor === preset.fgColor && qrConfig.bgColor === preset.bgColor;
                                  return (
                                    <button
                                      key={preset.label}
                                      onClick={() => setQrConfig({ fgColor: preset.fgColor, bgColor: preset.bgColor })}
                                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] transition-all ${
                                        active ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20' : ''
                                      }`}
                                      style={active ? undefined : { borderColor: 'var(--border)', background: 'var(--surface-3)', color: 'var(--text-2)' }}
                                    >
                                      <span className="flex items-center gap-1">
                                        <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: preset.fgColor }} />
                                        <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: preset.bgColor }} />
                                      </span>
                                      {preset.label}
                                    </button>
                                  );
                                })}
                             </div>
                          </div>

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

                          <div className="rounded-2xl border p-5" style={{ background: 'var(--surface-3)', borderColor: 'var(--border)' }}>
                             <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>QR copy is fixed</p>
                             <p className="mt-1 text-xs font-medium leading-relaxed" style={{ color: 'var(--text-3)' }}>
                                Every QR now prints <span style={{ color: 'var(--text-1)' }}>Scan me for order</span> at the top,
                                your venue name under the code, and a permanent <span style={{ color: 'var(--text-1)' }}>Powered by BHOJFLOW</span> footer.
                             </p>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Premium Live Preview Pane */}
                 <div className="xl:w-[380px] flex-shrink-0">
                    <div className="sticky top-8 space-y-6">
                       <div className="bg-slate-900 p-10 rounded-[2.5rem] flex flex-col items-center shadow-[0_40px_80px_-15px_rgba(15,23,42,0.3)] relative group">
                          <div className="absolute top-6 left-1/2 -translate-x-1/2 w-12 h-1 bg-slate-800 rounded-full" />
                          <div className="mt-8 p-6 rounded-3xl shadow-2xl flex flex-col items-center border" style={{ backgroundColor: qrConfig.bgColor, borderColor: `${qrConfig.fgColor}18` }}>
                             <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: qrConfig.fgColor, backgroundColor: `${qrConfig.fgColor}10` }}>
                                Scan me for order
                             </span>
                             <QRCodeSVG 
                                value="https://bhojflow.com/preview" 
                                size={220}
                                level="H"
                                fgColor={qrConfig.fgColor}
                                bgColor={qrConfig.bgColor}
                                includeMargin={false}
                             />
                             <div className="mt-8 flex flex-col items-center justify-center w-full max-w-[240px]">
                                <span className="text-[11px] font-black uppercase tracking-[0.22em] opacity-70" style={{ color: qrConfig.fgColor }}>
                                   Venue name
                                </span>
                                <span className="mt-2 text-2xl font-black tracking-tighter text-center leading-tight break-words" style={{ color: qrConfig.fgColor }}>
                                   {business?.businessName || 'VENUE IDENTITY'}
                                </span>
                                <div className="mt-3 h-px w-full" style={{ backgroundColor: `${qrConfig.fgColor}22` }} />
                                <span className="mt-3 rounded-full px-3 py-1 text-[10px] font-black tracking-[0.2em] uppercase whitespace-nowrap" style={{ color: qrConfig.fgColor, backgroundColor: `${qrConfig.fgColor}10` }}>
                                   Powered by BHOJFLOW
                                </span>
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
