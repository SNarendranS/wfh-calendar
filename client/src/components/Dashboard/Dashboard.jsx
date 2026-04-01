import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Home, Palmtree, HeartPulse, Vote, TrendingUp, CalendarCheck, AlertTriangle } from 'lucide-react';
import api from '../../utils/api.js';
import { MONTH_NAMES_FULL, TYPE_CONFIG, formatDisplayDate } from '../../utils/dateHelpers.js';

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-slate-700`}><Icon className={`w-5 h-5 ${color}`} /></div>
      </div>
    </div>
  );
}

function LeaveBar({ label, used, total, color }) {
  const pct = total ? Math.min(100, (used / total) * 100) : 0;
  const remaining = total - used;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-300 font-medium">{label}</span>
        <span className="text-slate-400">{remaining} left / {total}</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="text-xs text-slate-500 mt-0.5">{used} used</div>
    </div>
  );
}

export default function Dashboard() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const [balance, setBalance] = useState(null);
  const [company, setCompany] = useState(null);
  const [monthEntries, setMonthEntries] = useState([]);
  const [upcoming, setUpcoming] = useState([]);

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
      setUpcoming(all.data.filter(e => e.date >= today && (e.type === 'WFH' || e.type === 'LEAVE' || e.type === 'HOLIDAY')).slice(0, 5));
    }).catch(() => {});
  }, []);

  const wfhThisMonth = monthEntries.filter(e => e.type === 'WFH').length;
  const leaveThisMonth = monthEntries.filter(e => e.type === 'LEAVE').length;
  const wfhQuota = company?.wfhPerMonth || 8;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm">{MONTH_NAMES_FULL[month-1]} {year}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Home} label="WFH This Month" value={wfhThisMonth} sub={`of ${wfhQuota} quota`} color="text-blue-400" />
        <StatCard icon={CalendarCheck} label="WFH Remaining" value={wfhQuota - wfhThisMonth} sub="this month" color="text-cyan-400" />
        <StatCard icon={Palmtree} label="Leaves Taken" value={leaveThisMonth} sub="this month" color="text-emerald-400" />
        <StatCard icon={TrendingUp} label="Office Days" value={monthEntries.filter(e=>e.type==='OFFICE').length} sub="logged" color="text-violet-400" />
      </div>

      {/* Leave Balances */}
      {balance && company && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Palmtree className="w-4 h-4 text-emerald-400" /> Leave Balance {year}
          </h2>
          <div className="space-y-4">
            {balance.balances?.map(b => {
              const lt = company.leaveTypes?.find(l => l.key === b.leaveKey);
              return <LeaveBar key={b.leaveKey} label={lt?.label || b.leaveKey} used={b.used} total={b.total} color={lt?.color || '#10b981'} />;
            })}
          </div>
        </div>
      )}

      {/* Upcoming */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-white font-semibold mb-4">Upcoming Schedule</h2>
        {upcoming.length === 0 ? (
          <p className="text-slate-500 text-sm">No upcoming WFH or leave scheduled.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map(e => {
              const cfg = TYPE_CONFIG[e.type] || TYPE_CONFIG.WFH;
              return (
                <div key={e._id} className={`flex items-center gap-3 p-3 rounded-lg ${cfg.bg} border ${cfg.border}`}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                  <span className="text-slate-300 text-sm font-medium">{formatDisplayDate(e.date)}</span>
                  <span className={`text-xs font-semibold ml-auto ${cfg.text}`}>{e.type}{e.leaveType ? ` (${e.leaveType})` : ''}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* WFH quota warning */}
      {wfhThisMonth < Math.ceil(wfhQuota / 2) && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 font-medium text-sm">WFH Days Reminder</p>
            <p className="text-amber-400/70 text-xs mt-0.5">You've only used {wfhThisMonth} of {wfhQuota} WFH days this month. Head to Calendar to plan the rest!</p>
          </div>
        </div>
      )}
    </div>
  );
}
