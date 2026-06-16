import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate, Link } from 'react-router-dom';
import { Home, LogIn, UserPlus, Eye, EyeOff, Mail, KeyRound, Shield } from 'lucide-react';

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [authTab, setAuthTab] = useState('password'); // 'password' | 'otp'
  const [form, setForm] = useState({ username: '', email: '', password: '', companyName: '' });
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const { login, register, sendOtp, verifyOtp, sendLoginOtp, loginWithOtp } = useAuth();
  const navigate = useNavigate();

  const [regStep, setRegStep] = useState('form'); // 'form' | 'otp'

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'login') {
      setLoading(true);
      try {
        await login(form.email, form.password);
        navigate('/');
      } catch (err) {
        setError(err.response?.data?.message || 'Something went wrong');
      } finally { setLoading(false); }
    } else {
      // Registration: first send OTP, show OTP step
      if (!form.email || !form.password || !form.username) {
        setError('Please fill in all required fields');
        return;
      }
      setOtpLoading(true);
      try {
        await sendOtp(form.email, 'email_verification');
        setRegStep('otp');
        setOtpSent(true);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to send verification code');
      } finally { setOtpLoading(false); }
    }
  };

  const handleSendOtp = async () => {
    if (!form.email) { setError('Enter your email first'); return; }
    setError(''); setOtpLoading(true);
    try {
      if (mode === 'login') {
        await sendLoginOtp(form.email);
      } else {
        await sendOtp(form.email, 'email_verification');
      }
      setOtpSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally { setOtpLoading(false); }
  };

  const handleOtpLogin = async () => {
    if (!otp) { setError('Enter the OTP'); return; }
    setError(''); setLoading(true);
    try {
      await loginWithOtp(form.email, otp);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally { setLoading(false); }
  };

  const handleRegisterWithOtp = async () => {
    if (!otp) { setError('Enter the OTP'); return; }
    if (!form.username) { setError('Username is required'); return; }
    if (!form.password) { setError('Password is required'); return; }
    setError(''); setLoading(true);
    try {
      // Register with OTP — server will verify it
      await register(form.username, form.email, form.password, form.companyName, otp);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  const switchToOtpTab = () => {
    setAuthTab('otp');
    setOtp('');
    setOtpSent(false);
    setError('');
  };

  const switchToPasswordTab = () => {
    setAuthTab('password');
    setOtp('');
    setOtpSent(false);
    setError('');
  };

  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-base';

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
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
          {/* Tab toggle: Sign In / Sign Up */}
          <div className="flex bg-slate-900 rounded-xl p-1 mb-4">
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); setOtp(''); setOtpSent(false); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                  mode === m ? 'bg-blue-600 text-white shadow' : 'text-slate-400'
                }`}>
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Auth method tabs: Password / OTP (only for login) */}
          {mode === 'login' && (
            <div className="flex bg-slate-900 rounded-lg p-0.5 mb-4">
              {[
                { key: 'password', icon: KeyRound, label: 'Password' },
                { key: 'otp', icon: Shield, label: 'OTP Login' },
              ].map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => key === 'otp' ? switchToOtpTab() : switchToPasswordTab()}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition ${
                    authTab === key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 mb-4 text-sm">
              {error}
            </div>
          )}

          {/* PASSWORD AUTH / REGISTRATION */}
          {authTab === 'password' && mode === 'login' && (
            <form onSubmit={handleSubmit} className="space-y-3">
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
                  : <><LogIn className="w-4 h-4" />Sign In</>}
              </button>
              <div className="text-center mt-3">
                <Link to="/forgot-password" className="text-blue-400 text-xs hover:text-blue-300 transition">
                  Forgot password?
                </Link>
              </div>
            </form>
          )}

          {/* REGISTRATION FLOW with OTP */}
          {mode === 'register' && (
            <div className="space-y-3">
              {regStep === 'form' && (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <input className={inp} placeholder="Username" value={form.username}
                    onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required
                    autoCapitalize="none" autoCorrect="off" />
                  <input className={inp} placeholder="Company Name (optional)" value={form.companyName}
                    onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))} />
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
                  <button type="submit" disabled={otpLoading}
                    className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition flex items-center justify-center gap-2 text-base mt-2">
                    {otpLoading
                      ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                      : <><Mail className="w-4 h-4" />Send Verification Code</>}
                  </button>
                </form>
              )}

              {regStep === 'otp' && (
                <div className="space-y-3">
                  <div className="text-center">
                    <p className="text-emerald-400 text-sm font-medium mb-1">✓ Code sent!</p>
                    <p className="text-slate-400 text-xs mb-1">Enter the 6-digit code sent to</p>
                    <p className="text-slate-200 text-sm font-medium">{form.email}</p>
                  </div>
                  <input className={`${inp} text-center tracking-widest text-lg font-mono`}
                    placeholder="000000" maxLength={6} value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric" autoFocus />
                  <button onClick={handleRegisterWithOtp} disabled={loading || otp.length !== 6}
                    className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition flex items-center justify-center gap-2 text-base">
                    {loading
                      ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                      : <><UserPlus className="w-4 h-4" />Verify & Create Account</>}
                  </button>
                  <div className="flex justify-between text-xs">
                    <button onClick={() => setRegStep('form')} className="text-slate-500 hover:text-slate-300">
                      ← Edit details
                    </button>
                    <button onClick={handleSendOtp} disabled={otpLoading}
                      className="text-blue-400 hover:text-blue-300">
                      {otpLoading ? 'Sending...' : 'Resend code'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* OTP AUTH (Login only) */}
          {authTab === 'otp' && (
            <div className="space-y-3">
              <input className={inp} type="email" placeholder="Email" value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required
                inputMode="email" autoCapitalize="none" />

              {!otpSent ? (
                <button onClick={handleSendOtp} disabled={otpLoading || !form.email}
                  className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition flex items-center justify-center gap-2 text-base">
                  {otpLoading
                    ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                    : <><Mail className="w-4 h-4" />Send OTP</>}
                </button>
              ) : (
                <>
                  <div className="text-center">
                    <p className="text-slate-400 text-xs mb-1">Enter the 6-digit code sent to</p>
                    <p className="text-slate-200 text-sm font-medium">{form.email}</p>
                  </div>
                  <input className={`${inp} text-center tracking-widest text-lg font-mono`}
                    placeholder="000000" maxLength={6} value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric" autoFocus />
                  <button onClick={handleOtpLogin} disabled={loading || otp.length !== 6}
                    className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition flex items-center justify-center gap-2 text-base">
                    {loading
                      ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                      : <><Shield className="w-4 h-4" />Verify & Sign In</>}
                  </button>
                  <button onClick={handleSendOtp} disabled={otpLoading}
                    className="w-full text-blue-400 text-xs hover:text-blue-300 transition py-1">
                    {otpLoading ? 'Sending...' : 'Resend OTP'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* For registration: OTP email verification hint */}
          {mode === 'register' && (
            <div className="mt-3 bg-slate-900/50 rounded-xl px-3 py-2.5 border border-slate-700/50">
              <p className="text-slate-500 text-xs flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                Your email will be verified before account creation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}