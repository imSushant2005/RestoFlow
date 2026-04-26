import { FormEvent, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';

type FirstLoginPasswordGateProps = {
  onCompleted: () => void;
  onLogout: () => void;
};

function getApiError(err: any, fallback: string) {
  const fromApi = typeof err?.response?.data?.error === 'string' ? err.response.data.error.trim() : '';
  return fromApi || fallback;
}

export function FirstLoginPasswordGate({ onCompleted, onLogout }: FirstLoginPasswordGateProps) {
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password must match.');
      return;
    }

    setLoading(true);

    try {
      const payload: Record<string, string> = {
        newPassword,
        securityQuestion,
        securityAnswer,
      };
      if (username.trim()) {
        payload.username = username.trim();
      }
      if (currentPassword.trim()) {
        payload.currentPassword = currentPassword;
      }

      await api.post('/auth/change-password/first-login', payload);

      localStorage.removeItem('mustChangePassword');
      setSuccess('Password updated successfully. Redirecting to dashboard...');
      window.setTimeout(() => onCompleted(), 700);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        onLogout();
        return;
      }
      setError(getApiError(err, 'Unable to change password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10">
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600/20 text-emerald-400">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              First Login Security Setup
            </h1>
            <p className="text-sm text-slate-400">Change your temporary password and save your recovery question.</p>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Login Username (Optional)
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. raj@your-restaurant.bhojflow"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <p className="mt-1 text-xs text-slate-500">
              If you enter only a name, we will convert it to your tenant format automatically.
            </p>
          </div>
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Current Password (Optional for Google First Login)
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Leave blank if you signed up with Google"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Security Question</label>
            <input
              value={securityQuestion}
              onChange={(e) => setSecurityQuestion(e.target.value)}
              required
              placeholder="Example: What is your first school name?"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-400">Security Answer</label>
            <input
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-black text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {loading ? 'Saving...' : 'Save and Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
