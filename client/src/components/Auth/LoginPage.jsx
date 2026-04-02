import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { Home, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '', companyName: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handle = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form.username, form.email, form.password, form.companyName);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally { setLoading(false); }
  };

  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-base';

  return (
    <div className="min-h-screen min-h-dvh bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-600/30">
            <Home className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">WFH Calendar</h1>
          <p className="text-slate-400 mt-1 text-sm">Manage your work schedule smartly</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-2xl">
          {/* Tab toggle */}
          <div className="flex bg-slate-900 rounded-xl p-1 mb-5">
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                  mode === m ? 'bg-blue-600 text-white shadow' : 'text-slate-400'
                }`}>
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handle} className="space-y-3">
            {mode === 'register' && (
              <>
                <input className={inp} placeholder="Username" value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required
                  autoCapitalize="none" autoCorrect="off" />
                <input className={inp} placeholder="Company Name (optional)" value={form.companyName}
                  onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))} />
              </>
            )}
            <input className={inp} type="email" placeholder="Email" value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required
              inputMode="email" autoCapitalize="none" />
            <div className="relative">
              <input className={inp} type={showPw ? 'text' : 'password'} placeholder="Password"
                value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 p-1">
                {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition flex items-center justify-center gap-2 text-base mt-2">
              {loading
                ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                : mode === 'login'
                  ? <><LogIn className="w-4 h-4" />Sign In</>
                  : <><UserPlus className="w-4 h-4" />Create Account</>
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
