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

  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition';

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Home className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">WFH Calendar</h1>
          <p className="text-slate-400 mt-1">Manage your work schedule smartly</p>
        </div>

        <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-2xl">
          <div className="flex bg-slate-900 rounded-lg p-1 mb-6">
            {['login','register'].map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition ${mode === m ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>}

          <form onSubmit={handle} className="space-y-4">
            {mode === 'register' && (
              <>
                <input className={inp} placeholder="Username" value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required />
                <input className={inp} placeholder="Company Name (optional)" value={form.companyName}
                  onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))} />
              </>
            )}
            <input className={inp} type="email" placeholder="Email" value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
            <div className="relative">
              <input className={inp} type={showPw ? 'text' : 'password'} placeholder="Password" value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-3.5 text-slate-400 hover:text-white">
                {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2">
              {loading ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : null}
              {mode === 'login' ? <><LogIn className="w-4 h-4" />Sign In</> : <><UserPlus className="w-4 h-4" />Create Account</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
