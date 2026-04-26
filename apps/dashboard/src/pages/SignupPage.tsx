import { FormEvent, useState } from 'react';
import { ArrowLeft, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { useSignUp } from '@clerk/clerk-react';
import { AuthFrame } from '../components/AuthFrame';
import { FormField } from '../components/forms/FormField';
import { api } from '../lib/api';
import { parseApiError, parseClerkError, persistSession } from '../lib/authSession';

type SignupPageProps = {
  onLogin: (state: { mustChangePassword: boolean }) => void;
};

export function SignupPage({ onLogin }: SignupPageProps) {
  const clerkEnabled = Boolean(
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );
  const { isLoaded: isSignUpLoaded, signUp } = useSignUp();

  const [mode, setMode] = useState<'choice' | 'email'>('choice');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const signupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      const res = await api.post('/auth/register', {
        email: email.trim(),
        password,
        name: name.trim(),
      });
      persistSession(res.data, onLogin);
    } catch (err: any) {
      setAuthError(parseApiError(err, 'Unable to create your account.'));
    } finally {
      setAuthLoading(false);
    }
  };

  const startGoogleSignup = async () => {
    if (!clerkEnabled) {
      setAuthError('Google signup is not configured yet.');
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
        redirectUrlComplete: `${window.location.origin}/auth/finalize?flow=signup`,
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
      title="Start Growing Your Restaurant Today"
      subtitle="Create your owner account in seconds, then finish restaurant setup in under 2 minutes. No credit card required."
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

      {mode === 'choice' ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={startGoogleSignup}
            disabled={authLoading || (clerkEnabled && !isSignUpLoaded)}
            className="flex w-full items-center justify-center gap-3 rounded-[1.6rem] border px-5 py-4 text-sm font-semibold transition disabled:opacity-60"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-1)' }}
          >
            {authLoading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('email');
              setAuthError('');
            }}
            className="flex w-full items-center justify-center gap-3 rounded-[1.6rem] bg-blue-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            <Mail size={18} />
            Continue with Email
          </button>

          <p className="pt-2 text-center text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
            No credit card required.
          </p>
        </div>
      ) : (
        <form onSubmit={signupSubmit} className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setMode('choice');
              setAuthError('');
            }}
            className="inline-flex items-center gap-2 text-sm font-semibold transition hover:brightness-110"
            style={{ color: 'var(--text-2)' }}
          >
            <ArrowLeft size={14} />
            Back
          </button>

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
            hint="Use at least 8 characters."
          />

          <button
            type="submit"
            disabled={authLoading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {authLoading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
            {authLoading ? 'Creating account...' : 'Create account'}
          </button>

          <p className="text-center text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
            No credit card required.
          </p>
        </form>
      )}
    </AuthFrame>
  );
}
