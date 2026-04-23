import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LogOut, ShieldCheck, UserCircle2, UserX } from 'lucide-react';
import { api } from '../lib/api';
import { clearCustomerContextForTenant, getCustomerTokenForTenant } from '../lib/tenantStorage';

export function ProfilePage() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const token = getCustomerTokenForTenant(tenantSlug);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!tenantSlug || !token) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get('/customer/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProfile(data);
      } catch (error) {
        console.error('[CUSTOMER_PROFILE_ERROR]', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchProfile();
  }, [tenantSlug, token]);

  const logout = () => {
    clearCustomerContextForTenant(tenantSlug);
    navigate(`/order/${tenantSlug}`, { replace: true });
  };

  const deactivate = async () => {
    if (!tenantSlug || !token) return;
    const confirmed = window.confirm(
      'Deactivate this customer account? Personal details will be anonymized and you will be signed out immediately.',
    );
    if (!confirmed) return;

    setDeactivating(true);
    try {
      await api.post(
        '/customer/account/deactivate',
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      clearCustomerContextForTenant(tenantSlug);
      navigate(`/order/${tenantSlug}`, { replace: true });
    } catch (error: any) {
      window.alert(error?.response?.data?.error || 'Could not deactivate account right now.');
    } finally {
      setDeactivating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div
          className="h-10 w-10 animate-spin rounded-full border-4"
          style={{ borderColor: 'var(--brand-soft)', borderTopColor: 'var(--brand)' }}
        />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: 'var(--bg)' }}>
        <UserCircle2 size={42} style={{ color: 'var(--text-3)' }} />
        <p className="font-bold" style={{ color: 'var(--text-2)' }}>
          Login to manage your customer profile.
        </p>
        <button
          onClick={() => navigate(`/order/${tenantSlug}`)}
          className="rounded-full px-5 py-3 text-sm font-black text-white"
          style={{ background: 'var(--brand)' }}
        >
          Back to Menu
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-[100dvh] px-4 pb-8 pt-12"
      style={{ background: 'var(--bg)', paddingBottom: 'calc(var(--customer-nav-space) + 1.5rem)' }}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <section
          className="rounded-[32px] border px-6 py-6 shadow-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <div className="flex items-start gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
            >
              <UserCircle2 size={28} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>
                Customer Profile
              </p>
              <h1 className="mt-2 text-2xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
                {profile?.name || 'Guest Customer'}
              </h1>
              <p className="mt-1 text-sm font-medium" style={{ color: 'var(--text-2)' }}>
                {profile?.phone || 'No phone added'}
              </p>
              <div className="mt-4 inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em]" style={{ background: profile?.isActive ? '#dcfce7' : '#fee2e2', color: profile?.isActive ? '#166534' : '#991b1b' }}>
                {profile?.isActive ? 'Active account' : 'Deactivated'}
              </div>
            </div>
          </div>
        </section>

        <section
          className="rounded-[28px] border p-5"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} style={{ color: 'var(--brand)' }} />
            <h2 className="text-lg font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
              Privacy and account controls
            </h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
            You can sign out from this device at any time. If you deactivate your account, BHOJFLOW will anonymize
            your personal details while keeping billing and operational records intact for the restaurant.
          </p>
          {profile?.deactivatedAt && (
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-3)' }}>
              Deactivated on {new Date(profile.deactivatedAt).toLocaleString('en-IN')}
            </p>
          )}
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={logout}
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-black text-white"
            style={{ background: 'var(--brand)' }}
          >
            <LogOut size={16} />
            Logout
          </button>
          <button
            onClick={() => void deactivate()}
            disabled={deactivating}
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-black text-white disabled:opacity-60"
            style={{ background: '#dc2626' }}
          >
            <UserX size={16} />
            {deactivating ? 'Deactivating...' : 'Deactivate Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
