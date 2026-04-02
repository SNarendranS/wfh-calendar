import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { useNotifications } from './hooks/useNotifications.js';
import { ToastProvider } from './components/Layout/Toast.jsx';
import Sidebar from './components/Layout/Sidebar.jsx';
import BottomNav from './components/Layout/BottomNav.jsx';
import LoginPage from './components/Auth/LoginPage.jsx';
import Dashboard from './components/Dashboard/Dashboard.jsx';
import CalendarPage from './components/Calendar/CalendarPage.jsx';
import NotificationsPage from './components/Notifications/NotificationsPage.jsx';
import SettingsPage from './components/Settings/SettingsPage.jsx';

function AppLayout() {
  const { unreadCount } = useNotifications();
  return (
    <div className="flex min-h-screen bg-slate-900">
      <div className="hidden lg:block">
        <Sidebar unreadCount={unreadCount} />
      </div>
      <main className="flex-1 lg:ml-64 pb-20 lg:pb-0 overflow-auto min-h-screen">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <div className="lg:hidden">
        <BottomNav unreadCount={unreadCount} />
      </div>
    </div>
  );
}

function ProtectedApp() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );
  if (!user) return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
  return <AppLayout />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <ProtectedApp />
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
