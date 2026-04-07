import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Save, Plus, Trash2 } from 'lucide-react';

function sanitizeSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
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

export function Settings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'business' | 'staff' | 'qr'>('business');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [staffForm, setStaffForm] = useState({
    name: '',
    username: '',
    employeeCode: '',
    role: 'WAITER',
    password: '',
  });
  const [manualUsername, setManualUsername] = useState(false);
  const [manualEmployeeCode, setManualEmployeeCode] = useState(false);

  const { data: business, isLoading: loadingBusiness } = useQuery({
    queryKey: ['settings-business'],
    queryFn: async () => (await api.get('/settings/business')).data
  });

  const businessMutation = useMutation({
    mutationFn: (data: any) => api.patch('/settings/business', data),
    onSuccess: () => {
      setErrorMessage('');
      queryClient.invalidateQueries({ queryKey: ['settings-business'] });
      setSuccessMessage('Business settings updated successfully.');
      window.setTimeout(() => setSuccessMessage(''), 3500);
    },
    onError: (err: any) => {
      const apiError = typeof err?.response?.data?.error === 'string' ? err.response.data.error : 'Failed to update business settings.';
      setErrorMessage(apiError);
    },
  });

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
    });
  };

  const { data: staff, isLoading: loadingStaff } = useQuery({
    queryKey: ['settings-staff'],
    queryFn: async () => (await api.get('/settings/staff')).data
  });

  const staffMutation = useMutation({
    mutationFn: (data: any) => api.post('/settings/staff', data),
    onSuccess: () => {
      setErrorMessage('');
      queryClient.invalidateQueries({ queryKey: ['settings-staff'] });
      setSuccessMessage('Staff list updated successfully.');
      window.setTimeout(() => setSuccessMessage(''), 3500);
    },
    onError: (err: any) => {
      const apiError = typeof err?.response?.data?.error === 'string' ? err.response.data.error : 'Failed to create staff.';
      setErrorMessage(apiError);
    },
  });

  const updateStaffMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/settings/staff/${id}`, data),
    onSuccess: () => {
      setErrorMessage('');
      queryClient.invalidateQueries({ queryKey: ['settings-staff'] });
      setSuccessMessage('Staff credentials updated successfully.');
      window.setTimeout(() => setSuccessMessage(''), 3500);
    },
    onError: (err: any) => {
      const apiError = typeof err?.response?.data?.error === 'string' ? err.response.data.error : 'Failed to update staff.';
      setErrorMessage(apiError);
    },
  });

  const deleteStaffMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/staff/${id}`),
    onSuccess: () => {
      setErrorMessage('');
      queryClient.invalidateQueries({ queryKey: ['settings-staff'] });
    },
    onError: (err: any) => {
      const apiError = typeof err?.response?.data?.error === 'string' ? err.response.data.error : 'Failed to remove staff.';
      setErrorMessage(apiError);
    },
  });

  useEffect(() => {
    const slug = business?.slug || 'restaurant';
    if (!staffForm.name.trim()) return;
    if (!manualUsername) {
      setStaffForm((prev) => ({ ...prev, username: buildUsername(prev.name, slug) }));
    }
    if (!manualEmployeeCode) {
      setStaffForm((prev) => ({ ...prev, employeeCode: buildEmployeeCode(prev.name, slug) }));
    }
  }, [business?.slug, staffForm.name, manualEmployeeCode, manualUsername]);

  const handleStaffAdd = (e: any) => {
    e.preventDefault();
    if (!staffForm.name.trim() || !staffForm.password.trim()) {
      setErrorMessage('Staff name and temporary password are required.');
      return;
    }

    const usernameToUse = staffForm.username.trim() || buildUsername(staffForm.name, business?.slug);
    const employeeCodeToUse = staffForm.employeeCode.trim() || buildEmployeeCode(staffForm.name, business?.slug);

    staffMutation.mutate({
      name: staffForm.name.trim(),
      username: usernameToUse,
      employeeCode: employeeCodeToUse,
      role: staffForm.role,
      password: staffForm.password,
    });
    setStaffForm({
      name: '',
      username: '',
      employeeCode: '',
      role: 'WAITER',
      password: '',
    });
    setManualUsername(false);
    setManualEmployeeCode(false);
  };

  const openEditStaffDialog = (member: any) => {
    const nextName = window.prompt('Update staff full name', member.name || '');
    if (nextName === null) return;
    const nextUsername = window.prompt('Update login username', member.email || '');
    if (nextUsername === null) return;
    const nextEmployeeCode = window.prompt('Update employee ID', member.employeeCode || '');
    if (nextEmployeeCode === null) return;
    const nextRole = window.prompt('Update role (MANAGER/CASHIER/KITCHEN/WAITER)', member.role || '');
    if (nextRole === null) return;

    updateStaffMutation.mutate({
      id: member.id,
      data: {
        name: nextName,
        username: nextUsername,
        employeeCode: nextEmployeeCode,
        role: nextRole,
      },
    });
  };

  const openResetPasswordDialog = (member: any) => {
    const nextPassword = window.prompt(`Set new temporary password for ${member.name}`, '');
    if (!nextPassword) return;
    updateStaffMutation.mutate({
      id: member.id,
      data: { password: nextPassword },
    });
  };

  if (loadingBusiness || loadingStaff) return <div className="p-8 font-medium animate-pulse" style={{ color: 'var(--text-3)' }}>Loading settings...</div>;

  return (
    <div className="flex-1 p-8 overflow-y-auto w-full" style={{ background: 'var(--bg)' }}>
      <h2 className="text-3xl font-bold tracking-tight mb-4" style={{ color: 'var(--text-1)' }}>System Settings</h2>
      {successMessage && (
        <div className="mb-6 rounded-2xl border border-green-500/20 bg-green-500/10 text-green-500 px-4 py-3 shadow-sm font-semibold">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-500 px-4 py-3 shadow-sm font-semibold">
          {errorMessage}
        </div>
      )}
      <div className="flex gap-4 mb-8" style={{ borderBottom: '1px solid var(--border)' }}>
        <button className={`pb-4 px-2 font-semibold transition-all ${activeTab === 'business' ? 'border-b-2 border-blue-600 text-blue-600' : ''}`} style={activeTab === 'business' ? {} : { color: 'var(--text-3)' }} onClick={() => setActiveTab('business')}>Business Profile</button>
        <button className={`pb-4 px-2 font-semibold transition-all ${activeTab === 'staff' ? 'border-b-2 border-blue-600 text-blue-600' : ''}`} style={activeTab === 'staff' ? {} : { color: 'var(--text-3)' }} onClick={() => setActiveTab('staff')}>Staff Management</button>
        <button className={`pb-4 px-2 font-semibold transition-all ${activeTab === 'qr' ? 'border-b-2 border-blue-600 text-blue-600' : ''}`} style={activeTab === 'qr' ? {} : { color: 'var(--text-3)' }} onClick={() => setActiveTab('qr')}>QR Customization</button>
      </div>

      {activeTab === 'business' && (
        <div className="p-8 rounded-2xl max-w-3xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <form onSubmit={handleBusinessSave} className="flex flex-col gap-6">
            <div>
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-2)' }}>Business Name</label>
              <input name="businessName" defaultValue={business?.businessName} required className="w-full p-3 rounded-lg outline-none font-medium transition-all" style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-2)' }}>Business Login Email</label>
                <input
                  name="email"
                  defaultValue={business?.email || ''}
                  required
                  className="w-full p-3 rounded-lg outline-none font-medium transition-all"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-2)' }}>Business Phone</label>
                <input
                  name="phone"
                  defaultValue={business?.phone || ''}
                  required
                  className="w-full p-3 rounded-lg outline-none font-medium transition-all"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-2)' }}>GSTIN</label>
              <input
                name="gstin"
                defaultValue={business?.gstin || ''}
                required
                className="w-full p-3 rounded-lg outline-none font-medium uppercase transition-all"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-2)' }}>Tagline / Description</label>
              <textarea
                name="description"
                defaultValue={business?.description || ''}
                rows={3}
                placeholder="Describe your restaurant vibe in one short line..."
                className="w-full p-3 rounded-lg outline-none font-medium resize-none transition-all"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-2)' }}>Venue Slug (URL)</label>
              <input name="slug" defaultValue={business?.slug} required className="w-full p-3 rounded-lg outline-none font-medium transition-all" style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }} />
              <p className="text-xs mt-2" style={{ color: 'var(--text-3)' }}>Customers will order at: restoflow.com/order/<strong>{business?.slug}</strong></p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-2)' }}>Brand Logo URL</label>
                <input
                  name="logoUrl"
                  type="url"
                  defaultValue={business?.logoUrl || ''}
                  placeholder="https://.../logo.png"
                  className="w-full p-3 rounded-lg outline-none font-medium transition-all"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-2)' }}>Hero Cover Image URL</label>
                <input
                  name="coverImageUrl"
                  type="url"
                  defaultValue={business?.coverImageUrl || ''}
                  placeholder="https://.../cover.jpg"
                  className="w-full p-3 rounded-lg outline-none font-medium transition-all"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-2)' }}>Primary Color</label>
                <div className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                  <input type="color" name="primaryColor" defaultValue={business?.primaryColor || '#3B82F6'} className="w-12 h-12 rounded cursor-pointer border-0 p-0" style={{ background: 'transparent' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-3)' }}>{business?.primaryColor || '#3B82F6'}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-2)' }}>Accent Color</label>
                <div className="flex items-center gap-3 p-2 border rounded-lg" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                  <input type="color" name="accentColor" defaultValue={business?.accentColor || '#111827'} className="w-12 h-12 rounded cursor-pointer border-0 p-0" style={{ background: 'transparent' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-3)' }}>{business?.accentColor || '#111827'}</span>
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
          <div className="p-8 rounded-2xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
            <h3 className="font-bold text-lg mb-6" style={{ color: 'var(--text-1)' }}>Add New Staff Member</h3>
            <form onSubmit={handleStaffAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                value={staffForm.name}
                onChange={(e) => setStaffForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Full Name"
                required
                className="p-3 rounded-lg outline-none font-medium transition-all"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
              />
              <input
                value={staffForm.username}
                onChange={(e) => {
                  setManualUsername(true);
                  setStaffForm((prev) => ({ ...prev, username: e.target.value }));
                }}
                placeholder={`Login Username (e.g. ${buildUsername('john', business?.slug)})`}
                required
                className="p-3 rounded-lg outline-none font-medium transition-all"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
              />
              <input
                value={staffForm.employeeCode}
                onChange={(e) => {
                  setManualEmployeeCode(true);
                  setStaffForm((prev) => ({ ...prev, employeeCode: e.target.value.toUpperCase() }));
                }}
                placeholder={`Employee ID (e.g. ${buildEmployeeCode('john', business?.slug)})`}
                required
                className="p-3 rounded-lg outline-none font-medium transition-all"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
              />
              <input
                value={staffForm.password}
                onChange={(e) => setStaffForm((prev) => ({ ...prev, password: e.target.value }))}
                name="password"
                type="password"
                placeholder="Temporary Password"
                required
                className="p-3 rounded-lg outline-none font-medium transition-all"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
              />
              <select
                value={staffForm.role}
                onChange={(e) => setStaffForm((prev) => ({ ...prev, role: e.target.value }))}
                className="p-3 rounded-lg outline-none font-medium cursor-pointer transition-all"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
              >
                <option value="WAITER">Waiter (Orders & Tables)</option>
                <option value="CASHIER">Cashier (Billing & POS)</option>
                <option value="KITCHEN">Kitchen (KDS Only)</option>
                <option value="MANAGER">Manager (Full Access)</option>
              </select>
              <p className="md:col-span-2 -mt-1 text-xs font-medium" style={{ color: 'var(--text-3)' }}>
                Username format is multi-tenant: <span className="font-mono">{buildUsername(staffForm.name || 'staff', business?.slug)}</span>.
                Staff can login with username or employee ID and change password on first login.
              </p>
              <button type="submit" disabled={staffMutation.isPending} className="md:col-span-2 bg-blue-600 text-white font-bold py-3 rounded-lg mt-2 flex justify-center items-center gap-2 hover:bg-blue-700 active:scale-[0.99] transition-all disabled:opacity-70 shadow-lg shadow-blue-500/20">
                <Plus size={18} /> Create Staff Credentials
              </button>
            </form>
          </div>

          <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead style={{ background: 'var(--surface-3)', borderBottom: '1px solid var(--border)' }}>
                  <tr>
                    <th className="p-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Name</th>
                    <th className="p-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Employee ID</th>
                    <th className="p-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Username</th>
                    <th className="p-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Role</th>
                    <th className="p-4 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Security</th>
                    <th className="p-4 font-semibold text-xs uppercase tracking-wider text-right" style={{ color: 'var(--text-3)' }}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {staff?.map((s: any) => (
                    <tr key={s.id} className="transition-colors hover:bg-gray-500/5">
                      <td className="p-4 font-bold" style={{ color: 'var(--text-1)' }}>{s.name}</td>
                      <td className="p-4 font-mono text-sm" style={{ color: 'var(--text-2)' }}>{s.employeeCode || '-'}</td>
                      <td className="p-4 font-medium font-mono text-xs sm:text-sm" style={{ color: 'var(--text-3)' }}>{s.email}</td>
                      <td className="p-4"><span className="bg-blue-500/10 text-blue-500 text-xs font-bold px-2.5 py-1 rounded-full">{s.role}</span></td>
                      <td className="p-4">
                        {s.mustChangePassword ? (
                          <span className="bg-amber-500/10 text-amber-500 text-xs font-bold px-2.5 py-1 rounded-full">
                            NEW
                          </span>
                        ) : (
                          <span className="bg-emerald-500/10 text-emerald-500 text-xs font-bold px-2.5 py-1 rounded-full">
                            VERIFIED
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditStaffDialog(s)}
                            className="rounded-lg px-2 py-1 text-xs font-bold transition-all"
                            style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => openResetPasswordDialog(s)}
                            className="rounded-lg px-2 py-1 text-xs font-bold transition-all"
                            style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}
                          >
                            Reset
                          </button>
                          <button onClick={() => deleteStaffMutation.mutate(s.id)} className="p-2 transition-colors rounded-lg text-red-500 hover:bg-red-500/10">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'qr' && (
        <div className="p-8 rounded-2xl max-w-2xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          <form onSubmit={handleBusinessSave} className="flex flex-col gap-6">
            <div>
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-2)' }}>Brand Primary Color (used in QRs too)</label>
              <div className="flex gap-4 items-center p-2 rounded-xl" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                <input type="color" name="primaryColor" defaultValue={business?.primaryColor || '#3B82F6'} className="w-16 h-16 rounded-xl cursor-pointer border-0 p-0" style={{ background: 'transparent' }} />
                <span className="text-sm font-medium pr-4" style={{ color: 'var(--text-3)' }}>This color injects into generated QR codes and storefront highlights to match your venue branding.</span>
              </div>
            </div>
            {/* hidden fields to prevent unsetting */}
            <input type="hidden" name="businessName" value={business?.businessName} />
            <input type="hidden" name="slug" value={business?.slug} />
            <input type="hidden" name="email" value={business?.email || ''} />
            <input type="hidden" name="phone" value={business?.phone || ''} />
            <input type="hidden" name="gstin" value={business?.gstin || ''} />
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
