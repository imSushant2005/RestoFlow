import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import {
  Save, Plus, Trash2, KeyRound, Clock, Settings2, ShieldCheck, QrCode, Lock,
  Building2, CreditCard, Users, Palette, CheckCircle2, AlertTriangle, ChevronDown, X,
  Phone, Mail, Receipt, Loader2,
} from 'lucide-react';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import { QRCodeSVG } from 'qrcode.react';

// ── Utilities ────────────────────────────────────────────────────────────────

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

const DEFAULT_QR_CONFIG = { fgColor: '#0f172a', bgColor: '#ffffff' };

const QR_PRESETS = [
  { label: 'Classic Ink', fgColor: '#0f172a', bgColor: '#ffffff' },
  { label: 'Royal Blue', fgColor: '#1d4ed8', bgColor: '#ffffff' },
  { label: 'Midnight', fgColor: '#f8fafc', bgColor: '#0f172a' },
];

const CUSTOMER_SITE_PRESETS = [
  { id: 'warm-bistro', label: 'Warm Bistro', description: 'Energetic, bright, fast-casual.', primaryColor: '#FF6B35', accentColor: '#1E293B' },
  { id: 'cafe-blue', label: 'Cafe Blue', description: 'Clean, calm premium cafe tone.', primaryColor: '#2563EB', accentColor: '#0F172A' },
  { id: 'lounge-emerald', label: 'Emerald Lounge', description: 'Hospitality look for dine-in.', primaryColor: '#059669', accentColor: '#111827' },
  { id: 'royal-plum', label: 'Royal Plum', description: 'Dark premium contrast for upscale.', primaryColor: '#B45309', accentColor: '#312E81' },
];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

