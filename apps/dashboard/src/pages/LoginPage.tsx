import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Lock, LogIn, ShieldCheck } from 'lucide-react';
import { useSignIn } from '@clerk/clerk-react';
import { AuthFrame } from '../components/AuthFrame';
import { FormField } from '../components/forms/FormField';
import { api } from '../lib/api';
import { parseApiError, parseClerkError, persistSession } from '../lib/authSession';

type LoginPageProps = {
  onLogin: (state: { mustChangePassword: boolean }) => void;
};

const REMEMBER_KEY = 'rf_login_identifier';

export function LoginPage({ onLogin }: LoginPageProps) {
  const clerkEnabled = Boolean(
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );
  const { isLoaded: isSignInLoaded, signIn } = useSignIn();

  const rememberedIdentifier = localStorage.getItem(REMEMBER_KEY) || '';
  const [identifier, setIdentifier] = useState(rememberedIdentifier);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(Boolean(rememberedIdentifier));
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const isSuccessMessage = authError.toLowerCase().includes('complete');

  const loginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await api.post('/auth/login', { identifier, password });
      if (rememberMe) localStorage.setItem(REMEMBER_KEY, identifier.trim());
      else localStorage.removeItem(REMEMBER_KEY);
      persistSession(res.data, onLogin);
    } catch (err: any) {
      if (!err?.response) {
        const base = String(api.defaults.baseURL || 'http://localhost:4000');
        setAuthError(`Cannot reach API server (${base}). Start backend and try again.`);
      } else {
        setAuthError(parseApiError(err, 'Sign in failed.'));
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const startGoogleLogin = async () => {
    if (!clerkEnabled) {
      setAuthError('Google login is not configured yet.');
      return;
    }

    if (!isSignInLoaded || !signIn) {
      setAuthError('Google login is still loading. Please try again.');
      return;
    }

    setAuthLoading(true);
    setAuthError('');
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}/auth/finalize?flow=login`,
        continueSignIn: true,
      });
    } catch (err: any) {
      setAuthError(parseClerkError(err, 'Unable to continue with Google login.'));
      setAuthLoading(false);
    }
  };

  const requestQuestion = async (e: FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await api.post('/auth/forgot-password/question', { identifier });
      setQuestion(String(res.data?.securityQuestion || ''));
      setForgotStep('reset');
    } catch (err: any) {
      setAuthError(parseApiError(err, 'Unable to fetch recovery question.'));
    } finally {
      setAuthLoading(false);
    }
  };

  const resetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setAuthError('New password and confirm password must match.');
      return;
    }

    setAuthLoading(true);
    setAuthError('');
    try {
      await api.post('/auth/forgot-password/reset', {
        identifier,
        securityAnswer: answer,
        newPassword,
      });
      setAuthError('Password reset complete. You can sign in now.');
      setForgotStep('request');
      setQuestion('');
      setAnswer('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setAuthError(parseApiError(err, 'Unable to reset password.'));
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <AuthFrame
      badge="Login"
      title="Welcome Back To Your Restaurant Workspace"
      subtitle="Continue with Google or sign in with your email and password to get back to live orders, tables, billing, and staff workflows."
      alternateLabel="Need a new workspace?"
      alternateHref="/signup"
      alternateCta="Create account"
    >
      {authError ? (
        <div
          className="mb-6 rounded-2xl border-2 px-5 py-4 text-sm font-semibold shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300"
          style={
            isSuccessMessage
              ? { borderColor: 'rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.08)', color: '#065f46' }
              : { borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.06)', color: '#991b1b' }
          }
        >
          <div className="flex items-start gap-3">
            <span className="flex-1 leading-relaxed">{authError}</span>
          </div>
          {(authError.toLowerCase().includes('create an account') || authError.toLowerCase().includes('user not found')) && !isSuccessMessage && (
            <div className="mt-3 pt-3 border-t border-red-500/10">
              <Link to="/signup" className="inline-flex items-center gap-1 font-black text-blue-600 hover:text-blue-500 transition-colors">
                Create your workspace now →
              </Link>
            </div>
          )}
        </div>
      ) : null}

      {forgotStep === 'request' && (
        <form onSubmit={loginSubmit} className="space-y-4">
          <button
            type="button"
            onClick={startGoogleLogin}
            disabled={authLoading || (clerkEnabled && !isSignInLoaded)}
            className="flex w-full items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition disabled:opacity-60"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-1)' }}
          >
            {authLoading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            Continue with Google
          </button>

          <div className="relative py-1">
            <div className="h-px" style={{ background: 'var(--border)' }} />
            <span
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-3 text-xs"
              style={{ background: 'var(--surface)', color: 'var(--text-3)' }}
            >
              or continue with email
            </span>
          </div>

          <FormField
            label="Email or employee ID"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            placeholder="owner@restaurant.com or REST-ALICE"
            autoComplete="username"
          />

          <FormField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Enter your password"
            autoComplete="current-password"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <label className="inline-flex items-center gap-2" style={{ color: 'var(--text-2)' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500/20"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
              />
              Remember me
            </label>
            <button
              type="button"
              onClick={() => {
                setForgotStep('reset');
                setAuthError('');
              }}
              className="font-semibold transition hover:brightness-110"
              style={{ color: 'var(--brand)' }}
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {authLoading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {authLoading ? 'Signing in...' : 'Sign in'}
          </button>

          <div className="text-sm" style={{ color: 'var(--text-2)' }}>
            Need an account?{' '}
            <Link to="/signup" className="font-semibold transition hover:brightness-110" style={{ color: 'var(--brand)' }}>
              Create one here
            </Link>
          </div>
        </form>
      )}

      {forgotStep === 'reset' && !question && (
        <form onSubmit={requestQuestion} className="space-y-4">
          <FormField
            label="Email or employee ID"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            placeholder="Use your usual BHOJFLOW login"
          />

          <button
            type="submit"
            disabled={authLoading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {authLoading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
            {authLoading ? 'Checking...' : 'Get recovery question'}
          </button>

          <button
            type="button"
            onClick={() => {
              setForgotStep('request');
              setAuthError('');
            }}
            className="text-sm font-semibold transition hover:brightness-110"
            style={{ color: 'var(--text-2)' }}
          >
            Back to login
          </button>
        </form>
      )}

      {forgotStep === 'reset' && question && (
        <form onSubmit={resetPassword} className="space-y-4">
          <div className="rounded-2xl border px-4 py-4 text-sm leading-6" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' }}>
            Security question: <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{question}</span>
          </div>

          <FormField
            label="Answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            required
            placeholder="Enter your answer"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="New password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="At least 8 characters"
            />
            <FormField
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Repeat new password"
            />
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {authLoading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
            {authLoading ? 'Resetting...' : 'Reset password'}
          </button>

          <button
            type="button"
            onClick={() => {
              setForgotStep('request');
              setQuestion('');
              setAnswer('');
              setAuthError('');
            }}
            className="text-sm font-semibold transition hover:brightness-110"
            style={{ color: 'var(--text-2)' }}
          >
            Back to login
          </button>
        </form>
      )}
    </AuthFrame>
  );
}
