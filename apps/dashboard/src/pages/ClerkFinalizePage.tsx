import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../lib/api';
import { parseApiError, persistSession } from '../lib/authSession';

type ClerkFinalizePageProps = {
  onLogin: (state: { mustChangePassword: boolean }) => void;
};

function normalizeFlow(value: string | null) {
  return value === 'signup' ? 'signup' : 'login';
}

const clerkJwtTemplate =
  import.meta.env.VITE_CLERK_JWT_TEMPLATE || import.meta.env.NEXT_PUBLIC_CLERK_JWT_TEMPLATE;

export function ClerkFinalizePage({ onLogin }: ClerkFinalizePageProps) {
  const [searchParams] = useSearchParams();
  const flow = normalizeFlow(searchParams.get('flow'));
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const syncStartedRef = useRef(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoaded || syncStartedRef.current || done) return;

    if (!isSignedIn) {
      setError(
        flow === 'signup'
          ? 'Google signup could not be completed. Please try again.'
          : 'Google login could not be completed. Please try again.',
      );
      return;
    }

    syncStartedRef.current = true;

    void getToken(clerkJwtTemplate ? { template: clerkJwtTemplate } : undefined)
      .then((sessionToken) => {
        if (!sessionToken) {
          throw new Error('Missing Google verification token.');
        }

        return api.post('/auth/google/complete', {
          sessionToken,
          intent: flow === 'signup' ? 'SIGNUP' : 'LOGIN',
        });
      })
      .then((res) => {
        persistSession(res.data, onLogin);
        setDone(true);
      })
      .catch((err: any) => {
        setError(
          parseApiError(
            err,
            flow === 'signup'
              ? 'Unable to complete Google signup.'
              : 'Unable to complete Google login.',
          ),
        );
        syncStartedRef.current = false;
      });
  }, [done, flow, getToken, isLoaded, isSignedIn, onLogin]);

  if (done) {
    return <Navigate to="/" replace />;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--shell-bg)', color: 'var(--text-1)' }}
    >
      <div
        className="w-full max-w-md rounded-[2rem] border p-8 shadow-2xl"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-500/15 text-blue-500">
          {error ? <ShieldCheck size={30} /> : <Loader2 size={30} className="animate-spin" />}
        </div>

        <h1 className="text-center text-2xl font-black tracking-tight">
          {error ? 'Google access needs attention' : 'Finishing your secure sign-in'}
        </h1>

        <p className="mt-3 text-center text-sm font-medium" style={{ color: 'var(--text-2)' }}>
          {error
            ? error
            : flow === 'signup'
              ? 'We are verifying your Google identity and preparing onboarding.'
              : 'We are verifying your Google identity and opening your workspace.'}
        </p>

        {error ? (
          <div className="mt-6 flex flex-col gap-3">
            <Link
              to={flow === 'signup' ? '/signup' : '/login'}
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Try again
            </Link>
            {flow === 'login' && (
              <Link
                to="/signup"
                className="inline-flex items-center justify-center rounded-full border px-4 py-3 text-sm font-semibold transition"
                style={{ borderColor: 'var(--border)', color: 'var(--text-1)' }}
              >
                Create a workspace instead
              </Link>
            )}
          </div>
        ) : (
          <div
            className="mt-6 rounded-2xl border px-4 py-3 text-sm font-semibold"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' }}
          >
            This usually takes only a moment.
          </div>
        )}
      </div>
    </div>
  );
}
