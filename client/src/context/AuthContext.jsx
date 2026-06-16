import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUser(data.user);
    return data;
  };

  const register = async (username, email, password, companyName, otp) => {
    const { data } = await api.post('/auth/register', { username, email, password, companyName, otp });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUser(data.user);
    return data;
  };

  const sendOtp = async (email, purpose = 'email_verification') => {
    const { data } = await api.post('/auth/send-otp', { email, purpose });
    return data;
  };

  const verifyOtp = async (email, otp, purpose = 'email_verification') => {
    const { data } = await api.post('/auth/verify-otp', { email, otp, purpose });
    return data;
  };

  const sendLoginOtp = async (email) => {
    const { data } = await api.post('/auth/send-login-otp', { email });
    return data;
  };

  const loginWithOtp = async (email, otp) => {
    const { data } = await api.post('/auth/login-otp', { email, otp });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUser(data.user);
    return data;
  };

  const forgotPassword = async (email) => {
    const { data } = await api.post('/auth/forgot-password', { email });
    return data;
  };

  const resetPassword = async (email, otp, newPassword) => {
    const { data } = await api.post('/auth/reset-password', { email, otp, newPassword });
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return <AuthContext.Provider value={{
    user, loading, login, register, logout,
    sendOtp, verifyOtp, sendLoginOtp, loginWithOtp,
    forgotPassword, resetPassword
  }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
