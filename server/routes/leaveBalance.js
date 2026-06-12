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
    // Past year — fully accrued
    if (frequency === 'monthly') return 12;
    if (frequency === 'quarterly') return 4;
    if (frequency === 'halfYearly') return 2;
    return 1; // yearly
  }
  if (currentYear < year) return 0; // future year

  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();

  if (frequency === 'monthly') {
    // Count how many credit days have passed this year
    let credits = 0;
    for (let m = 1; m <= 12; m++) {
      // Credit happens on creditDay of each month
      // If we're past that month, it's been credited
      if (m < month) {
        credits++;
      } else if (m === month) {
        // Credit hasn't happened yet this month if we're before creditDay
        if (day >= creditDay) credits++;
      }
    }
    return credits;
  }

  if (frequency === 'quarterly') {
    const quarters = [1, 4, 7, 10]; // Jan, Apr, Jul, Oct
    let credits = 0;
    for (const qMonth of quarters) {
      if (qMonth < month) {
        credits++;
      } else if (qMonth === month) {
        if (day >= creditDay) credits++;
      }
    }
    return credits;
  }

  if (frequency === 'halfYearly') {
    const halfs = [1, 7]; // Jan, Jul
    let credits = 0;
    for (const hMonth of halfs) {
      if (hMonth < month) {
        credits++;
      } else if (hMonth === month) {
        if (day >= creditDay) credits++;
      }
    }
    return credits;
  }

  // yearly — credited once on creditDay of January
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
    return 1; // yearly
  })();

  // How much is credited per period
  const perPeriod = totalQuota / totalCredits;
  return Math.min(totalQuota, Math.floor(creditsSoFar * perPeriod));
}

router.get('/:year', protect, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const company = await Company.findById(req.user.companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    let lb = await LeaveBalance.findOne({ userId: req.user._id, year });
    if (!lb) {
      lb = await LeaveBalance.create({
        userId: req.user._id, year,
        balances: (company.leaveTypes || []).map(lt => ({
          leaveKey:     lt.key,
          total:        lt.unlimited ? 0 : lt.yearlyQuota,
          used:         0, carried: 0,
          unlimited:    lt.unlimited || false,
          monthlyQuota: lt.monthlyQuota || 0,
          weeklyQuota:  lt.weeklyQuota  || 0,
        }))
      });
    }

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
      return {
        ...b,
        accrued: b.unlimited ? Infinity : accrued,
        usedThisWeek:  weekMap[b.leaveKey]  || 0,
        usedThisMonth: monthMap[b.leaveKey] || 0,
      };
    });

    // Add leaveTypes with accrual info for the frontend
    enriched.leaveTypes = company.leaveTypes.map(lt => ({
      key: lt.key,
      label: lt.label,
      color: lt.color,
      accrualRule: lt.accrualRule || { frequency: 'yearly', creditDay: 1 },
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