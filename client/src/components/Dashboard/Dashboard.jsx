import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Home, Palmtree, TrendingUp, CalendarCheck, AlertTriangle, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../utils/api.js';
import { MONTH_NAMES_FULL, TYPE_CONFIG, formatDisplayDate } from '../../utils/dateHelpers.js';

function StatCard({ icon: Icon, label, value, sub, color, bgColor }) {
  return (
    <div className={`rounded-2xl p-4 border border-slate-700 bg-slate-800`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`w-9 h-9 rounded-xl ${bgColor} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <span className={`text-2xl font-bold ${color}`}>{value}</span>
      </div>
      <p className="text-slate-300 text-sm font-medium">{label}</p>
      {sub && <p className="text-slate-500 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

function LeaveBar({ label, used, total, color }) {
  const pct = total ? Math.min(100, (used / total) * 100) : 0;
  const remaining = total - used;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-slate-200 font-medium">{label}</span>
        <span className="text-slate-400 text-xs">{remaining} left</span>
      </div>
      <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="flex justify-between text-xs text-slate-600 mt-0.5">
        <span>{used} used</span><span>/{total}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const { user, logout } = useAuth();
  const [balance, setBalance] = useState(null);
  const [company, setCompany] = useState(null);
  const [monthEntries, setMonthEntries] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/leave-balance/${year}`),
      api.get('/company'),
      api.get('/calendar', { params: { year, month } }),
      api.get('/calendar', { params: { year } })
    ]).then(([lb, co, me, all]) => {
      setBalance(lb.data);
      setCompany(co.data);
      setMonthEntries(me.data);
      const today = format(now, 'yyyy-MM-dd');
      setUpcoming(all.data
        .filter(e => e.date >= today && ['WFH','LEAVE','HOLIDAY'].includes(e.type))
        .slice(0, 6));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const wfhThisMonth = monthEntries.filter(e => e.type === 'WFH').length;
  const leaveThisMonth = monthEntries.filter(e => e.type === 'LEAVE').length;
  const wfhQuota = company?.wfhPerMonth || 8;

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-2xl lg:max-w-5xl mx-auto lg:mx-0">
      {/* Mobile header */}
      <div className="flex items-center justify-between lg:hidden pt-2">
        <div>
          <h1 className="text-xl font-bold text-white">Hi, {user?.username} 👋</h1>
          <p className="text-slate-400 text-xs mt-0.5">{MONTH_NAMES_FULL[month-1]} {year}</p>
        </div>
        <button onClick={logout} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400">
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:block">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm">{MONTH_NAMES_FULL[month-1]} {year}</p>
      </div>

      {/* Stats grid — 2 col mobile, 4 col desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Home}         label="WFH This Month" value={wfhThisMonth}          sub={`of ${wfhQuota} quota`} color="text-blue-400"    bgColor="bg-blue-500/10" />
        <StatCard icon={CalendarCheck} label="WFH Remaining"  value={wfhQuota-wfhThisMonth} sub="days left"             color="text-cyan-400"    bgColor="bg-cyan-500/10" />
        <StatCard icon={Palmtree}     label="Leaves Taken"   value={leaveThisMonth}         sub="this month"            color="text-emerald-400" bgColor="bg-emerald-500/10" />
        <StatCard icon={TrendingUp}   label="Office Days"    value={monthEntries.filter(e=>e.type==='OFFICE').length} sub="logged" color="text-violet-400" bgColor="bg-violet-500/10" />
      </div>

      {/* WFH quota bar */}
      <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-300 font-medium">WFH Quota</span>
          <span className="text-blue-400 font-semibold">{wfhThisMonth}/{wfhQuota}</span>
        </div>
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100,(wfhThisMonth/wfhQuota)*100)}%` }} />
        </div>
      </div>

      {/* Leave Balances */}
      {balance && company && (
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2 text-sm">
            <Palmtree className="w-4 h-4 text-emerald-400" /> Leave Balance {year}
          </h2>
          <div className="space-y-4">
            {balance.balances?.map(b => {
              const lt = company.leaveTypes?.find(l => l.key === b.leaveKey);
              return <LeaveBar key={b.leaveKey} label={lt?.label || b.leaveKey}
                used={b.used} total={b.total} color={lt?.color || '#10b981'} />;
            })}
          </div>
        </div>
      )}

      {/* Upcoming */}
      <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
        <h2 className="text-white font-semibold mb-3 text-sm">Upcoming Schedule</h2>
        {upcoming.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">No upcoming WFH or leave scheduled.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map(e => {
              const cfg = TYPE_CONFIG[e.type] || TYPE_CONFIG.WFH;
              return (
                <div key={e._id} className={`flex items-center gap-3 p-3 rounded-xl ${cfg.bg} border ${cfg.border}`}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                  <span className="text-slate-200 text-sm flex-1">{formatDisplayDate(e.date)}</span>
                  <span className={`text-xs font-semibold ${cfg.text} flex-shrink-0`}>
                    {e.type}{e.leaveType ? ` · ${e.leaveType}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Warning */}
      {wfhThisMonth < Math.ceil(wfhQuota / 2) && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 font-medium text-sm">WFH Days Reminder</p>
            <p className="text-amber-400/70 text-xs mt-0.5">Only {wfhThisMonth}/{wfhQuota} WFH days planned. Go to Calendar to fill them!</p>
          </div>
        </div>
      )}

      {/* Bottom padding for mobile nav */}
      <div className="h-2 lg:h-0" />
    </div>
  );
}