function readQrConfig() {
  if (typeof window === 'undefined') return DEFAULT_QR_CONFIG;
  try {
    const saved = localStorage.getItem('rf_qr_style');
    if (!saved) return DEFAULT_QR_CONFIG;
    const parsed = JSON.parse(saved);
    return {
      fgColor: typeof parsed?.fgColor === 'string' ? parsed.fgColor : DEFAULT_QR_CONFIG.fgColor,
      bgColor: typeof parsed?.bgColor === 'string' ? parsed.bgColor : DEFAULT_QR_CONFIG.bgColor,
    };
  } catch {
    return DEFAULT_QR_CONFIG;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'business' | 'menu' | 'hours' | 'staff' | 'qr';

// ── Main Component ────────────────────────────────────────────────────────────

export function Settings() {
  const queryClient = useQueryClient();
  const { plan } = usePlanFeatures();
  const [activeTab, setActiveTab] = useState<TabId>('business');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

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
    staleTime: 60_000,
  });

  // Form states
  const [staffForm, setStaffForm] = useState({ name: '', username: '', employeeCode: '', role: 'WAITER', password: '' });
  const [hours, setHours] = useState<any>(DEFAULT_HOURS);
  const [qrConfig, setQrConfig] = useState(readQrConfig);
  const [palette, setPalette] = useState({ primaryColor: '#FF6B35', accentColor: '#1E293B' });

  // Sync hours from server
  useEffect(() => {
    if (!business?.businessHours) return;
    try {
      const parsed = typeof business.businessHours === 'string'
        ? JSON.parse(business.businessHours)
        : business.businessHours;
      setHours(parsed);
    } catch { /* keep default */ }
  }, [business?.businessHours]);

  // Sync palette from server
  useEffect(() => {
    setPalette({
      primaryColor: typeof business?.primaryColor === 'string' && business.primaryColor.trim() ? business.primaryColor : '#FF6B35',
      accentColor: typeof business?.accentColor === 'string' && business.accentColor.trim() ? business.accentColor : '#1E293B',
    });
  }, [business?.primaryColor, business?.accentColor]);

  // Persist QR config
  useEffect(() => {
    localStorage.setItem('rf_qr_style', JSON.stringify(qrConfig));
  }, [qrConfig]);

  // Auto-generate staff username / code
  useEffect(() => {
    const slug = business?.slug || 'restaurant';
    if (!staffForm.name.trim()) return;
    setStaffForm((prev) => {
      const nextUsername = buildUsername(prev.name, slug);
      const nextEmployeeCode = buildEmployeeCode(prev.name, slug);
      if (prev.username === nextUsername && prev.employeeCode === nextEmployeeCode) return prev;
      return { ...prev, username: nextUsername, employeeCode: nextEmployeeCode };
    });
  }, [business?.slug, staffForm.name]);

  // Mutations
  const showSuccess = useCallback((msg: string) => {
    setErrorMsg('');
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  }, []);

  const businessMutation = useMutation({
    mutationFn: (data: any) => api.patch('/settings/business', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-business'] });
      showSuccess('Settings saved successfully.');
    },
    onError: (err: any) => setErrorMsg(err.response?.data?.error || 'Failed to update settings.'),
  });

  const staffMutation = useMutation({
    mutationFn: (data: any) => api.post('/settings/staff', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-staff'] });
      showSuccess('Staff member created.');
      setStaffForm({ name: '', username: '', employeeCode: '', role: 'WAITER', password: '' });
    },
    onError: (err: any) => setErrorMsg(err.response?.data?.error || 'Failed to create staff.'),
  });

  const deleteStaffMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/staff/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings-staff'] }),
  });

  // Handlers
  const handleBusinessSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const fields = ['businessName', 'slug', 'email', 'phone', 'gstin', 'description', 'logoUrl', 'coverImageUrl', 'currencySymbol', 'upiId'];
    const payload: any = {};
    fields.forEach((f) => { const v = fd.get(f); if (v !== null) payload[f] = v; });
    payload.primaryColor = palette.primaryColor;
    payload.accentColor = palette.accentColor;
    const taxRateVal = fd.get('taxRate');
    if (taxRateVal !== null) payload.taxRate = parseFloat(taxRateVal as string) || 0;
    payload.hasWaiterService = fd.get('hasWaiterService') === 'on';
    businessMutation.mutate(payload);
  };

  const handleStaffAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    staffMutation.mutate({
      name: staffForm.name.trim(),
      username: staffForm.username.trim() || buildUsername(staffForm.name, business?.slug),
      employeeCode: staffForm.employeeCode.trim() || buildEmployeeCode(staffForm.name, business?.slug),
      role: staffForm.role,
      password: staffForm.password,
    });
  };

  // Tabs config
  const tabs: { id: TabId; label: string; icon: React.ElementType; accent: string; locked?: boolean }[] = [
    { id: 'business', label: 'Business Profile', icon: Building2, accent: 'text-blue-400' },
    { id: 'menu', label: 'Tax & Regional', icon: CreditCard, accent: 'text-emerald-400' },
    { id: 'hours', label: 'Business Hours', icon: Clock, accent: 'text-orange-400' },
    { id: 'staff', label: 'Team Access', icon: Users, accent: 'text-indigo-400', locked: plan === 'MINI' },
    { id: 'qr', label: 'QR Studio', icon: QrCode, accent: 'text-purple-400' },
  ];

  const activeTabMeta = tabs.find((t) => t.id === activeTab)!;

  // Loading / error states
  if (loadingBusiness || (activeTab === 'staff' && plan !== 'MINI' && loadingStaff)) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center gap-3">
        <Loader2 size={22} className="animate-spin text-blue-500" />
        <p className="text-sm font-bold text-slate-400">Loading configuration…</p>
      </div>
    );
  }

  if (!business && businessError) {
    return (
      <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="h-14 w-14 rounded-2xl bg-rose-500/10 flex items-center justify-center">
          <AlertTriangle size={24} className="text-rose-400" />
        </div>
        <h2 className="text-xl font-black text-white">Settings unavailable</h2>
        <p className="max-w-xs text-sm font-medium text-slate-400">
          We could not load your workspace configuration. Please refresh and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col lg:flex-row lg:gap-0 lg:overflow-hidden lg:h-[calc(100dvh-4rem)]">

      {/* ── Mobile nav trigger ── */}
      <button
        onClick={() => setMobileNavOpen(true)}
        className="flex items-center gap-3 rounded-2xl border border-white/5 bg-slate-900/80 px-4 py-3.5 mb-3 lg:hidden"
      >
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 ${activeTabMeta.accent}`}>
          <activeTabMeta.icon size={16} />
        </div>
        <span className="flex-1 text-left text-sm font-black text-white">{activeTabMeta.label}</span>
        <ChevronDown size={16} className="text-slate-500" />
      </button>

      {/* ── Mobile nav sheet ── */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileNavOpen(false)}
              className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 35 }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-[2rem] border-t border-white/10 bg-slate-900 p-5 pb-8 lg:hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                  Settings
                </p>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-800 text-slate-500"
                >
                  <X size={16} />
                </button>
              </div>
              <nav className="space-y-1.5">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (!tab.locked) { setActiveTab(tab.id); setMobileNavOpen(false); }
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all ${activeTab === tab.id
                        ? 'bg-blue-600 text-white'
                        : tab.locked
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-white/5 text-slate-300'
                      }`}
                  >
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${activeTab === tab.id ? 'bg-white/20' : 'bg-slate-800'
                      } ${activeTab === tab.id ? 'text-white' : tab.accent}`}>
                      <tab.icon size={17} />
                    </div>
                    <span className="flex-1 text-sm font-black">{tab.label}</span>
                    {tab.locked && <Lock size={13} className="opacity-50" />}
                  </button>
                ))}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex lg:w-[260px] xl:w-[280px] lg:flex-shrink-0 lg:flex-col lg:h-full lg:border-r lg:border-white/5 lg:bg-slate-950/40">
        {/* Sidebar header */}
        <div className="px-5 py-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-600/15 flex items-center justify-center">
              <Settings2 size={18} className="text-blue-400" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">
                Workspace
              </p>
              <h2 className="text-base font-black text-white">Settings</h2>
            </div>
          </div>
        </div>

        {/* Sidebar nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.locked && setActiveTab(tab.id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-all ${activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                  : tab.locked
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'
                }`}
            >
              <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-all ${activeTab === tab.id ? 'bg-white/20 text-white' : `bg-slate-900 ${tab.accent}`
                }`}>
                <tab.icon size={15} />
              </div>
              <span className="flex-1 text-[13px] font-black">{tab.label}</span>
              {tab.locked && <Lock size={11} className="opacity-50" />}
            </button>
          ))}
        </nav>

        {/* Sidebar footer status */}
        <div className="p-4 border-t border-white/5">
          <div className="rounded-2xl bg-slate-900/60 p-3 space-y-2">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Workspace Status</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Plan', value: plan || 'ACTIVE' },
                { label: 'UPI', value: business?.upiId ? '✓ Set' : '—' },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-slate-950/60 px-2 py-2">
                  <p className="text-[8px] font-black uppercase text-slate-600">{s.label}</p>
                  <p className="text-[11px] font-black text-white mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* ── Content pane ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-4 pb-20 lg:p-8 lg:pb-10 space-y-5">

          {/* Section header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={`text-[9px] font-black uppercase tracking-[0.22em] ${activeTabMeta.accent}`}>
                {activeTabMeta.label}
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
                {activeTab === 'business' && 'Brand & Identity'}
                {activeTab === 'menu' && 'Tax & Regional'}
                {activeTab === 'hours' && 'Service Hours'}
                {activeTab === 'staff' && plan === 'MINI' && 'Team Access (Locked)'}
                {activeTab === 'staff' && plan !== 'MINI' && 'Team Management'}
                {activeTab === 'qr' && 'QR Studio'}
              </h1>
            </div>

            {/* Feedback toasts */}
            <AnimatePresence>
              {successMsg && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-400"
                >
                  <CheckCircle2 size={13} />
                  {successMsg}
                </motion.div>
              )}
              {errorMsg && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs font-bold text-rose-400"
                >
                  <AlertTriangle size={13} />
                  {errorMsg}
                  <button onClick={() => setErrorMsg('')} className="ml-1 opacity-60 hover:opacity-100">
                    <X size={11} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Tab content ── */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >

              {/* ───────────────── BUSINESS PROFILE ───────────────── */}
              {activeTab === 'business' && (
                <form onSubmit={handleBusinessSave} className="space-y-5">

                  {/* Brand basics */}
                  <Card accent="bg-blue-500">
                    <SectionTitle icon={<Building2 size={16} />} title="Brand Identity" subtitle="Visible across your digital menu and invoices." />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Business Name">
                        <Input name="businessName" defaultValue={business?.businessName} required placeholder="My Restaurant" />
                      </Field>
                      <Field label="URL Slug">
                        <div className="relative">
                          <Input name="slug" defaultValue={business?.slug} required placeholder="my-restaurant" />
                          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-600">/order</span>
                        </div>
                        {business?.slug && (
                          <p className="mt-1 text-[10px] font-semibold text-slate-500">
                            bhojflow.com/order/<span className="text-blue-400 font-bold">{business.slug}</span>
                          </p>
                        )}
                      </Field>
                      <Field label="Tagline / Description" className="sm:col-span-2">
                        <textarea
                          name="description"
                          defaultValue={business?.description || ''}
                          rows={3}
                          placeholder="A short description for your guests…"
                          className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-blue-500/50 resize-none"
                        />
                      </Field>
                      <Field label="Logo URL">
                        <Input name="logoUrl" type="url" defaultValue={business?.logoUrl || ''} placeholder="https://…" />
                      </Field>
                      <Field label="Cover Image URL">
                        <Input name="coverImageUrl" type="url" defaultValue={business?.coverImageUrl || ''} placeholder="https://…" />
                      </Field>
                    </div>
                  </Card>

                  {/* Contact details */}
                  <Card accent="bg-blue-500">
                    <SectionTitle icon={<Phone size={16} />} title="Contact Details" subtitle="Shown on customer-facing pages and invoices." />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Support Email">
                        <div className="relative">
                          <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                          <Input name="email" type="email" defaultValue={business?.email || ''} required placeholder="hello@myrestaurant.com" className="pl-10" />
                        </div>
                      </Field>
                      <Field label="Business Phone">
                        <div className="relative">
                          <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                          <Input name="phone" defaultValue={business?.phone || ''} required placeholder="+91 98765 43210" className="pl-10" />
                        </div>
                      </Field>
                      <Field label="UPI ID" className="sm:col-span-2">
                        <Input name="upiId" defaultValue={business?.upiId || ''} placeholder="yourname@upi" />
                        <p className="mt-1 text-[10px] font-semibold text-slate-500">
                          Used for exact-amount checkout links on the customer bill page.
                        </p>
                      </Field>
                    </div>
                  </Card>

                  {/* Bill delivery */}
                  <Card accent="bg-blue-500">
                    <SectionTitle icon={<Receipt size={16} />} title="Bill Delivery Style" subtitle="Controls how customers request and receive their bill." />
                    <label className="flex items-start gap-4 cursor-pointer rounded-2xl border border-white/10 bg-slate-950/40 p-4 hover:border-blue-500/30 transition-colors">
                      <input
                        type="checkbox"
                        name="hasWaiterService"
                        defaultChecked={Boolean(business?.hasWaiterService)}
                        className="mt-0.5 h-4 w-4 rounded bg-slate-800 border-slate-600 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <p className="text-sm font-black text-white">Waiter brings the bill</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                          Enable this if staff carry the bill to the table. Disable for counter-only payment.
                        </p>
                      </div>
                    </label>
                  </Card>

                  {/* Customer site palette */}
                  <Card accent="bg-purple-500">
                    <SectionTitle icon={<Palette size={16} />} title="Customer Site Look" subtitle="Colors applied to the guest menu, cart, and bill view." />

                    {/* Presets */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {CUSTOMER_SITE_PRESETS.map((preset) => {
                        const isActive =
                          preset.primaryColor.toLowerCase() === palette.primaryColor.toLowerCase() &&
                          preset.accentColor.toLowerCase() === palette.accentColor.toLowerCase();
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setPalette({ primaryColor: preset.primaryColor, accentColor: preset.accentColor })}
                            className={`relative flex items-start gap-3 rounded-2xl border p-4 text-left transition-all ${isActive ? 'border-blue-500/50 bg-blue-500/8 shadow-lg shadow-blue-900/20' : 'border-white/5 bg-slate-950/40 hover:border-white/10'
                              }`}
                          >
                            <div className="flex gap-1 flex-shrink-0 mt-0.5">
                              <span className="h-5 w-5 rounded-full border border-white/10" style={{ background: preset.primaryColor }} />
                              <span className="h-5 w-5 rounded-full border border-white/10" style={{ background: preset.accentColor }} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-black text-white">{preset.label}</p>
                              <p className="text-[10px] font-medium text-slate-500 mt-0.5 leading-relaxed">{preset.description}</p>
                            </div>
                            {isActive && (
                              <CheckCircle2 size={15} className="text-blue-400 absolute top-3 right-3" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom color pickers */}
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <Field label="Primary Brand Color">
                        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
                          <input
                            type="color"
                            value={palette.primaryColor}
                            onChange={(e) => setPalette((p) => ({ ...p, primaryColor: e.target.value.toUpperCase() }))}
                            className="h-10 w-10 cursor-pointer rounded-lg border-0 p-0"
                          />
                          <div>
                            <p className="text-sm font-black text-white">{palette.primaryColor.toUpperCase()}</p>
                            <p className="text-[10px] text-slate-500">CTA, highlights, emphasis</p>
                          </div>
                        </div>
                      </Field>
                      <Field label="Accent / Contrast Color">
                        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
                          <input
                            type="color"
                            value={palette.accentColor}
                            onChange={(e) => setPalette((p) => ({ ...p, accentColor: e.target.value.toUpperCase() }))}
                            className="h-10 w-10 cursor-pointer rounded-lg border-0 p-0"
                          />
                          <div>
                            <p className="text-sm font-black text-white">{palette.accentColor.toUpperCase()}</p>
                            <p className="text-[10px] text-slate-500">Depth, overlays, contrast</p>
                          </div>
                        </div>
                      </Field>
                    </div>

                    {/* Live preview */}
                    <div
                      className="mt-4 overflow-hidden rounded-[1.5rem] border border-white/5"
                      style={{ background: palette.accentColor }}
                    >
                      <div
                        className="px-5 py-5"
                        style={{ backgroundImage: `linear-gradient(135deg, ${palette.primaryColor}, ${palette.accentColor})` }}
                      >
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60">Guest Preview</p>
                        <h5 className="mt-1.5 text-xl font-black text-white tracking-tight">
                          {business?.businessName || 'Your Venue'}
                        </h5>
                        <p className="mt-1 text-xs font-medium text-white/70">
                          Guests experience your brand through every interaction.
                        </p>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <span
                            className="rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white"
                            style={{ background: palette.primaryColor }}
                          >
                            All Items
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white/60">
                            Veg
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white/60">
                            Non-Veg
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/5 p-3">
                          <p className="text-sm font-bold text-white/80">Confirm Order</p>
                          <span
                            className="rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-wide text-white"
                            style={{ background: palette.primaryColor }}
                          >
                            Review
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <SaveButton pending={businessMutation.isPending} label="Save Settings" color="blue" />
                </form>
              )}

              {/* ───────────────── TAX & REGIONAL ───────────────── */}
              {activeTab === 'menu' && (
                <form onSubmit={handleBusinessSave} className="space-y-5">
                  <Card accent="bg-emerald-500">
                    <SectionTitle icon={<CreditCard size={16} />} title="Taxation & Regional" subtitle="Global rates applied to all customer orders." />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Currency Symbol">
                        <Input name="currencySymbol" defaultValue={business?.currencySymbol || '₹'} required className="text-2xl font-black" />
                      </Field>
                      <Field label="Default Tax Rate (%)">
                        <div className="relative">
                          <Input name="taxRate" type="number" step="0.1" min="0" max="100" defaultValue={business?.taxRate ?? 5} required className="pr-10" />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-500">%</span>
                        </div>
                      </Field>
                      <Field label="GSTIN / Tax Registration Number" className="sm:col-span-2">
                        <Input name="gstin" defaultValue={business?.gstin || ''} placeholder="GSTIN NUMBER" className="uppercase tracking-widest" />
                        <p className="mt-1 text-[10px] font-semibold text-slate-500">Printed on every customer invoice for compliance.</p>
                      </Field>
                    </div>
                  </Card>
                  <SaveButton pending={businessMutation.isPending} label="Update Regional Profile" color="emerald" />
                </form>
              )}

              {/* ───────────────── BUSINESS HOURS ───────────────── */}
              {activeTab === 'hours' && (
                <div className="space-y-5">
                  <Card accent="bg-orange-500">
                    <SectionTitle icon={<Clock size={16} />} title="Service Hours" subtitle="Determines when QR ordering is available to guests." />
                    <div className="space-y-2.5">
                      {DAYS.map((day) => (
                        <div
                          key={day}
                          className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border p-4 transition-all ${hours[day]?.isOpen ? 'border-white/8 bg-slate-950/40' : 'border-dashed border-white/5 opacity-50'
                            }`}
                        >
                          {/* Toggle + day label */}
                          <div className="flex items-center gap-3 sm:w-36 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => setHours({ ...hours, [day]: { ...hours[day], isOpen: !hours[day]?.isOpen } })}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${hours[day]?.isOpen ? 'bg-orange-500' : 'bg-slate-700'
                                }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${hours[day]?.isOpen ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                              />
                            </button>
                            <span className="text-sm font-black text-white capitalize">{day}</span>
                          </div>

                          {hours[day]?.isOpen ? (
                            <div className="flex items-center gap-3 flex-1">
                              <div className="flex items-center gap-2 flex-1 max-w-[160px]">
                                <Clock size={13} className="text-slate-500 flex-shrink-0" />
                                <input
                                  type="time"
                                  value={hours[day]?.open || '09:00'}
                                  onChange={(e) => setHours({ ...hours, [day]: { ...hours[day], open: e.target.value } })}
                                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-black text-white outline-none focus:border-orange-500 transition-colors"
                                />
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex-shrink-0">
                                to
                              </span>
                              <div className="flex items-center gap-2 flex-1 max-w-[160px]">
                                <Clock size={13} className="text-slate-500 flex-shrink-0" />
                                <input
                                  type="time"
                                  value={hours[day]?.close || '22:00'}
                                  onChange={(e) => setHours({ ...hours, [day]: { ...hours[day], close: e.target.value } })}
                                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-black text-white outline-none focus:border-orange-500 transition-colors"
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                              Closed
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                  <SaveButton
                    pending={businessMutation.isPending}
                    label="Save Operating Hours"
                    color="orange"
                    onClick={() => businessMutation.mutate({ businessHours: hours })}
                    type="button"
                  />
                </div>
              )}

              {/* ───────────────── TEAM ACCESS ───────────────── */}
              {activeTab === 'staff' && (
                plan === 'MINI' ? (
                  <Card accent="bg-indigo-500">
                    <div className="flex flex-col items-center py-10 gap-4 text-center">
                      <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                        <Lock size={22} className="text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-base font-black text-white">Team Access is Locked</p>
                        <p className="mt-1 text-sm font-medium text-slate-400 max-w-xs">
                          Upgrade your plan to provision staff members with roles and access.
                        </p>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <div className="space-y-5">
                    {/* Add member form */}
                    <Card accent="bg-indigo-500">
                      <SectionTitle icon={<Users size={16} />} title="Add Team Member" subtitle="Provision access for waiters, kitchen staff, or managers." />
                      <form onSubmit={handleStaffAdd} className="grid gap-4 sm:grid-cols-2">
                        <Field label="Full Name">
                          <Input
                            value={staffForm.name}
                            onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                            required
                            placeholder="e.g. Rahul Singh"
                          />
                        </Field>
                        <Field label="Role">
                          <select
                            value={staffForm.role}
                            onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                            className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-bold text-white outline-none focus:border-blue-500 transition-colors appearance-none"
                          >
                            <option value="WAITER">Waiter Ops</option>
                            <option value="KITCHEN">Kitchen / KDS</option>
                            <option value="MANAGER">Store Manager</option>
                          </select>
                        </Field>
                        <Field label="Generated Handle" className="opacity-60">
                          <Input value={staffForm.username} readOnly className="font-mono text-xs text-slate-500" />
                        </Field>
                        <Field label="Default Password">
                          <div className="relative">
                            <input
                              type="password"
                              value={staffForm.password}
                              onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                              required
                              placeholder="••••••••"
                              className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 pr-10 text-sm font-bold text-white outline-none focus:border-blue-500 transition-colors"
                            />
                            <KeyRound size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                          </div>
                        </Field>
                        <div className="sm:col-span-2">
                          <SaveButton pending={staffMutation.isPending} label="Provision Access" color="indigo" icon={<Plus size={16} />} />
                        </div>
                      </form>
                    </Card>

                    {/* Active staff list */}
                    <Card accent="bg-indigo-500">
                      <SectionTitle icon={<ShieldCheck size={16} />} title="Active Directory" subtitle="All provisioned team members." />
                      {!staff || staff.length === 0 ? (
                        <div className="py-10 text-center">
                          <p className="text-sm font-semibold text-slate-500">No staff provisioned yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {staff.map((member: any) => (
                            <div
                              key={member.id}
                              className="flex items-center gap-3 rounded-2xl border border-white/5 bg-slate-950/40 p-3 hover:border-white/10 transition-colors"
                            >
                              <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-black text-base">
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-white truncate">{member.name}</p>
                                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 truncate">
                                  {member.role} · {member.username}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => deleteStaffMutation.mutate(member.id)}
                                disabled={deleteStaffMutation.isPending}
                                className="h-9 w-9 flex flex-shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors disabled:opacity-40"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </div>
                )
              )}

              {/* ───────────────── QR STUDIO ───────────────── */}
              {activeTab === 'qr' && (
                <div className="space-y-5">
                  <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                    {/* Controls */}
                    <Card accent="bg-purple-500">
                      <SectionTitle icon={<QrCode size={16} />} title="QR Styling" subtitle="Customize the QR codes printed for your table assets." />

                      {/* Presets */}
                      <div className="space-y-3">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Quick Presets</p>
                        <div className="flex flex-wrap gap-2">
                          {QR_PRESETS.map((preset) => {
                            const active = qrConfig.fgColor === preset.fgColor && qrConfig.bgColor === preset.bgColor;
                            return (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => setQrConfig({ fgColor: preset.fgColor, bgColor: preset.bgColor })}
                                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition-all ${active
                                    ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/30'
                                    : 'border-white/10 bg-slate-900 text-slate-400 hover:text-white'
                                  }`}
                              >
                                <span className="h-3 w-3 rounded-full border border-white/10" style={{ background: preset.fgColor }} />
                                <span className="h-3 w-3 rounded-full border border-white/10" style={{ background: preset.bgColor }} />
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Color pickers */}
                      <div className="grid gap-4 sm:grid-cols-2 mt-4">
                        <Field label="Foreground (Grid Color)">
                          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
                            <input
                              type="color"
                              value={qrConfig.fgColor}
                              onChange={(e) => setQrConfig({ ...qrConfig, fgColor: e.target.value })}
                              className="h-10 w-10 cursor-pointer rounded-lg border-0 p-0"
                            />
                            <input
                              type="text"
                              value={qrConfig.fgColor.toUpperCase()}
                              onChange={(e) => setQrConfig({ ...qrConfig, fgColor: e.target.value })}
                              className="flex-1 bg-transparent text-xs font-mono font-black text-white outline-none uppercase"
                            />
                          </div>
                        </Field>
                        <Field label="Background (Canvas Color)">
                          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
                            <input
                              type="color"
                              value={qrConfig.bgColor}
                              onChange={(e) => setQrConfig({ ...qrConfig, bgColor: e.target.value })}
                              className="h-10 w-10 cursor-pointer rounded-lg border-0 p-0"
                            />
                            <input
                              type="text"
                              value={qrConfig.bgColor.toUpperCase()}
                              onChange={(e) => setQrConfig({ ...qrConfig, bgColor: e.target.value })}
                              className="flex-1 bg-transparent text-xs font-mono font-black text-white outline-none uppercase"
                            />
                          </div>
                        </Field>
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/5 bg-blue-500/5 p-4">
                        <div className="flex items-start gap-2">
                          <QrCode size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs font-semibold text-blue-300/80 leading-relaxed">
                            Use high-contrast colors (dark on light or vice versa) to ensure reliable scanning on older phone cameras.
                          </p>
                        </div>
                      </div>
                    </Card>

                    {/* Live preview */}
                    <div className="lg:sticky lg:top-6">
                      <div className="rounded-[2rem] bg-slate-900 p-8 flex flex-col items-center shadow-2xl shadow-black/40 border border-white/5">
                        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500 mb-5">Live Preview</p>
                        <div
                          className="rounded-[1.5rem] p-6 flex flex-col items-center border shadow-xl"
                          style={{ backgroundColor: qrConfig.bgColor, borderColor: `${qrConfig.fgColor}18` }}
                        >
                          <span
                            className="rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] mb-4"
                            style={{ color: qrConfig.fgColor, backgroundColor: `${qrConfig.fgColor}12` }}
                          >
                            Scan me for order
                          </span>
                          <QRCodeSVG
                            value="https://bhojflow.com/preview"
                            size={180}
                            level="H"
                            fgColor={qrConfig.fgColor}
                            bgColor={qrConfig.bgColor}
                            includeMargin={false}
                          />
                          <div className="mt-5 flex flex-col items-center gap-1">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60" style={{ color: qrConfig.fgColor }}>
                              Venue name
                            </span>
                            <span className="text-lg font-black tracking-tighter text-center" style={{ color: qrConfig.fgColor }}>
                              {business?.businessName || 'YOUR VENUE'}
                            </span>
                            <div className="mt-2 h-px w-full" style={{ backgroundColor: `${qrConfig.fgColor}22` }} />
                            <span className="mt-2 rounded-full px-3 py-1 text-[8px] font-black tracking-[0.18em] uppercase" style={{ color: qrConfig.fgColor, backgroundColor: `${qrConfig.fgColor}12` }}>
                              Powered by BHOJFLOW
                            </span>
                          </div>
                        </div>
                        <p className="mt-4 text-[9px] font-medium text-slate-500 text-center">Physical rendering preview</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ── Design System Primitives ──────────────────────────────────────────────────

function Card({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/5 bg-slate-900/60 p-5 lg:p-6 space-y-5">
      <div className={`absolute top-0 left-0 h-full w-0.5 ${accent}`} />
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-slate-400">
        {icon}
      </div>
      <div>
        <h3 className="text-base font-black text-white">{title}</h3>
        <p className="text-[11px] font-medium text-slate-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="pl-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function Input({
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-blue-500/50 placeholder:text-slate-600 ${className}`}
    />
  );
}

function SaveButton({
  pending,
  label,
  color,
  onClick,
  type = 'submit',
  icon,
}: {
  pending: boolean;
  label: string;
  color: 'blue' | 'emerald' | 'orange' | 'indigo';
  onClick?: () => void;
  type?: 'submit' | 'button';
  icon?: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30',
    emerald: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30',
    orange: 'bg-orange-500 hover:bg-orange-400 shadow-orange-900/30',
    indigo: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/30',
  };
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      type={type}
      onClick={onClick}
      disabled={pending}
      className={`flex w-full items-center justify-center gap-2.5 rounded-2xl px-6 py-3.5 text-sm font-black text-white shadow-lg transition-all sm:w-auto disabled:opacity-60 ${colorMap[color]}`}
    >
      {pending ? (
        <Loader2 size={17} className="animate-spin" />
      ) : (
        icon ?? <Save size={17} />
      )}
      {label}
    </motion.button>
  );
}
