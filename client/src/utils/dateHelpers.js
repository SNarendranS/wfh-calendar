import { format, parseISO, getDay, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from 'date-fns';

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const MONTH_NAMES_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export const TYPE_CONFIG = {
  WFH:     { label: 'WFH',     color: '#3b82f6', bg: 'bg-blue-500/20',   border: 'border-blue-500',   text: 'text-blue-400',   dot: '#3b82f6' },
  OFFICE:  { label: 'Office',  color: '#6b7280', bg: 'bg-gray-500/20',   border: 'border-gray-500',   text: 'text-gray-400',   dot: '#6b7280' },
  LEAVE:   { label: 'Leave',   color: '#10b981', bg: 'bg-emerald-500/20', border: 'border-emerald-500',text: 'text-emerald-400', dot: '#10b981' },
  HOLIDAY: { label: 'Holiday', color: '#8b5cf6', bg: 'bg-violet-500/20', border: 'border-violet-500', text: 'text-violet-400', dot: '#8b5cf6' },
  REMOTE:  { label: 'Remote',  color: '#f97316', bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-400', dot: '#f97316' },
};

export const LEAVE_COLORS = {
  PL: { color: '#10b981', bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  ML: { color: '#f59e0b', bg: 'bg-amber-500/20',   text: 'text-amber-400'   },
  EL: { color: '#ec4899', bg: 'bg-pink-500/20',    text: 'text-pink-400'    },
};

export function getDaysInMonth(year, month) {
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(start);
  return eachDayOfInterval({ start, end });
}

export function getCalendarGrid(year, month) {
  const days = getDaysInMonth(year, month);
  const firstDay = getDay(days[0]); // 0=Sun
  const grid = [];
  for (let i = 0; i < firstDay; i++) grid.push(null);
  days.forEach(d => grid.push(d));
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

export function toDateStr(date) {
  return format(date, 'yyyy-MM-dd');
}

export function formatDisplayDate(dateStr) {
  return format(parseISO(dateStr), 'MMM d, yyyy');
}

export function isoWeekday(date) {
  const d = getDay(typeof date === 'string' ? parseISO(date) : date);
  return d === 0 ? 7 : d;
}

export function isWeekend(date) {
  const d = isoWeekday(date);
  return d === 6 || d === 7;
}

export function formatDayCount(num) {
  if (num === null || num === undefined) return '0';
  if (num === Infinity) return '∞';
  const val = Number(num);
  return Number.isInteger(val) ? val.toString() : val.toFixed(1);
}

export function getEntryDisplayInfo(entry, company) {
  if (!entry) return null;
  const mainCfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG.OFFICE;

  if (!entry.isHalfDay) {
    let sublabel = entry.leaveType ? ` · ${entry.leaveType}` : '';
    return {
      isHalfDay: false,
      label: `${entry.type}${sublabel}`,
      shortLabel: entry.type === 'LEAVE' ? (entry.leaveType || 'L') : entry.type,
      cfg: mainCfg,
      color: mainCfg.color,
    };
  }

  // Half-Day Entry
  let firstLabel = entry.type === 'LEAVE' ? (entry.leaveType || 'Leave') : entry.type;
  let secondLabel = 'Office';
  let secondCfg = TYPE_CONFIG.OFFICE;

  if (entry.secondHalfType) {
    secondLabel = entry.secondHalfType === 'LEAVE' ? (entry.secondHalfLeaveType || 'Leave') : entry.secondHalfType;
    secondCfg = TYPE_CONFIG[entry.secondHalfType] || TYPE_CONFIG.OFFICE;
  }

  if (entry.halfDaySession === 'SECOND_HALF') {
    return {
      isHalfDay: true,
      session: 'SECOND_HALF',
      firstHalf: { type: 'OFFICE', label: 'Office', cfg: TYPE_CONFIG.OFFICE },
      secondHalf: { type: entry.type, label: firstLabel, cfg: mainCfg },
      summary: `½ ${firstLabel} (PM)`,
      badge: `PM: ${firstLabel}`,
    };
  }

  return {
    isHalfDay: true,
    session: entry.halfDaySession || 'FIRST_HALF',
    firstHalf: { type: entry.type, label: firstLabel, cfg: mainCfg },
    secondHalf: { type: entry.secondHalfType || 'OFFICE', label: secondLabel, cfg: secondCfg },
    summary: entry.secondHalfType && entry.secondHalfType !== 'OFFICE'
      ? `${firstLabel} / ${secondLabel}`
      : `½ ${firstLabel} (AM)`,
    badge: entry.secondHalfType && entry.secondHalfType !== 'OFFICE'
      ? `${firstLabel} + ${secondLabel}`
      : `AM: ${firstLabel}`,
  };
}