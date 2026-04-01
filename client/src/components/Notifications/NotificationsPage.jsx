import { Bell, CheckCheck, Trash2, Info, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications.js';
import { format, parseISO } from 'date-fns';

const TYPE_ICONS = {
  INFO: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
  WARNING: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  SUCCESS: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  REMINDER: { icon: Clock, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/30' },
};

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, markRead, markAllRead, deleteNotif } = useNotifications();

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-400" /> Notifications
          </h1>
          {unreadCount > 0 && <p className="text-slate-400 text-sm mt-0.5">{unreadCount} unread</p>}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm rounded-lg transition">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-slate-400 text-center py-12">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20">
          <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No notifications yet</p>
          <p className="text-slate-600 text-sm mt-1">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const cfg = TYPE_ICONS[n.type] || TYPE_ICONS.INFO;
            const Icon = cfg.icon;
            return (
              <div key={n._id}
                className={`flex items-start gap-3 p-4 rounded-xl border transition ${cfg.bg} ${!n.read ? 'opacity-100' : 'opacity-60'}`}
                onClick={() => !n.read && markRead(n._id)}>
                <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${cfg.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-medium">{n.title}</p>
                    {!n.read && <span className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0" />}
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5">{n.message}</p>
                  <p className="text-slate-600 text-xs mt-1">{format(parseISO(n.createdAt), 'MMM d, h:mm a')}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteNotif(n._id); }}
                  className="text-slate-600 hover:text-red-400 transition flex-shrink-0 mt-0.5">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
