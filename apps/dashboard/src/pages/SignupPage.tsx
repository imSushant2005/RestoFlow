import { FormEvent, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { useSignUp, useUser } from '@clerk/clerk-react';
import { AuthFrame } from '../components/AuthFrame';
import { FormField } from '../components/forms/FormField';
import { api } from '../lib/api';
import { getClerkDisplayName, getClerkPrimaryEmail, parseApiError, parseClerkError, persistSession } from '../lib/authSession';

type SignupPageProps = {
  onLogin: (state: { mustChangePassword: boolean }) => void;
};

export function SignupPage({ onLogin }: SignupPageProps) {
  const clerkEnabled = Boolean(
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );
  const { isLoaded: isSignUpLoaded, signUp, setActive } = useSignUp();
  const { isLoaded: isUserLoaded, user } = useUser();
  const syncInFlight = useRef(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [signupStep, setSignupStep] = useState<'details' | 'verify'>('details');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const parseGoogleSyncError = (err: any, fallback: string) => {
    const message = typeof err?.message === 'string' ? err.message.trim() : '';
    if (!err?.response) {
      if (message && message.toLowerCase() !== 'network error') return message;
      const base = String(api.defaults.baseURL || 'http://localhost:4000');
      return `Cannot reach API server (${base}). Start backend and try again.`;
    }
    return parseApiError(err, fallback);
  };

  const syncGoogleSignup = async (clerkUser: any) => {
    const primaryEmail = getClerkPrimaryEmail(clerkUser);
    if (!primaryEmail) throw new Error('Google profile is still loading. Please try again.');
    const resolvedName = getClerkDisplayName(clerkUser, primaryEmail);
    const res = await api.post('/auth/clerk-sync', {
      clerkUserId: clerkUser.id,
      email: primaryEmail,
      name: resolvedName,
      authProvider: 'GOOGLE',
      intent: 'SIGNUP',
    });
    persistSession(res.data, onLogin);
  };

  useEffect(() => {
    if (!clerkEnabled || !isUserLoaded || !user) return;
    if (localStorage.getItem('accessToken')) return;
    if (syncInFlight.current) return;
    if (!getClerkPrimaryEmail(user)) return;

    syncInFlight.current = true;
    setAuthLoading(true);
    setAuthError('');
    syncGoogleSignup(user)
      .catch((err: any) => {
        setAuthError(parseGoogleSyncError(err, 'Unable to continue with Google signup.'));
      })
      .finally(() => {
        syncInFlight.current = false;
        setAuthLoading(false);
      });
  }, [clerkEnabled, isUserLoaded, onLogin, user]);

  const signupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      if (clerkEnabled && isSignUpLoaded && signUp) {
        const attempt = await signUp.create({
          emailAddress: email.trim(),
          password,
          firstName: name.trim().split(/\s+/)[0] || undefined,
          lastName: name.trim().split(/\s+/).slice(1).join(' ') || undefined,
        });

        if (attempt.status === 'complete' && attempt.createdUserId) {
          if (attempt.createdSessionId && setActive) {
            await setActive({ session: attempt.createdSessionId });
          }
          const res = await api.post('/auth/clerk-sync', {
            clerkUserId: attempt.createdUserId,
            email: email.trim(),
            name: name.trim(),
            password,
            authProvider: 'EMAIL',
            intent: 'SIGNUP',
          });
          persistSession(res.data, onLogin);
          return;
        }

        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setSignupStep('verify');
        return;
      }

      const res = await api.post('/auth/register', {
        email: email.trim(),
        password,
        name: name.trim(),
      });
      persistSession(res.data, onLogin);
    } catch (err: any) {
      const fallback = clerkEnabled ? 'Signup failed.' : 'Unable to create your account.';
      setAuthError(parseClerkError(err, parseApiError(err, fallback)));
    } finally {
      setAuthLoading(false);
    }
  };

  const verifySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clerkEnabled || !isSignUpLoaded || !signUp) {
      setAuthError('Email verification is still loading. Please try again.');
      return;
    }

    setAuthLoading(true);
    setAuthError('');
    try {
      const complete = await signUp.attemptEmailAddressVerification({ code });
      if (complete.status !== 'complete' || !complete.createdUserId) {
        setAuthError('Verification is not complete yet.');
        return;
      }

      if (complete.createdSessionId && setActive) {
        await setActive({ session: complete.createdSessionId });
      }
      const res = await api.post('/auth/clerk-sync', {
        clerkUserId: complete.createdUserId,
        email: email.trim(),
        name: name.trim(),
        password,
        authProvider: 'EMAIL',
        intent: 'SIGNUP',
      });
      persistSession(res.data, onLogin);
    } catch (err: any) {
      setAuthError(parseClerkError(err, 'Verification failed.'));
    } finally {
      setAuthLoading(false);
    }
  };

  const startGoogleSignup = async () => {
    if (!clerkEnabled) {
      setAuthError('Google signup is not configured yet.');
      return;
    }

    if (isUserLoaded && user) {
      if (!getClerkPrimaryEmail(user)) {
        setAuthError('Google profile is still loading. Please try again in a moment.');
        return;
      }
      setAuthLoading(true);
      setAuthError('');
      try {
        await syncGoogleSignup(user);
      } catch (err: any) {
        setAuthError(parseGoogleSyncError(err, 'Unable to continue with Google signup.'));
      } finally {
        setAuthLoading(false);
      }
      return;
    }

    if (!isSignUpLoaded || !signUp) {
      setAuthError('Google signup is still loading. Please try again.');
      return;
    }

    setAuthLoading(true);
    setAuthError('');
    try {
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}/signup`,
        continueSignUp: true,
      });
    } catch (err: any) {
      setAuthError(parseClerkError(err, 'Unable to continue with Google signup.'));
      setAuthLoading(false);
    }
  };

  return (
    <AuthFrame
      badge="Signup"
      title="Create the owner account first"
      subtitle="Start with the essentials only. Restaurant name, GSTIN, and business phone are collected in the guided workspace setup after account creation."
      alternateLabel="Already have an account?"
      alternateHref="/login"
      alternateCta="Login instead"
    >
      {authError ? (
        <div
          className="mb-6 rounded-2xl border-2 px-5 py-4 text-sm font-semibold shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300"
          style={{ borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.06)', color: '#991b1b' }}
        >
          {authError}
        </div>
      ) : null}

      {signupStep === 'details' && (
        <form onSubmit={signupSubmit} className="space-y-4">
          <FormField
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Sushant Rana"
            autoComplete="name"
          />

          <FormField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="owner@restaurant.com"
            autoComplete="email"
          />

          <FormField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Use a unique password"
            autoComplete="new-password"
            hint="After account creation, you will complete workspace identity in the next step."
          />

          <div className="rounded-2xl border px-4 py-4 text-sm leading-6" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' }}>
            What happens next: we create the account first, then guide you through restaurant name, GSTIN, and business phone so billing identity stays clear.
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {authLoading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
            {authLoading ? 'Creating account...' : 'Create account'}
          </button>

          <div className="relative py-1">
            <div className="h-px" style={{ background: 'var(--border)' }} />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-3 text-xs" style={{ background: 'var(--surface)', color: 'var(--text-3)' }}>
              or continue with
            </span>
          </div>

          <button
            type="button"
            onClick={startGoogleSignup}
            disabled={authLoading || (clerkEnabled && !isSignUpLoaded && !user)}
            className="flex w-full items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition disabled:opacity-60"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-1)' }}
          >
            {authLoading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            Continue with Google
          </button>
        </form>
      )}

      {signupStep === 'verify' && (
        <form onSubmit={verifySubmit} className="space-y-4">
          <div className="rounded-2xl border px-4 py-4 text-sm leading-6" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' }}>
            We sent a verification code to <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{email}</span>. Enter it below to finish account creation.
          </div>

          <FormField
            label="Verification code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            placeholder="Enter the code"
          />

          <button
            type="submit"
            disabled={authLoading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {authLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {authLoading ? 'Verifying...' : 'Verify and continue'}
          </button>

          <button
            type="button"
            onClick={() => {
              setSignupStep('details');
              setAuthError('');
            }}
            className="text-sm font-semibold transition hover:brightness-110"
            style={{ color: 'var(--text-2)' }}
          >
            Back to signup details
          </button>
        </form>
      )}
    </AuthFrame>
  );
}
