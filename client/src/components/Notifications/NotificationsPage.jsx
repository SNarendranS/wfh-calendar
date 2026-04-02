import { Bell, CheckCheck, Trash2, Info, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications.js';
import { format, parseISO, isToday, isYesterday } from 'date-fns';

const TYPE_CFG = {
  INFO:     { icon: Info,          color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20'    },
  WARNING:  { icon: AlertTriangle, color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20'  },
  SUCCESS:  { icon: CheckCircle,   color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  REMINDER: { icon: Clock,         color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20' },
};

function timeLabel(iso) {
  const d = parseISO(iso);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, markRead, markAllRead, deleteNotif } = useNotifications();

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 lg:px-6 py-4">
        <div className="flex items-center justify-between max-w-2xl lg:max-w-3xl mx-auto lg:mx-0">
          <div>
            <h1 className="text-lg lg:text-2xl font-bold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-400" /> Notifications
            </h1>
            {unreadCount > 0 && (
              <p className="text-slate-400 text-xs mt-0.5">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-xl active:bg-slate-700">
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="px-4 lg:px-6 py-3 max-w-2xl lg:max-w-3xl mx-auto lg:mx-0">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-slate-300 font-medium">You're all caught up!</p>
            <p className="text-slate-600 text-sm mt-1">No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-2 py-2">
            {notifications.map(n => {
              const cfg = TYPE_CFG[n.type] || TYPE_CFG.INFO;
              const Icon = cfg.icon;
              return (
                <div key={n._id}
                  onClick={() => !n.read && markRead(n._id)}
                  className={`flex items-start gap-3 p-4 rounded-2xl border transition active:scale-[0.99] cursor-pointer
                    ${cfg.bg} ${!n.read ? 'opacity-100' : 'opacity-50'}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-800/50`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-white text-sm font-medium leading-snug">{n.title}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!n.read && <div className="w-2 h-2 bg-blue-400 rounded-full mt-1" />}
                        <span className="text-slate-600 text-[10px]">{timeLabel(n.createdAt)}</span>
                      </div>
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{n.message}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteNotif(n._id); }}
                    className="text-slate-700 hover:text-red-400 active:text-red-300 transition flex-shrink-0 p-1 -mr-1 mt-0.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
