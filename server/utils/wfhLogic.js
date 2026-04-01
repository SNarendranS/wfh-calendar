import { parseISO, getDay, format, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

export function isoWeekday(date) {
  const d = getDay(typeof date === 'string' ? parseISO(date) : date);
  return d === 0 ? 7 : d;
}

export function checkWfhWarning(date, preferredDays, allWfhDates) {
  const warnings = [];
  const dayNum = isoWeekday(date);
  const dateObj = typeof date === 'string' ? parseISO(date) : date;

  if (!preferredDays.includes(dayNum)) {
    const dayNames = ['','Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const preferred = preferredDays.map(d => dayNames[d]).join('/');
    warnings.push({
      type: 'PREFERENCE',
      message: `This day (${dayNames[dayNum]}) is not your preferred WFH day (${preferred})`
    });
  }

  const isWeekend = (d) => { const wd = isoWeekday(d); return wd === 6 || wd === 7; };
  const prevDay = addDays(dateObj, -1);
  const nextDay = addDays(dateObj, 1);
  const prevOk = isWeekend(prevDay) || allWfhDates.includes(format(prevDay, 'yyyy-MM-dd'));
  const nextOk = isWeekend(nextDay) || allWfhDates.includes(format(nextDay, 'yyyy-MM-dd'));

  if (!prevOk && !nextOk) {
    warnings.push({
      type: 'LONG_WEEKEND',
      message: 'This WFH day does not extend a weekend or connect with another WFH day'
    });
  }

  return warnings;
}

export function suggestBestWfhDays(year, month, preferredDays, count, holidays, existingWfh, blockedDates = []) {
  if (count <= 0) return [];

  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(start);
  const allDays = eachDayOfInterval({ start, end });

  // Build a set of all blocked dates: holidays + existing leaves/wfh + weekends
  const holidaySet = new Set(holidays.map(h => h.date));
  const existingSet = new Set(existingWfh);
  const blockedSet = new Set(blockedDates); // leaves, holidays already on calendar

  // Sort preferred days: primary first, then fallbacks by proximity to weekend
  // e.g. preferred=[4,5] → fallback order: 3(Wed), 2(Tue), 1(Mon)
  const fallbackOrder = [4, 5, 3, 2, 1]; // Thu, Fri, Wed, Tue, Mon
  const sortedPreference = [
    ...preferredDays,
    ...fallbackOrder.filter(d => !preferredDays.includes(d))
  ];

  const isBlocked = (ds) =>
    holidaySet.has(ds) || existingSet.has(ds) || blockedSet.has(ds);

  const isWeekend = (d) => { const wd = isoWeekday(d); return wd === 6 || wd === 7; };

  // Score a candidate date
  const scoreDay = (d, alreadyPicked) => {
    const wd = isoWeekday(d);
    const ds = format(d, 'yyyy-MM-dd');
    let score = 0;

    // Preference rank score (higher = more preferred)
    const prefIdx = sortedPreference.indexOf(wd);
    score += (sortedPreference.length - prefIdx) * 10;

    // Bonus: adjacent to weekend
    const prev = addDays(d, -1);
    const next = addDays(d, 1);
    if (isWeekend(prev) || isWeekend(next)) score += 8;

    // Bonus: adjacent to another already-picked WFH day
    const prevStr = format(prev, 'yyyy-MM-dd');
    const nextStr = format(next, 'yyyy-MM-dd');
    if (existingSet.has(prevStr) || existingSet.has(nextStr) ||
        alreadyPicked.has(prevStr) || alreadyPicked.has(nextStr)) score += 5;

    // Bonus: part of same week as an existing WFH (clusters long weekends)
    const weekStart = format(addDays(d, -(isoWeekday(d) - 1)), 'yyyy-MM-dd');
    const weekEnd   = format(addDays(d,  (5 - isoWeekday(d))), 'yyyy-MM-dd');
    for (const w of [...existingSet, ...alreadyPicked]) {
      if (w >= weekStart && w <= weekEnd) { score += 3; break; }
    }

    return score;
  };

  const candidates = allDays.filter(d => {
    const wd = isoWeekday(d);
    const ds = format(d, 'yyyy-MM-dd');
    return wd >= 1 && wd <= 5 && !isBlocked(ds);
  });

  const picked = new Set();
  const result = [];

  // Greedy: pick highest-scoring available day one at a time
  for (let i = 0; i < count; i++) {
    let best = null, bestScore = -Infinity;
    for (const d of candidates) {
      const ds = format(d, 'yyyy-MM-dd');
      if (picked.has(ds)) continue;
      const s = scoreDay(d, picked);
      if (s > bestScore) { bestScore = s; best = ds; }
    }
    if (!best) break;
    picked.add(best);
    result.push(best);
  }

  return result.sort();
}