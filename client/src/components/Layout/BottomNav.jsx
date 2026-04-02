import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Bell, Settings } from 'lucide-react';

const links = [
  { to: '/',              icon: LayoutDashboard, label: 'Home'     },
  { to: '/calendar',      icon: CalendarDays,    label: 'Calendar' },
  { to: '/notifications', icon: Bell,            label: 'Alerts'   },
  { to: '/settings',      icon: Settings,        label: 'Settings' },
];

export default function BottomNav({ unreadCount }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur border-t border-slate-800 safe-area-pb">
      <div className="flex items-stretch">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[10px] font-medium transition-colors relative
               ${isActive ? 'text-blue-400' : 'text-slate-500 active:text-slate-300'}`}>
            <div className="relative">
              <Icon className="w-5 h-5" />
              {label === 'Alerts' && unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
