import { useState, useEffect } from 'react';
import { format, parseISO, isAfter, isBefore, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth } from 'date-fns';
import { Home, Palmtree, TrendingUp, CalendarCheck, AlertTriangle, LogOut, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../utils/api.js';
import { MONTH_NAMES_FULL, MONTH_NAMES, toDateStr } from '../../utils/dateHelpers.js';

function StatCard({ icon: Icon, label, value, sub, color, bgColor }) {
  return (
    <div className="rounded-2xl p-4 border border-slate-700 bg-slate-800">
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

function LeaveBar({ b, lt }) {
  const isUnlimited = b.unlimited;
  const pct = isUnlimited ? 0 : (b.total ? Math.min(100, (b.used / b.total) * 100) : 0);
  const remaining = isUnlimited ? '∞' : (b.total - b.used);
  const color = lt?.color || '#10b981';
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-slate-200 text-sm font-medium">{lt?.label || b.leaveKey}</span>
        </div>
        <span className="text-slate-400 text-xs font-medium">
          {isUnlimited ? `${b.used} used · ∞` : `${remaining} left / ${b.total}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {b.weeklyQuota > 0 && (
          <span className="text-[10px] text-slate-500 bg-slate-700/50 rounded-md px-1.5 py-0.5">
            This week: {b.usedThisWeek || 0}/{b.weeklyQuota}
          </span>
        )}
        {b.monthlyQuota > 0 && (
          <span className="text-[10px] text-slate-500 bg-slate-700/50 rounded-md px-1.5 py-0.5">
            This month: {b.usedThisMonth || 0}/{b.monthlyQuota}
          </span>
        )}
        {isUnlimited && (
          <span className="text-[10px] text-slate-500 bg-slate-700/50 rounded-md px-1.5 py-0.5">
            {b.usedThisMonth || 0} days this month
          </span>
        )}
      </div>
    </div>
  );
}

function MiniCalendar({ year, month, holidays, entries }) {
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(start);
  const days = eachDayOfInterval({ start, end });
  const firstDow = getDay(start);
  const calEntryHolidays = entries.filter(e => e.type === 'HOLIDAY').map(e => e.date);
  const holidayDates = new Set([...holidays.map(h => h.date), ...calEntryHolidays]);
  const entryMap = entries.reduce((a, e) => { a[e.date] = e; return a; }, {});
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  days.forEach(d => cells.push(d));
  while (cells.length % 7 !== 0) cells.push(null);
  const today = toDateStr(new Date());
  return (
    <div>
      <div className="grid grid-cols-7 mb-0">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[9px] font-semibold text-slate-600 py-0.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const ds = toDateStr(date);
          const dow = getDay(date);
          const isWeekend = dow === 0 || dow === 6;
          const isHoliday = holidayDates.has(ds);
          const entry = entryMap[ds];
          const isToday = ds === today;
          return (
            <div key={i} className={`relative flex items-center justify-center rounded-md text-[10px] font-medium size-12 my-0.5 mx-2 transition
              ${isToday ? 'ring-1 ring-blue-500' : ''}
              ${isHoliday ? 'bg-violet-500/20 text-violet-300' :
                entry?.type === 'WFH' ? 'bg-blue-500/20 text-blue-300' :
                  entry?.type === 'LEAVE' ? 'bg-emerald-500/20 text-emerald-300' :
                    isWeekend ? 'text-slate-600' : 'text-slate-400'}`}>
              {date.getDate()}
              {isHoliday && <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-violet-400 rounded-full" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HolidayCalendar({ holidays, entries }) {
  const now = new Date();
  const [tab, setTab] = useState('calendar');
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 5;

  const navigate = (dir) => {
    let m = viewMonth + dir, y = viewYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setViewMonth(m); setViewYear(y);
  };

  const today = toDateStr(now);

  const calHolidays = entries
    .filter(e => e.type === 'HOLIDAY')
    .map(e => ({ date: e.date, name: e.note || e.holidayName || 'Holiday' }));
  const allHolidays = Object.values(
    [...holidays, ...calHolidays].reduce((acc, h) => { acc[h.date] = h; return acc; }, {})
  ).sort((a, b) => a.date.localeCompare(b.date));

  const upcomingAll = allHolidays.filter(h => h.date >= today);
  const totalPages = Math.ceil(upcomingAll.length / PAGE_SIZE);
  const pageItems = upcomingAll.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const monthEntries = entries.filter(e => {
    const [y, m] = e.date.split('-').map(Number);
    return y === viewYear && m === viewMonth;
  });

  return (
    // Fixed height — never shrinks or grows between tabs or pages
    <div
      className="bg-slate-800 rounded-2xl border border-slate-700 flex flex-col overflow-hidden"
      style={{ height: '32rem' }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-violet-400" />
          <h2 className="text-white font-semibold text-sm">Holiday Calendar</h2>
        </div>
        <div className="flex bg-slate-900 rounded-lg p-0.5 gap-0.5">
          {[['calendar', 'Cal'], ['list', 'List']].map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); setPage(0); }}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                tab === key ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Body — fills remaining fixed height, no overflow-hidden so nothing clips */}
      <div className="flex-1 flex flex-col p-4 min-h-0">

        {tab === 'calendar' ? (
          // flex-col + h-full so legend is always last and never hidden
          <div className="flex flex-col h-full">

            {/* Month nav */}
            <div className="flex items-center justify-between flex-shrink-0 mb-3">
              <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg bg-slate-700 text-slate-400 active:bg-slate-600">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-slate-200 text-xs font-semibold">
                {MONTH_NAMES_FULL[viewMonth - 1]} {viewYear}
              </span>
              <button onClick={() => navigate(1)} className="p-1.5 rounded-lg bg-slate-700 text-slate-400 active:bg-slate-600">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Calendar grid */}
            <div className="flex-1 min-h-0">
              <MiniCalendar
                year={viewYear}
                month={viewMonth}
                holidays={allHolidays}
                entries={monthEntries}
              />
            </div>

            {/* Legend — flex-shrink-0 so it is NEVER clipped regardless of how many rows the month has */}
            <div className="flex gap-3 pt-2 flex-wrap flex-shrink-0">
              {[
                { color: 'bg-violet-500/50', label: 'Holiday' },
                { color: 'bg-blue-500/50', label: 'WFH' },
                { color: 'bg-emerald-500/50', label: 'Leave' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <div className={`w-2.5 h-2.5 rounded ${l.color}`} />{l.label}
                </div>
              ))}
            </div>
          </div>

        ) : (
          // List tab — h-full + flex-col, pagination always pinned to bottom via mt-auto
          <div className="flex flex-col h-full">

            <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold mb-2 flex-shrink-0">
              {upcomingAll.length} upcoming holiday{upcomingAll.length !== 1 ? 's' : ''}
            </p>

            {upcomingAll.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <CalendarDays className="w-8 h-8 text-slate-700 mb-2" />
                <p className="text-slate-600 text-xs">No upcoming holidays</p>
              </div>
            ) : (
              <>
                {/* No scroll — items stack naturally, empty space shows below if fewer than PAGE_SIZE */}
                <div className="space-y-2 flex-shrink-0">
                  {pageItems.map((h, i) => {
                    const d = parseISO(h.date);
                    const globalIdx = page * PAGE_SIZE + i;
                    const isNext = globalIdx === 0;
                    return (
                      <div key={h.date}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition
                          ${isNext
                            ? 'bg-violet-600/15 border-violet-500/30'
                            : 'bg-slate-700/30 border-slate-700/50'
                          }`}>
                        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex flex-col items-center justify-center
                          ${isNext ? 'bg-violet-600/30' : 'bg-slate-700'}`}>
                          <span className={`text-[9px] uppercase font-bold leading-none ${isNext ? 'text-violet-300' : 'text-slate-500'}`}>
                            {format(d, 'MMM')}
                          </span>
                          <span className={`text-base font-bold leading-tight ${isNext ? 'text-violet-200' : 'text-slate-300'}`}>
                            {format(d, 'd')}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isNext ? 'text-white' : 'text-slate-200'}`}>
                            {h.name}
                          </p>
                          <p className={`text-[10px] mt-0.5 ${isNext ? 'text-violet-400' : 'text-slate-500'}`}>
                            {format(d, 'EEEE')}{isNext ? ' · Next holiday' : ''}
                          </p>
                        </div>
                        {isNext && (
                          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0 animate-pulse" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* mt-auto pins pagination to bottom regardless of item count on the page */}
                <div className="mt-auto pt-3 border-t border-slate-700/60 flex items-center justify-between flex-shrink-0">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold
                      text-slate-300 bg-slate-700 disabled:opacity-30 active:bg-slate-600 transition">
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                  </button>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button key={i} onClick={() => setPage(i)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          i === page ? 'bg-violet-400 w-4' : 'bg-slate-600 w-1.5 hover:bg-slate-500'
                        }`} />
                    ))}
                  </div>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold
                      text-slate-300 bg-slate-700 disabled:opacity-30 active:bg-slate-600 transition">
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
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
  const [allEntries, setAllEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/leave-balance/${year}`),
      api.get('/company'),
      api.get('/calendar', { params: { year, month } }),
      api.get('/calendar', { params: { year } }),
    ]).then(([lb, co, me, all]) => {
      setBalance(lb.data);
      setCompany(co.data);
      setMonthEntries(me.data);
      setAllEntries(all.data);
    }).catch(() => { }).finally(() => setLoading(false));
  }, []);

  const wfhThisMonth = monthEntries.filter(e => e.type === 'WFH').length;
  const leaveThisMonth = monthEntries.filter(e => e.type === 'LEAVE').length;
  const wfhQuota = company?.wfhPerMonth || 8;
  const today = toDateStr(now);

  const upcoming = allEntries
    .filter(e => e.date >= today && ['WFH', 'LEAVE', 'HOLIDAY'].includes(e.type))
    .slice(0, 5);

  const TYPE_DOT = { WFH: 'bg-blue-500', LEAVE: 'bg-emerald-500', HOLIDAY: 'bg-violet-500' };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-2xl lg:max-w-5xl mx-auto lg:mx-0">
      {/* Mobile header */}
      <div className="flex items-center justify-between lg:hidden pt-2">
        <div>
          <h1 className="text-xl font-bold text-white">Hi, {user?.username} 👋</h1>
          <p className="text-slate-400 text-xs mt-0.5">{MONTH_NAMES_FULL[month - 1]} {year}</p>
        </div>
        <button onClick={logout} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 active:bg-slate-700">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
      <div className="hidden lg:block">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm">{MONTH_NAMES_FULL[month - 1]} {year}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Home} label="WFH This Month" value={wfhThisMonth} sub={`of ${wfhQuota} quota`} color="text-blue-400" bgColor="bg-blue-500/10" />
        <StatCard icon={CalendarCheck} label="WFH Remaining" value={wfhQuota - wfhThisMonth} sub="days left" color="text-cyan-400" bgColor="bg-cyan-500/10" />
        <StatCard icon={Palmtree} label="Leaves Taken" value={leaveThisMonth} sub="this month" color="text-emerald-400" bgColor="bg-emerald-500/10" />
        <StatCard icon={TrendingUp} label="Office Days" value={monthEntries.filter(e => e.type === 'OFFICE').length} sub="logged" color="text-violet-400" bgColor="bg-violet-500/10" />
      </div>

      {/* WFH quota bar */}
      <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-300 font-medium">WFH Quota</span>
          <span className="text-blue-400 font-semibold">{wfhThisMonth}/{wfhQuota}</span>
        </div>
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, (wfhThisMonth / wfhQuota) * 100)}%` }} />
        </div>
      </div>

      {/* Two-column: Leave Balance + Holiday Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:items-start">
        {balance && company && (
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2 text-sm">
              <Palmtree className="w-4 h-4 text-emerald-400" /> Leave Balance {year}
            </h2>
            <div className="space-y-4">
              {balance.balances?.map(b => {
                const lt = company.leaveTypes?.find(l => l.key === b.leaveKey);
                return <LeaveBar key={b.leaveKey} b={b} lt={lt} />;
              })}
            </div>
          </div>
        )}
        {company && (
          <HolidayCalendar holidays={company.publicHolidays || []} entries={allEntries} />
        )}
      </div>

      {/* Upcoming Schedule */}
      <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
        <h2 className="text-white font-semibold mb-3 text-sm">Upcoming Schedule</h2>
        {upcoming.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">No upcoming WFH or leave scheduled.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map(e => {
              const d = parseISO(e.date);
              return (
                <div key={e._id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/40 border border-slate-700">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${TYPE_DOT[e.type] || 'bg-slate-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 text-sm">{format(d, 'EEE, MMM d')}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg flex-shrink-0
                    ${e.type === 'WFH' ? 'bg-blue-500/20 text-blue-300' :
                      e.type === 'LEAVE' ? 'bg-emerald-500/20 text-emerald-300' :
                        'bg-violet-500/20 text-violet-300'}`}>
                    {e.type}{e.leaveType ? ` · ${e.leaveType}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {wfhThisMonth < Math.ceil(wfhQuota / 2) && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 font-medium text-sm">WFH Days Reminder</p>
            <p className="text-amber-400/70 text-xs mt-0.5">Only {wfhThisMonth}/{wfhQuota} WFH days planned. Go to Calendar to fill them!</p>
          </div>
        </div>
      )}

      <div className="h-2 lg:h-0" />
    </div>
  );
}
