const MANUAL_LOGOUT_KEY = 'rf_manual_logout_at';
const MANUAL_LOGOUT_GRACE_MS = 60 * 1000;

export function parseApiError(err: any, fallback: string) {
  const responseData = err?.response?.data;
  
  if (typeof responseData?.error === 'string' && responseData.error.trim()) {
    return responseData.error.trim();
  }

  if (typeof responseData === 'string' && responseData.trim()) {
    return responseData.trim();
  }
  
  const axiosMessage = typeof err?.message === 'string' ? err.message.trim() : '';
  if (axiosMessage && axiosMessage.toLowerCase() !== 'network error' && !axiosMessage.includes('status code')) {
    return axiosMessage;
  }

  console.error('[BHOJFLOW_AUTH_ERROR_FALLBACK]', {
    status: err?.response?.status,
    data: responseData,
    message: err?.message
  });

  return fallback;
}

export function clearDashboardAuthStorage() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('userRole');
  localStorage.removeItem('mustChangePassword');
  localStorage.removeItem('userEmail');
}

export function markManualLogout() {
  localStorage.setItem(MANUAL_LOGOUT_KEY, String(Date.now()));
}

export function clearManualLogout() {
  localStorage.removeItem(MANUAL_LOGOUT_KEY);
}

export function hasRecentManualLogout() {
  const raw = localStorage.getItem(MANUAL_LOGOUT_KEY);
  if (!raw) return false;

  const timestamp = Number(raw);
  if (!Number.isFinite(timestamp)) {
    localStorage.removeItem(MANUAL_LOGOUT_KEY);
    return false;
  }

  if (Date.now() - timestamp > MANUAL_LOGOUT_GRACE_MS) {
    localStorage.removeItem(MANUAL_LOGOUT_KEY);
    return false;
  }

  return true;
}

export function parseClerkError(err: any, fallback: string) {
  const first = Array.isArray(err?.errors) ? err.errors[0] : undefined;
  const longMessage = typeof first?.longMessage === 'string' ? first.longMessage : '';
  if (longMessage.toLowerCase().includes('data breach') || longMessage.toLowerCase().includes('breach')) {
    return 'This password was found in a known data breach. Use a new password you have never used before.';
  }
  return longMessage || fallback;
}

export function getClerkPrimaryEmail(user: any) {
  return (
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.find((emailAddress: any) => emailAddress?.emailAddress)?.emailAddress ||
    ''
  );
}

export function getClerkDisplayName(user: any, email: string) {
  return (user?.fullName || user?.firstName || email.split('@')[0] || 'Owner').trim();
}

export function persistSession(data: any, onLogin: (state: { mustChangePassword: boolean }) => void) {
  const mustChangePassword = applySessionSnapshot(data);
  onLogin({ mustChangePassword });
}

export function applySessionSnapshot(data: any) {
  clearManualLogout();
  const role = String(data?.user?.role || 'UNKNOWN').toUpperCase();
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('userRole', role);
  localStorage.setItem('userEmail', data?.user?.email || '');

  const mustChangePassword = role === 'OWNER' && Boolean(data?.user?.mustChangePassword);
  if (mustChangePassword) localStorage.setItem('mustChangePassword', '1');
  else localStorage.removeItem('mustChangePassword');

  return mustChangePassword;
}
