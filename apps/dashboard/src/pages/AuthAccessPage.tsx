import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  UtensilsCrossed,
} from 'lucide-react';
import { useSignIn, useSignUp, useUser } from '@clerk/clerk-react';
import { api } from '../lib/api';

export type AuthMode = 'login' | 'signup' | 'forgot';

type AuthAccessPageProps = {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  onBackHome: () => void;
  onLogin: (state: { mustChangePassword: boolean }) => void;
};

type PendingOAuthPayload = {
  mode: 'login' | 'signup';
  name?: string;
  tenantName?: string;
  gstin?: string;
  businessPhone?: string;
  createdAt: number;
};

type GoogleSignupContext = {
  clerkUserId: string;
  email: string;
};

const OAUTH_PENDING_KEY = 'rf_clerk_oauth_pending';
const OAUTH_PENDING_TTL_MS = 20 * 60 * 1000;

const parseApiError = (err: any, fallback: string) =>
  typeof err?.response?.data?.error === 'string' ? err.response.data.error.trim() : fallback;

const parseClerkError = (err: any, fallback: string) => {
  const first = Array.isArray(err?.errors) ? err.errors[0] : undefined;
  const longMessage = typeof first?.longMessage === 'string' ? first.longMessage : '';
  if (longMessage.toLowerCase().includes('data breach') || longMessage.toLowerCase().includes('breach')) {
    return 'This password was found in a known data breach. Use a new password you have never used before.';
  }
  return longMessage || fallback;
};

function readPendingOAuth(): PendingOAuthPayload | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(OAUTH_PENDING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.mode !== 'login' && parsed.mode !== 'signup') return null;
    if (typeof parsed.createdAt !== 'number') return null;
    return parsed as PendingOAuthPayload;
  } catch {
    return null;
  }
}

function writePendingOAuth(payload: PendingOAuthPayload) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify(payload));
}

function clearPendingOAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(OAUTH_PENDING_KEY);
}

function setSession(data: any, onLogin: (state: { mustChangePassword: boolean }) => void) {
  const role = String(data?.user?.role || 'UNKNOWN').toUpperCase();
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('userRole', role);

  const mustChangePassword = role === 'OWNER' && Boolean(data?.user?.mustChangePassword);
  if (mustChangePassword) localStorage.setItem('mustChangePassword', '1');
  else localStorage.removeItem('mustChangePassword');

  onLogin({ mustChangePassword });
}

function Field({
  value,
  onChange,
  placeholder,
  type = 'text',
  readOnly,
}: {
  value: string;
  onChange?: (value: string) => void;
  placeholder: string;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 read-only:cursor-not-allowed read-only:bg-slate-900 read-only:text-slate-300"
    />
  );
}

