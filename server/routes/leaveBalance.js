import express from 'express';
import LeaveBalance from '../models/LeaveBalance.js';
import Company from '../models/Company.js';
import CalendarEntry from '../models/CalendarEntry.js';
import { protect } from '../middleware/auth.js';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';

const router = express.Router();

/**
 * Calculate how many times a leave should have been credited by now,
 * based on the accrual frequency and credit day.
 */
function getCreditsSoFar(frequency, creditDay, year) {
  const now = new Date();
  const currentYear = now.getFullYear();
  if (currentYear > year) {
    if (frequency === 'monthly') return 12;
    if (frequency === 'quarterly') return 4;
    if (frequency === 'halfYearly') return 2;
    return 1;
  }
  if (currentYear < year) return 0;

  const month = now.getMonth() + 1;
  const day = now.getDate();

  if (frequency === 'monthly') {
    let credits = 0;
    for (let m = 1; m <= 12; m++) {
      if (m < month) { credits++; }
      else if (m === month) { if (day >= creditDay) credits++; }
    }
    return credits;
  }

  if (frequency === 'quarterly') {
    const quarters = [1, 4, 7, 10];
    let credits = 0;
    for (const qMonth of quarters) {
      if (qMonth < month) credits++;
      else if (qMonth === month && day >= creditDay) credits++;
    }
    return credits;
  }

  if (frequency === 'halfYearly') {
    const halfs = [1, 7];
    let credits = 0;
    for (const hMonth of halfs) {
      if (hMonth < month) credits++;
      else if (hMonth === month && day >= creditDay) credits++;
    }
    return credits;
  }

  if (month > 1 || (month === 1 && day >= creditDay)) return 1;
  return 0;
}

/**
 * Calculate accrued (earned) amount for a leave type given current date.
 */
function getAccrued(leaveType, year) {
  if (leaveType.unlimited) return Infinity;
  const { frequency, creditDay } = leaveType.accrualRule || { frequency: 'yearly', creditDay: 1 };
  const totalQuota = leaveType.yearlyQuota || 0;
  const creditsSoFar = getCreditsSoFar(frequency, creditDay, year);
  if (creditsSoFar === 0) return 0;

  const totalCredits = (() => {
    if (frequency === 'monthly') return 12;
    if (frequency === 'quarterly') return 4;
    if (frequency === 'halfYearly') return 2;
    return 1;
  })();

  const perPeriod = totalQuota / totalCredits;
  return Math.min(totalQuota, Math.floor(creditsSoFar * perPeriod));
}

/**
 * Calculate how many days can carry over from previous year.
 */
function computeCarryover(prevYearBalance, leaveTypeConfig) {
  if (!prevYearBalance || !leaveTypeConfig?.carryForward) return 0;
  const balance = prevYearBalance.balances?.find(b => b.leaveKey === leaveTypeConfig.key);
  if (!balance) return 0;

  // Remaining at end of prev year = total + carried - used
  const remaining = (balance.total || 0) + (balance.carried || 0) - (balance.used || 0);
  if (remaining <= 0) return 0;

  // Apply max carryover cap
  const maxCap = leaveTypeConfig.maxCarryover || 0;
  if (maxCap > 0) return Math.min(remaining, maxCap);
  return remaining; // no cap
}

/**
 * Ensure leave balance exists for a user+year, creating with carryover from previous year if needed.
 */
async function ensureLeaveBalance(userId, year, company) {
  let lb = await LeaveBalance.findOne({ userId, year });
  if (lb) return lb;

  // Find previous year's balance to compute carryover
  const prevYear = year - 1;
  const prevLb = await LeaveBalance.findOne({ userId, year: prevYear });

  lb = await LeaveBalance.create({
    userId, year,
    balances: (company.leaveTypes || []).map(lt => {
      const carried = computeCarryover(prevLb, lt);
      return {
        leaveKey:     lt.key,
        total:        lt.unlimited ? 0 : lt.yearlyQuota,
        used:         0,
        carried:      carried,
        unlimited:    lt.unlimited || false,
        monthlyQuota: lt.monthlyQuota || 0,
        weeklyQuota:  lt.weeklyQuota  || 0,
      };
    })
  });

  return lb;
}

router.get('/:year', protect, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const company = await Company.findById(req.user.companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    // Will auto-create with carryover if doesn't exist
    const lb = await ensureLeaveBalance(req.user._id, year, company);

    // Attach live weekly/monthly usage per leave type
    const now = new Date();
    const weekStart  = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd    = format(endOfWeek(now,   { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthEnd   = format(endOfMonth(now),   'yyyy-MM-dd');

    const weekEntries  = await CalendarEntry.find({ userId: req.user._id, type: 'LEAVE', date: { $gte: weekStart,  $lte: weekEnd  } });
    const monthEntries = await CalendarEntry.find({ userId: req.user._id, type: 'LEAVE', date: { $gte: monthStart, $lte: monthEnd } });

    const weekMap  = weekEntries.reduce((a, e)  => { a[e.leaveType] = (a[e.leaveType] || 0) + 1; return a; }, {});
    const monthMap = monthEntries.reduce((a, e) => { a[e.leaveType] = (a[e.leaveType] || 0) + 1; return a; }, {});

    const enriched = lb.toObject();
    enriched.balances = enriched.balances.map(b => {
      const lt = company.leaveTypes.find(l => l.key === b.leaveKey);
      const accrued = lt ? getAccrued(lt, year) : b.total;
      // Available = accrued so far this year + carried from last year - used
      const available = b.unlimited ? Infinity : Math.max(0, accrued + (b.carried || 0) - b.used);
      return {
        ...b,
        accrued:  b.unlimited ? Infinity : accrued,
        available: b.unlimited ? Infinity : available,
        usedThisWeek:  weekMap[b.leaveKey]  || 0,
        usedThisMonth: monthMap[b.leaveKey] || 0,
      };
    });

    // Add leaveTypes with accrual + carryover info for the frontend
    enriched.leaveTypes = company.leaveTypes.map(lt => ({
      key: lt.key,
      label: lt.label,
      color: lt.color,
      accrualRule: lt.accrualRule || { frequency: 'yearly', creditDay: 1 },
      carryForward: lt.carryForward || false,
      maxCarryover: lt.maxCarryover || 0,
    }));

    res.json(enriched);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:year', protect, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const { balances } = req.body;
    const lb = await LeaveBalance.findOneAndUpdate(
      { userId: req.user._id, year },
      { balances },
      { new: true, upsert: true }
    );
    res.json(lb);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

export default router;
export { computeCarryover, ensureLeaveBalance, getAccrued };