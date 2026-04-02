import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Settings, Bell, LogOut, Home } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const links = [
  { to: '/',              icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/calendar',      icon: CalendarDays,    label: 'Calendar'  },
  { to: '/notifications', icon: Bell,            label: 'Alerts'    },
  { to: '/settings',      icon: Settings,        label: 'Settings'  },
];

export default function Sidebar({ unreadCount }) {
  const { user, logout } = useAuth();
  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen fixed left-0 top-0">
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Home className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white text-sm">WFH Calendar</div>
            <div className="text-slate-500 text-xs truncate">{user?.username}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition relative ${
                isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}>
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
            {label === 'Alerts' && unreadCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <button onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 w-full transition">
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </aside>
  );
}