export function AuthAccessPage({ mode, setMode, onBackHome, onLogin }: AuthAccessPageProps) {
  const clerkEnabled = Boolean(
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [name, setName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [code, setCode] = useState('');
  const [signupStep, setSignupStep] = useState<'details' | 'verify' | 'googleProfile'>('details');
  const [googleSignupContext, setGoogleSignupContext] = useState<GoogleSignupContext | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { isLoaded: isSignUpLoaded, signUp, setActive } = useSignUp();
  const { isLoaded: isSignInLoaded, signIn } = useSignIn();
  const { isLoaded: isUserLoaded, user } = useUser();
  const oauthSyncInFlight = useRef(false);
  const oauthPrefillRef = useRef('');

  const clerkSignupReady = useMemo(() => isSignUpLoaded && !!signUp && clerkEnabled, [isSignUpLoaded, signUp, clerkEnabled]);
  const clerkSigninReady = useMemo(() => isSignInLoaded && !!signIn && clerkEnabled, [isSignInLoaded, signIn, clerkEnabled]);

  const syncGoogleSessionToApi = useCallback(async (params: { clerkUserId: string; email: string; name: string }) => {
    const res = await api.post('/auth/clerk-sync', {
      clerkUserId: params.clerkUserId,
      email: params.email,
      name: params.name,
      authProvider: 'GOOGLE',
    });
    setSession(res.data, onLogin);
  }, [onLogin]);

  useEffect(() => {
    const pendingOAuth = readPendingOAuth();
    if (!pendingOAuth) return;
    if (Date.now() - pendingOAuth.createdAt <= OAUTH_PENDING_TTL_MS) return;
    clearPendingOAuth();
    setAuthError('Google login session expired. Please try again.');
  }, []);

  useEffect(() => {
    if (!clerkEnabled || !isUserLoaded || !user) return;
    const pendingOAuth = readPendingOAuth();
    if (!pendingOAuth) return;
    if (Date.now() - pendingOAuth.createdAt > OAUTH_PENDING_TTL_MS) {
      clearPendingOAuth();
      setAuthError('Google login session expired. Please try again.');
      return;
    }

    const primaryEmail =
      user.primaryEmailAddress?.emailAddress ||
      user.emailAddresses?.find((emailAddress) => emailAddress?.emailAddress)?.emailAddress ||
      '';
    if (!primaryEmail) {
      clearPendingOAuth();
      setAuthError('Google account did not provide an email address.');
      return;
    }

    const resolvedName = (pendingOAuth.name || user.fullName || user.firstName || primaryEmail.split('@')[0] || 'Owner').trim();

    if (pendingOAuth.mode === 'signup') {
      const stamp = `${pendingOAuth.createdAt}_${user.id}`;
      if (oauthPrefillRef.current !== stamp) {
        setMode('signup');
        setSignupStep('googleProfile');
        setGoogleSignupContext({ clerkUserId: user.id, email: primaryEmail });
        setEmail(primaryEmail);
        setName((prev) => (prev.trim() ? prev : resolvedName));
        setTenantName((prev) => (prev.trim() ? prev : pendingOAuth.tenantName?.trim() || ''));
        setGstin((prev) => (prev.trim() ? prev : pendingOAuth.gstin?.trim() || ''));
        setBusinessPhone((prev) => (prev.trim() ? prev : pendingOAuth.businessPhone?.trim() || ''));
        oauthPrefillRef.current = stamp;
      }
      setAuthLoading(false);
      return;
    }

    if (oauthSyncInFlight.current) return;
    oauthSyncInFlight.current = true;
    clearPendingOAuth();
    setAuthLoading(true);
    api
      .post('/auth/clerk-sync', { clerkUserId: user.id, email: primaryEmail, name: resolvedName, authProvider: 'GOOGLE' })
      .then((res) => setSession(res.data, onLogin))
      .catch((err: any) => {
        const message = parseApiError(err, 'Unable to complete Google login.');
        if (message.toLowerCase().includes('restaurant name is required')) {
          writePendingOAuth({ mode: 'signup', name: resolvedName, createdAt: Date.now() });
          setMode('signup');
          setSignupStep('googleProfile');
          setGoogleSignupContext({ clerkUserId: user.id, email: primaryEmail });
          setEmail(primaryEmail);
          setName((prev) => (prev.trim() ? prev : resolvedName));
          setAuthError('Google account found, now enter full name and business name to create workspace.');
          return;
        }
        setAuthError(message);
      })
      .finally(() => {
        oauthSyncInFlight.current = false;
        setAuthLoading(false);
      });
  }, [clerkEnabled, isUserLoaded, onLogin, setMode, user]);

  useEffect(() => {
    if (!clerkEnabled || !isUserLoaded || !user) return;
    if (localStorage.getItem('accessToken')) return;
    const pendingOAuth = readPendingOAuth();
    if (pendingOAuth) return;
    if (oauthSyncInFlight.current) return;

    const primaryEmail =
      user.primaryEmailAddress?.emailAddress ||
      user.emailAddresses?.find((emailAddress) => emailAddress?.emailAddress)?.emailAddress ||
      '';
    if (!primaryEmail) return;

    const resolvedName = (user.fullName || user.firstName || primaryEmail.split('@')[0] || 'Owner').trim();
    oauthSyncInFlight.current = true;
    setAuthLoading(true);
    setAuthError('');
    syncGoogleSessionToApi({ clerkUserId: user.id, email: primaryEmail, name: resolvedName })
      .catch((err: any) => {
        const message = parseApiError(err, 'Failed to sync Clerk account.');
        if (message.toLowerCase().includes('restaurant name is required')) {
          setMode('signup');
          setSignupStep('googleProfile');
          setGoogleSignupContext({ clerkUserId: user.id, email: primaryEmail });
          setEmail(primaryEmail);
          setName((prev) => (prev.trim() ? prev : resolvedName));
          setAuthError('Google account found. Complete workspace details to continue.');
          return;
        }
        setAuthError(message);
      })
      .finally(() => {
        oauthSyncInFlight.current = false;
        setAuthLoading(false);
      });
  }, [clerkEnabled, isUserLoaded, setMode, syncGoogleSessionToApi, user]);

  const startGoogleOAuth = async (flow: 'login' | 'signup') => {
    if (!clerkEnabled) return setAuthError('Clerk signup is not configured.');

    if (isUserLoaded && user) {
      const primaryEmail =
        user.primaryEmailAddress?.emailAddress ||
        user.emailAddresses?.find((emailAddress) => emailAddress?.emailAddress)?.emailAddress ||
        '';
      if (!primaryEmail) return setAuthError('Google account did not provide an email address.');

      const resolvedName = (name.trim() || user.fullName || user.firstName || primaryEmail.split('@')[0] || 'Owner').trim();
      if (oauthSyncInFlight.current) return;

      oauthSyncInFlight.current = true;
      setAuthLoading(true);
      setAuthError('');
      try {
        await syncGoogleSessionToApi({ clerkUserId: user.id, email: primaryEmail, name: resolvedName });
      } catch (err: any) {
        const message = parseApiError(err, 'Unable to complete Google login.');
        if (message.toLowerCase().includes('restaurant name is required')) {
          setMode('signup');
          setSignupStep('googleProfile');
          setGoogleSignupContext({ clerkUserId: user.id, email: primaryEmail });
          setEmail(primaryEmail);
          setName((prev) => (prev.trim() ? prev : resolvedName));
          setAuthError('Google account found. Complete workspace details to continue.');
          return;
        }
        setAuthError(message);
      } finally {
        oauthSyncInFlight.current = false;
        setAuthLoading(false);
      }
      return;
    }

    setAuthLoading(true);
    setAuthError('');
    writePendingOAuth({
      mode: flow,
      name: name.trim() || undefined,
      tenantName: tenantName.trim() || undefined,
      gstin: gstin.trim() || undefined,
      businessPhone: businessPhone.trim() || undefined,
      createdAt: Date.now(),
    });
    const redirectUrl = `${window.location.origin}/sso-callback`;
    const redirectUrlComplete = `${window.location.origin}/?auth=${flow}`;
    try {
      if (flow === 'signup') {
        if (!clerkSignupReady || !signUp) throw new Error('Signup service is still loading.');
        await signUp.authenticateWithRedirect({ strategy: 'oauth_google', redirectUrl, redirectUrlComplete, continueSignUp: true });
      } else {
        if (!clerkSigninReady || !signIn) throw new Error('Signin service is still loading.');
        await signIn.authenticateWithRedirect({ strategy: 'oauth_google', redirectUrl, redirectUrlComplete, continueSignIn: true });
      }
    } catch (err: any) {
      clearPendingOAuth();
      setAuthError(parseClerkError(err, `Unable to continue with Google ${flow}.`));
      setAuthLoading(false);
    }
  };

  const loginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await api.post('/auth/login', { identifier, password });
      setSession(res.data, onLogin);
    } catch (err: any) {
      setAuthError(parseApiError(err, 'Sign-in failed.'));
    } finally {
      setAuthLoading(false);
    }
  };

  const signupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const normalizedName = name.trim();
    const normalizedTenantName = tenantName.trim();
    const normalizedGstin = gstin.trim().toUpperCase();
    const normalizedBusinessPhone = businessPhone.trim();
    if (!normalizedName || !normalizedTenantName || !normalizedGstin || !normalizedBusinessPhone) {
      return setAuthError('Full name, restaurant name, GSTIN, and business phone are required.');
    }

    setAuthLoading(true);
    setAuthError('');
    try {
      if (clerkSignupReady && signUp) {
        const attempt = await signUp.create({ emailAddress: email.trim(), password: signupPassword });
        if (attempt.status === 'complete' && attempt.createdUserId) {
          if (attempt.createdSessionId && setActive) await setActive({ session: attempt.createdSessionId });
          const res = await api.post('/auth/clerk-sync', {
            clerkUserId: attempt.createdUserId,
            email: email.trim(),
            name: normalizedName,
            tenantName: normalizedTenantName,
            gstin: normalizedGstin,
            businessPhone: normalizedBusinessPhone,
            password: signupPassword,
            authProvider: 'EMAIL',
          });
          setSession(res.data, onLogin);
          return;
        }
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setSignupStep('verify');
        return;
      }

      const res = await api.post('/auth/register', {
        email: email.trim(),
        password: signupPassword,
        name: normalizedName,
        tenantName: normalizedTenantName,
        gstin: normalizedGstin,
        businessPhone: normalizedBusinessPhone,
      });
      setSession(res.data, onLogin);
    } catch (err: any) {
      setAuthError(parseClerkError(err, parseApiError(err, 'Signup failed.')));
    } finally {
      setAuthLoading(false);
    }
  };

  const verifySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clerkSignupReady || !signUp) return setAuthError('Signup service is still loading.');
    setAuthLoading(true);
    setAuthError('');
    try {
      const complete = await signUp.attemptEmailAddressVerification({ code });
      if (complete.status !== 'complete' || !complete.createdUserId) return setAuthError('Verification is not complete yet.');
      if (complete.createdSessionId && setActive) await setActive({ session: complete.createdSessionId });
      const res = await api.post('/auth/clerk-sync', {
        clerkUserId: complete.createdUserId,
        email: email.trim(),
        name: name.trim(),
        tenantName: tenantName.trim(),
        gstin: gstin.trim().toUpperCase(),
        businessPhone: businessPhone.trim(),
        password: signupPassword,
        authProvider: 'EMAIL',
      });
      setSession(res.data, onLogin);
    } catch (err: any) {
      setAuthError(parseClerkError(err, 'Verification failed.'));
    } finally {
      setAuthLoading(false);
    }
  };

  const completeGoogleSignup = async (e: FormEvent) => {
    e.preventDefault();
    if (!googleSignupContext) return setAuthError('Google signup session not found. Try again.');
    if (!name.trim() || !tenantName.trim() || !gstin.trim() || !businessPhone.trim()) {
      return setAuthError('Full name, restaurant name, GSTIN, and business phone are required.');
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await api.post('/auth/clerk-sync', {
        clerkUserId: googleSignupContext.clerkUserId,
        email: googleSignupContext.email,
        name: name.trim(),
        tenantName: tenantName.trim(),
        gstin: gstin.trim().toUpperCase(),
        businessPhone: businessPhone.trim(),
        authProvider: 'GOOGLE',
      });
      clearPendingOAuth();
      setSession(res.data, onLogin);
    } catch (err: any) {
      setAuthError(parseApiError(err, 'Unable to complete Google workspace signup.'));
    } finally {
      setAuthLoading(false);
    }
  };

  const questionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await api.post('/auth/forgot-password/question', { identifier });
      setQuestion(String(res.data?.securityQuestion || ''));
    } catch (err: any) {
      setAuthError(parseApiError(err, 'Unable to fetch question.'));
    } finally {
      setAuthLoading(false);
    }
  };

  const resetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return setAuthError('New password and confirm password must match.');
    setAuthLoading(true);
    setAuthError('');
    try {
      await api.post('/auth/forgot-password/reset', { identifier, securityAnswer: answer, newPassword });
      setMode('login');
      setQuestion('');
      setAnswer('');
      setNewPassword('');
      setConfirmPassword('');
      setAuthError('Password reset complete. Please login now.');
    } catch (err: any) {
      setAuthError(parseApiError(err, 'Unable to reset password.'));
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 gap-8 px-5 py-8 lg:grid-cols-[1fr_1fr] lg:items-center">
        <section className="hidden rounded-3xl border border-blue-400/30 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-8 lg:block">
          <button onClick={onBackHome} className="mb-6 inline-flex items-center gap-2 rounded-lg border border-white/35 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-white hover:bg-white/20">
            <ArrowLeft size={14} />
            Back Home
          </button>
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15">
            <UtensilsCrossed size={28} />
          </div>
          <h2 className="text-5xl font-black leading-[0.95]" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>RestoFlow</h2>
          <p className="mt-3 text-lg font-semibold text-blue-100">Clerk + Neon connected authentication</p>
        </section>

        <section className="rounded-3xl border border-slate-700 bg-[#0b1730] p-6 shadow-2xl sm:p-7">
          <div className="mb-4 flex items-center justify-between gap-2 lg:hidden">
            <button onClick={onBackHome} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-100 hover:bg-slate-800">
              <ArrowLeft size={14} />
              Home
            </button>
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">RestoFlow Access</span>
          </div>

          <div className="mb-5">
            <p className="text-3xl font-black" style={{ fontFamily: 'Space Grotesk, Inter, sans-serif' }}>
              {mode === 'forgot' ? 'Recover Password' : 'Access Dashboard'}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-400">
              {mode === 'forgot' ? 'Recover account access using your security question.' : 'Login and signup are synced with your Neon data.'}
            </p>
          </div>

          {mode !== 'forgot' && (
            <div className="mb-5 grid grid-cols-2 rounded-xl border border-slate-700 bg-slate-800 p-1">
              <button onClick={() => { setMode('login'); setSignupStep('details'); setAuthError(''); }} className={`rounded-lg px-3 py-2 text-sm font-black ${mode === 'login' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Login</button>
              <button onClick={() => { setMode('signup'); if (!googleSignupContext) setSignupStep('details'); setAuthError(''); }} className={`rounded-lg px-3 py-2 text-sm font-black ${mode === 'signup' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Signup</button>
            </div>
          )}

          {authError && <div className="mb-4 rounded-xl border border-red-300/40 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-200">{authError}</div>}

          {mode === 'login' && (
            <form onSubmit={loginSubmit} className="space-y-4">
              <Field value={identifier} onChange={setIdentifier} placeholder="Email or Employee ID" />
              <Field value={password} onChange={setPassword} placeholder="Password" type="password" />
              <button type="button" onClick={() => { setMode('forgot'); setAuthError(''); }} className="text-xs font-black uppercase tracking-[0.14em] text-blue-300 hover:text-blue-200">Forgot Password</button>
              <button disabled={authLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-60">
                {authLoading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                {authLoading ? 'Signing in...' : 'Sign In to Dashboard'}
              </button>
              <button type="button" disabled={authLoading || !clerkSigninReady} onClick={() => startGoogleOAuth('login')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm font-black text-slate-100 hover:bg-slate-800 disabled:opacity-60">
                <ShieldCheck size={16} />
                Continue with Google
              </button>
            </form>
          )}

          {mode === 'signup' && signupStep === 'details' && (
            <form onSubmit={signupSubmit} className="space-y-4">
              <Field value={name} onChange={setName} placeholder="Full Name" />
              <Field value={tenantName} onChange={setTenantName} placeholder="Restaurant Name" />
              <Field value={gstin} onChange={setGstin} placeholder="GSTIN (e.g. 22AAAAA0000A1Z5)" />
              <Field value={businessPhone} onChange={setBusinessPhone} placeholder="Business Phone" />
              <Field value={email} onChange={setEmail} placeholder="Email" type="email" />
              <Field value={signupPassword} onChange={setSignupPassword} placeholder="Password" type="password" />
              <button disabled={authLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-60">
                {authLoading ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                {clerkSignupReady ? 'Create Account with Email' : 'Create Account (Neon Direct)'}
              </button>
              <button type="button" disabled={authLoading || !clerkSignupReady} onClick={() => startGoogleOAuth('signup')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm font-black text-slate-100 hover:bg-slate-800 disabled:opacity-60">
                <ShieldCheck size={15} />
                Continue with Google
              </button>
            </form>
          )}

          {mode === 'signup' && signupStep === 'verify' && (
            <form onSubmit={verifySubmit} className="space-y-4">
              <Field value={code} onChange={setCode} placeholder="Verification code" />
              <button disabled={authLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-60">
                {authLoading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Verify and Continue
              </button>
            </form>
          )}

          {mode === 'signup' && signupStep === 'googleProfile' && (
            <form onSubmit={completeGoogleSignup} className="space-y-4">
              <div className="rounded-xl border border-blue-300/35 bg-blue-500/12 px-4 py-3 text-sm font-semibold text-blue-100">
                First-time Google signup: enter full name and business name.
              </div>
              <Field value={email} placeholder="Google Email" readOnly />
              <Field value={name} onChange={setName} placeholder="Full Name" />
              <Field value={tenantName} onChange={setTenantName} placeholder="Restaurant Name" />
              <Field value={gstin} onChange={setGstin} placeholder="GSTIN (e.g. 22AAAAA0000A1Z5)" />
              <Field value={businessPhone} onChange={setBusinessPhone} placeholder="Business Phone" />
              <button disabled={authLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-60">
                {authLoading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Complete Signup
              </button>
            </form>
          )}

          {mode === 'forgot' && !question && (
            <form onSubmit={questionSubmit} className="space-y-4">
              <Field value={identifier} onChange={setIdentifier} placeholder="Email or Employee ID" />
              <button disabled={authLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-60">
                {authLoading ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
                Get Question
              </button>
            </form>
          )}

          {mode === 'forgot' && question && (
            <form onSubmit={resetSubmit} className="space-y-4">
              <div className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100">{question}</div>
              <Field value={answer} onChange={setAnswer} placeholder="Security answer" />
              <Field value={newPassword} onChange={setNewPassword} placeholder="New password" type="password" />
              <Field value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm password" type="password" />
              <button disabled={authLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-60">
                {authLoading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Reset Password
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
