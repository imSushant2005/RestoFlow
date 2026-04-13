import { useEffect, useState } from 'react';
import { AuthAccessPage, AuthMode } from '../pages/AuthAccessPage';
import { AuthIndexPage } from '../pages/AuthIndexPage';
import { AuthContactPage } from '../pages/AuthContactPage';

type AuthPortalProps = {
  onLogin: (state: { mustChangePassword: boolean }) => void;
};

const OAUTH_PENDING_KEY = 'rf_clerk_oauth_pending';

function getInitialPortalState() {
  if (typeof window === 'undefined') {
    return { screen: 'index' as const, mode: 'login' as AuthMode };
  }

  const hasPendingOAuth = Boolean(localStorage.getItem(OAUTH_PENDING_KEY));
  const params = new URLSearchParams(window.location.search);
  const modeFromQuery = params.get('auth');
  const initialMode: AuthMode = modeFromQuery === 'signup' ? 'signup' : 'login';

  return {
    screen: hasPendingOAuth || modeFromQuery ? ('auth' as const) : ('index' as const),
    mode: initialMode,
  };
}

export function AuthPortal({ onLogin }: AuthPortalProps) {
  const [screen, setScreen] = useState<'index' | 'auth' | 'contact'>(() => getInitialPortalState().screen);
  const [mode, setMode] = useState<AuthMode>(() => getInitialPortalState().mode);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('auth')) return;
    params.delete('auth');
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', nextUrl);
  }, []);

  if (screen === 'index') {
    return (
      <AuthIndexPage
        onLoginClick={() => {
          setMode('login');
          setScreen('auth');
        }}
        onSignupClick={() => {
          setMode('signup');
          setScreen('auth');
        }}
        onContactClick={() => setScreen('contact')}
      />
    );
  }

  if (screen === 'contact') {
    return (
      <AuthContactPage
        onBackHome={() => setScreen('index')}
        onLoginClick={() => {
          setMode('login');
          setScreen('auth');
        }}
        onSignupClick={() => {
          setMode('signup');
          setScreen('auth');
        }}
      />
    );
  }

  return (
    <AuthAccessPage
      mode={mode}
      setMode={setMode}
      onBackHome={() => setScreen('index')}
      onLogin={onLogin}
    />
  );
}
