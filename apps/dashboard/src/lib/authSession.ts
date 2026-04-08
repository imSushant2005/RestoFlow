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

  return fallback;
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
  const role = String(data?.user?.role || 'UNKNOWN').toUpperCase();
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('userRole', role);

  const mustChangePassword = Boolean(data?.user?.mustChangePassword);
  if (mustChangePassword) localStorage.setItem('mustChangePassword', '1');
  else localStorage.removeItem('mustChangePassword');

  onLogin({ mustChangePassword });
}
