import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Link, useNavigate } from 'react-router-dom';
import { Home, Mail, Shield, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState('email'); // 'email' | 'otp' | 'reset' | 'done'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await forgotPassword(email);
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) { setError('Enter a valid 6-digit code'); return; }
    // Move to reset step - OTP will be verified at reset
    setStep('reset');
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError(''); setLoading(true);
    try {
      await resetPassword(email, otp, newPassword);
      setStep('done');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally { setLoading(false); }
  };

  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-base';

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-600/30">
            <Home className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">WFH Calendar</h1>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-2xl">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-slate-400 text-xs hover:text-slate-300 mb-4">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to login
          </Link>

          {step === 'email' && (
            <>
              <h2 className="text-white font-semibold text-lg mb-1">Forgot Password</h2>
              <p className="text-slate-400 text-xs mb-4">Enter your email and we'll send you a reset code.</p>
              {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 mb-4 text-sm">{error}</div>}
              <form onSubmit={handleSendOtp} className="space-y-3">
                <input className={inp} type="email" placeholder="Email" value={email}
                  onChange={e => setEmail(e.target.value)} required inputMode="email" autoCapitalize="none" />
                <button type="submit" disabled={loading || !email}
                  className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition flex items-center justify-center gap-2">
                  {loading ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                    : <><Mail className="w-4 h-4" />Send Reset Code</>}
                </button>
              </form>
            </>
          )}

          {step === 'otp' && (
            <>
              <h2 className="text-white font-semibold text-lg mb-1">Check Your Email</h2>
              <p className="text-slate-400 text-xs mb-4">Enter the 6-digit code sent to {email}</p>
              {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 mb-4 text-sm">{error}</div>}
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <input className={`${inp} text-center tracking-widest text-lg font-mono`}
                  placeholder="000000" maxLength={6} value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric" autoFocus />
                <button type="submit" disabled={otp.length !== 6}
                  className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition flex items-center justify-center gap-2">
                  <><Shield className="w-4 h-4" />Verify Code</>
                </button>
                <button onClick={handleSendOtp} disabled={loading}
                  className="w-full text-blue-400 text-xs hover:text-blue-300 transition py-1">
                  Resend code
                </button>
              </form>
            </>
          )}

          {step === 'reset' && (
            <>
              <h2 className="text-white font-semibold text-lg mb-1">Reset Password</h2>
              <p className="text-slate-400 text-xs mb-4">Enter your new password.</p>
              {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 mb-4 text-sm">{error}</div>}
              <form onSubmit={handleReset} className="space-y-3">
                <input className={inp} type="password" placeholder="New password (min 6 chars)" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} required minLength={6} autoFocus />
                <button type="submit" disabled={loading || newPassword.length < 6}
                  className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition flex items-center justify-center gap-2">
                  {loading ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                    : 'Reset Password'}
                </button>
              </form>
            </>
          )}

          {step === 'done' && (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h2 className="text-white font-semibold text-lg mb-1">Password Reset!</h2>
              <p className="text-slate-400 text-xs">Redirecting you to login...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}