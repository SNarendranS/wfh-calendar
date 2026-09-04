import express from 'express';
import { format, parseISO, addDays, eachDayOfInterval } from 'date-fns';
import CalendarEntry from '../models/CalendarEntry.js';
import LeaveBalance from '../models/LeaveBalance.js';
import Company from '../models/Company.js';
import User from '../models/User.js';
import Follow from '../models/Follow.js';
import Notification from '../models/Notification.js';
import { protect } from '../middleware/auth.js';
import { checkWfhWarning, suggestBestWfhDays } from '../utils/wfhLogic.js';
import { ensureLeaveBalance } from './leaveBalance.js';

const router = express.Router();

/**
 * Calculate accrued (earned) amount for a leave type given current date.
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

// Get entries for a year or month (own calendar)
router.get('/', protect, async (req, res) => {
  try {
    const { year, month } = req.query;
    const filter = { userId: req.user._id };
    if (year) filter.year = parseInt(year);
    if (month) filter.month = parseInt(month);
    const entries = await CalendarEntry.find(filter).sort({ date: 1 });
    res.json(entries);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get another user's calendar entries (access control enforced)
router.get('/user/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { year, month } = req.query;

    // Can't view own calendar via this route
    if (userId === req.user._id.toString()) {
      return res.redirect('/api/calendar?' + new URLSearchParams({ year, month }).toString());
    }

    const targetUser = await User.findById(userId).select('visibility');
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    let canView = false;

    if (targetUser.visibility === 'public') {
      canView = true;
    } else if (targetUser.visibility === 'followers') {
      // Check if the current user is an accepted follower
      const follow = await Follow.findOne({
        follower: req.user._id,
        following: userId,
        status: 'accepted'
      });
      canView = !!follow;
    } else {
      canView = false; // private
    }

    if (!canView) {
      return res.status(403).json({
        message: 'This user\'s calendar is not visible to you. Send a follow request to view their schedule.',
        visible: false
      });
    }

    const filter = { userId };
    if (year) filter.year = parseInt(year);
    if (month) filter.month = parseInt(month);
    const entries = await CalendarEntry.find(filter).sort({ date: 1 });

    res.json({ entries, visible: true, visibility: targetUser.visibility });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Helper to calculate leave weights for an entry
function getLeaveUsageByEntry(entry) {
  const usage = {};
  if (!entry) return usage;
  if (entry.type === 'LEAVE' && entry.leaveType) {
    const weight = entry.isHalfDay ? 0.5 : 1.0;
    usage[entry.leaveType] = (usage[entry.leaveType] || 0) + weight;
  }
  if (entry.isHalfDay && entry.secondHalfType === 'LEAVE' && entry.secondHalfLeaveType) {
    usage[entry.secondHalfLeaveType] = (usage[entry.secondHalfLeaveType] || 0) + 0.5;
  }
  return usage;
}

// Helper to calculate WFH weight for an entry
function getWfhWeight(entry) {
  if (!entry) return 0;
  if (!entry.isHalfDay) {
    return entry.type === 'WFH' ? 1.0 : 0;
  }
  let weight = 0;
  if (entry.type === 'WFH') weight += 0.5;
  if (entry.secondHalfType === 'WFH') weight += 0.5;
  return weight;
}

// Add or update a single entry
router.post('/', protect, async (req, res) => {
  try {
    const {
      date,
      type,
      leaveType,
      note,
      isHalfDay = false,
      halfDaySession = null,
      secondHalfType = null,
      secondHalfLeaveType = null
    } = req.body;

    if (!date || !type) return res.status(400).json({ message: 'date and type required' });

    const dateObj = parseISO(date);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;

    // Get company for warnings and leave type config
    const company = await Company.findById(req.user.companyId);
    const holidays = company?.publicHolidays || [];

    // 1. Validate half-day leave permissions
    if (isHalfDay) {
      if (type === 'LEAVE' && leaveType) {
        const ltConfig = company?.leaveTypes?.find(l => l.key === leaveType);
        if (ltConfig && ltConfig.allowHalfDay === false) {
          return res.status(400).json({
            message: `${ltConfig.label} cannot be taken as a half-day leave. Only full-day leave is allowed.`
          });
        }
      }
      if (secondHalfType === 'LEAVE' && secondHalfLeaveType) {
        const ltConfig = company?.leaveTypes?.find(l => l.key === secondHalfLeaveType);
        if (ltConfig && ltConfig.allowHalfDay === false) {
          return res.status(400).json({
            message: `${ltConfig.label} cannot be taken as a half-day leave. Only full-day leave is allowed.`
          });
        }
      }
    }

    const existingEntry = await CalendarEntry.findOne({ userId: req.user._id, date });
    const oldLeaveUsage = getLeaveUsageByEntry(existingEntry);

    const proposedEntry = {
      type,
      leaveType: type === 'LEAVE' ? leaveType : undefined,
      isHalfDay,
      halfDaySession,
      secondHalfType: isHalfDay ? secondHalfType : null,
      secondHalfLeaveType: isHalfDay && secondHalfType === 'LEAVE' ? secondHalfLeaveType : null,
    };
    const newLeaveUsage = getLeaveUsageByEntry(proposedEntry);

    // 2. Validate leave balance for any new/increased leave usage
    const lb = await LeaveBalance.findOne({ userId: req.user._id, year });
    const leaveKeys = new Set([...Object.keys(oldLeaveUsage), ...Object.keys(newLeaveUsage)]);

    for (const lk of leaveKeys) {
      const oldUsed = oldLeaveUsage[lk] || 0;
      const newUsed = newLeaveUsage[lk] || 0;
      const netDelta = newUsed - oldUsed;

      if (netDelta > 0) {
        const ltConfig = company?.leaveTypes?.find(l => l.key === lk);
        if (ltConfig && !ltConfig.unlimited) {
          const balance = lb?.balances?.find(b => b.leaveKey === lk);
          const accrued = getAccrued(ltConfig, year);
          const carried = balance?.carried || 0;
          const available = accrued + carried;
          const currentTotalUsed = balance?.used || 0;

          if (currentTotalUsed + netDelta > available) {
            return res.status(400).json({
              message: `Insufficient leave balance. You have used ${currentTotalUsed}/${available} ${ltConfig.label} leaves (${accrued} accrued + ${carried} carried). More leaves will be credited on the next cycle (${ltConfig.accrualRule?.frequency || 'yearly'}).`
            });
          }
        }
      }
    }

    let warnings = [];

    // 3. Validate WFH Quota
    const newWfhWeight = getWfhWeight(proposedEntry);
    const oldWfhWeight = getWfhWeight(existingEntry);
    const wfhDelta = newWfhWeight - oldWfhWeight;

    if (wfhDelta > 0 || newWfhWeight > 0) {
      const monthEntries = await CalendarEntry.find({ userId: req.user._id, year, month });
      const currentMonthWfhWeight = monthEntries
        .filter(e => e.date !== date)
        .reduce((sum, e) => sum + getWfhWeight(e), 0);

      const maxWfhQuota = company?.wfhPerMonth || 8;
      if (currentMonthWfhWeight + newWfhWeight > maxWfhQuota) {
        return res.status(400).json({
          message: `WFH quota for this month (${maxWfhQuota}) already reached. Current usage: ${currentMonthWfhWeight + oldWfhWeight} days.`
        });
      }

      if (type === 'WFH' || secondHalfType === 'WFH') {
        const allWfhDates = monthEntries.filter(e => e.type === 'WFH' || e.secondHalfType === 'WFH').map(e => e.date);
        warnings = checkWfhWarning(date, company?.preferredWfhDays || [4, 5], allWfhDates);
      }
    }

    // 4. Upsert entry
    const entry = await CalendarEntry.findOneAndUpdate(
      { userId: req.user._id, date },
      {
        userId: req.user._id,
        date,
        type,
        leaveType: type === 'LEAVE' ? leaveType : undefined,
        note,
        year,
        month,
        isHalfDay: !!isHalfDay,
        halfDaySession: isHalfDay ? halfDaySession : null,
        secondHalfType: isHalfDay ? secondHalfType : null,
        secondHalfLeaveType: isHalfDay && secondHalfType === 'LEAVE' ? secondHalfLeaveType : null,
      },
      { upsert: true, new: true }
    );

    // 5. Update leave balances atomically
    for (const lk of leaveKeys) {
      const oldUsed = oldLeaveUsage[lk] || 0;
      const newUsed = newLeaveUsage[lk] || 0;
      const netDelta = newUsed - oldUsed;
      if (netDelta !== 0) {
        await LeaveBalance.findOneAndUpdate(
          { userId: req.user._id, year, 'balances.leaveKey': lk },
          { $inc: { 'balances.$.used': netDelta } }
        );
      }
    }

    // Create warning notifications
    for (const w of warnings) {
      await Notification.create({
        userId: req.user._id,
        title: w.type === 'PREFERENCE' ? 'WFH Preference Warning' : 'Long Weekend Warning',
        message: w.message,
        type: 'WARNING',
        relatedDate: date
      });
    }

    res.json({ entry, warnings });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delete / clear an entry
router.delete('/:date', protect, async (req, res) => {
  try {
    const { date } = req.params;
    const entry = await CalendarEntry.findOneAndDelete({ userId: req.user._id, date });
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    // Restore leave balance
    const year = parseISO(date).getFullYear();
    const leaveUsage = getLeaveUsageByEntry(entry);
    for (const [lk, amount] of Object.entries(leaveUsage)) {
      if (amount > 0) {
        await LeaveBalance.findOneAndUpdate(
          { userId: req.user._id, year, 'balances.leaveKey': lk },
          { $inc: { 'balances.$.used': -amount } }
        );
      }
    }

    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Bulk set WFH for a month (auto-generate)
router.post('/bulk-wfh', protect, async (req, res) => {
  try {
    const { year, month, dates } = req.body;
    const company = await Company.findById(req.user.companyId);

    // Clear existing auto-generated WFH for this month
    await CalendarEntry.deleteMany({ userId: req.user._id, year, month, type: 'WFH', autoGenerated: true });

    const ops = dates.map(date => ({
      updateOne: {
        filter: { userId: req.user._id, date },
        update: { userId: req.user._id, date, type: 'WFH', year, month, autoGenerated: true, isHalfDay: false },
        upsert: true
      }
    }));
    await CalendarEntry.bulkWrite(ops);

    res.json({ message: `${dates.length} WFH days set for ${year}-${month}` });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get WFH suggestions for a month
router.get('/suggest-wfh', protect, async (req, res) => {
  try {
    const { year, month } = req.query;
    const y = parseInt(year), m = parseInt(month);
    const company = await Company.findById(req.user.companyId);

    // Get ALL entries for this month to know what's blocked
    const monthEntries = await CalendarEntry.find({ userId: req.user._id, year: y, month: m });
    const existingWfh = monthEntries
      .filter(e => e.type === 'WFH' || e.secondHalfType === 'WFH')
      .map(e => e.date);
    const blockedDates = monthEntries
      .filter(e => e.type === 'LEAVE' || e.type === 'HOLIDAY')
      .map(e => e.date);

    const existingWfhWeight = monthEntries.reduce((sum, e) => sum + getWfhWeight(e), 0);
    const remaining = Math.max(0, Math.floor((company?.wfhPerMonth || 8) - existingWfhWeight));

    const suggestions = suggestBestWfhDays(
      y, m,
      company?.preferredWfhDays || [4, 5],
      remaining,
      company?.publicHolidays || [],
      existingWfh,
      blockedDates
    );
    res.json({ suggestions });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Multi-day / Range batch marking with custom boundary half-day options
router.post('/multi-day', protect, async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      type,
      leaveType,
      startSession = 'FULL', // 'FULL' | 'SECOND_HALF'
      endSession = 'FULL',   // 'FULL' | 'FIRST_HALF'
      singleDayMode = 'FULL', // 'FULL' | 'FIRST_HALF' | 'SECOND_HALF' | 'CUSTOM_SPLIT'
      secondHalfType = null,
      secondHalfLeaveType = null,
      skipWeekends = true,
      skipHolidays = true,
      note
    } = req.body;

    if (!startDate || !endDate || !type) {
      return res.status(400).json({ message: 'startDate, endDate, and type are required' });
    }

    const startObj = parseISO(startDate);
    const endObj = parseISO(endDate);

    if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) {
      return res.status(400).json({ message: 'Invalid date format. Expected YYYY-MM-DD.' });
    }

    if (startObj > endObj) {
      return res.status(400).json({ message: 'startDate cannot be after endDate' });
    }

    const allDates = eachDayOfInterval({ start: startObj, end: endObj });
    if (allDates.length > 90) {
      return res.status(400).json({ message: 'Date range cannot exceed 90 days at a time' });
    }

    const company = await Company.findById(req.user.companyId);
    const holidays = company?.publicHolidays || [];
    const holidayDateSet = new Set(holidays.map(h => h.date));
    const isSingleDay = startDate === endDate;

    const shouldSkipWeekends = skipWeekends !== undefined
      ? skipWeekends
      : (company?.skipWeekendsOnMultiDay !== undefined ? company.skipWeekendsOnMultiDay : true);
    const shouldSkipHolidays = skipHolidays !== undefined
      ? skipHolidays
      : (company?.skipHolidaysOnMultiDay !== undefined ? company.skipHolidaysOnMultiDay : true);

    // Filter and build proposed entry for each date
    const dateEntries = [];

    for (const dObj of allDates) {
      const ds = format(dObj, 'yyyy-MM-dd');
      const dayOfWeek = dObj.getDay(); // 0=Sun, 6=Sat
      const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;

      if (shouldSkipWeekends && isWeekendDay) {
        continue;
      }
      if (shouldSkipHolidays && holidayDateSet.has(ds)) {
        continue;
      }

      let entry = null;
      if (type !== 'CLEAR') {
        if (isSingleDay) {
          let sMode = singleDayMode;
          if (sMode === 'FULL') {
            if (startSession === 'SECOND_HALF') sMode = 'SECOND_HALF';
            else if (startSession === 'FIRST_HALF' || endSession === 'FIRST_HALF') sMode = 'FIRST_HALF';
          }

          if (sMode === 'FIRST_HALF') {
            entry = {
              type,
              leaveType: type === 'LEAVE' ? leaveType : undefined,
              isHalfDay: true,
              halfDaySession: 'FIRST_HALF',
              secondHalfType: 'OFFICE',
              secondHalfLeaveType: null,
              note: note || undefined,
            };
          } else if (sMode === 'SECOND_HALF') {
            entry = {
              type,
              leaveType: type === 'LEAVE' ? leaveType : undefined,
              isHalfDay: true,
              halfDaySession: 'SECOND_HALF',
              secondHalfType: null,
              secondHalfLeaveType: null,
              note: note || undefined,
            };
          } else if (sMode === 'CUSTOM_SPLIT') {
            entry = {
              type,
              leaveType: type === 'LEAVE' ? leaveType : undefined,
              isHalfDay: true,
              halfDaySession: 'CUSTOM_SPLIT',
              secondHalfType: secondHalfType || 'OFFICE',
              secondHalfLeaveType: secondHalfType === 'LEAVE' ? secondHalfLeaveType : null,
              note: note || undefined,
            };
          } else {
            entry = {
              type,
              leaveType: type === 'LEAVE' ? leaveType : undefined,
              isHalfDay: false,
              halfDaySession: null,
              secondHalfType: null,
              secondHalfLeaveType: null,
              note: note || undefined,
            };
          }
        } else {
          // Multi-day range
          if (ds === startDate) {
            if (startSession === 'FIRST_HALF') {
              entry = {
                type,
                leaveType: type === 'LEAVE' ? leaveType : undefined,
                isHalfDay: true,
                halfDaySession: 'FIRST_HALF',
                secondHalfType: 'OFFICE',
                secondHalfLeaveType: null,
                note: note || undefined,
              };
            } else if (startSession === 'SECOND_HALF') {
              entry = {
                type,
                leaveType: type === 'LEAVE' ? leaveType : undefined,
                isHalfDay: true,
                halfDaySession: 'SECOND_HALF',
                secondHalfType: null,
                secondHalfLeaveType: null,
                note: note || undefined,
              };
            } else {
              entry = {
                type,
                leaveType: type === 'LEAVE' ? leaveType : undefined,
                isHalfDay: false,
                halfDaySession: null,
                secondHalfType: null,
                secondHalfLeaveType: null,
                note: note || undefined,
              };
            }
          } else if (ds === endDate) {
            if (endSession === 'FIRST_HALF') {
              entry = {
                type,
                leaveType: type === 'LEAVE' ? leaveType : undefined,
                isHalfDay: true,
                halfDaySession: 'FIRST_HALF',
                secondHalfType: 'OFFICE',
                secondHalfLeaveType: null,
                note: note || undefined,
              };
            } else if (endSession === 'SECOND_HALF') {
              entry = {
                type,
                leaveType: type === 'LEAVE' ? leaveType : undefined,
                isHalfDay: true,
                halfDaySession: 'SECOND_HALF',
                secondHalfType: null,
                secondHalfLeaveType: null,
                note: note || undefined,
              };
            } else {
              entry = {
                type,
                leaveType: type === 'LEAVE' ? leaveType : undefined,
                isHalfDay: false,
                halfDaySession: null,
                secondHalfType: null,
                secondHalfLeaveType: null,
                note: note || undefined,
              };
            }
          } else {
            entry = {
              type,
              leaveType: type === 'LEAVE' ? leaveType : undefined,
              isHalfDay: false,
              halfDaySession: null,
              secondHalfType: null,
              secondHalfLeaveType: null,
              note: note || undefined,
            };
          }
        }
      }

      dateEntries.push({
        dateStr: ds,
        dateObj: dObj,
        entry
      });
    }

    if (dateEntries.length === 0) {
      return res.status(400).json({
        message: 'No eligible dates found in the range (all dates were excluded by weekend or holiday filters).'
      });
    }

    // 1. Validate half-day permissions if type is LEAVE
    if (type === 'LEAVE') {
      const hasHalfDay = dateEntries.some(d => d.entry?.isHalfDay);
      if (hasHalfDay) {
        const ltConfig = company?.leaveTypes?.find(l => l.key === leaveType);
        if (ltConfig && ltConfig.allowHalfDay === false) {
          return res.status(400).json({
            message: `${ltConfig.label} cannot be taken as a half-day leave. Only full-day leave is allowed.`
          });
        }
      }
    }

    // 2. Query all existing entries for user across these dates
    const targetDateStrs = dateEntries.map(d => d.dateStr);
    const existingEntries = await CalendarEntry.find({
      userId: req.user._id,
      date: { $in: targetDateStrs }
    });
    const existingMap = new Map(existingEntries.map(e => [e.date, e]));

    // 3. Group by year and calculate leave balance deltas
    // year -> { leaveKey -> delta }
    const yearLeaveDeltas = {};

    for (const item of dateEntries) {
      const y = item.dateObj.getFullYear();
      if (!yearLeaveDeltas[y]) yearLeaveDeltas[y] = {};

      const oldEntry = existingMap.get(item.dateStr);
      const oldUsage = getLeaveUsageByEntry(oldEntry);
      const newUsage = item.entry ? getLeaveUsageByEntry(item.entry) : {};

      const allKeys = new Set([...Object.keys(oldUsage), ...Object.keys(newUsage)]);
      for (const k of allKeys) {
        const oldU = oldUsage[k] || 0;
        const newU = newUsage[k] || 0;
        const delta = newU - oldU;
        yearLeaveDeltas[y][k] = (yearLeaveDeltas[y][k] || 0) + delta;
      }
    }

    // Check leave balances against availability
    for (const [yStr, deltas] of Object.entries(yearLeaveDeltas)) {
      const year = parseInt(yStr);
      let lb = await LeaveBalance.findOne({ userId: req.user._id, year });
      if (!lb && company) {
        lb = await ensureLeaveBalance(req.user._id, year, company);
      }

      for (const [lk, netDelta] of Object.entries(deltas)) {
        if (netDelta > 0) {
          const ltConfig = company?.leaveTypes?.find(l => l.key === lk);
          if (ltConfig && !ltConfig.unlimited) {
            const balance = lb?.balances?.find(b => b.leaveKey === lk);
            const accrued = getAccrued(ltConfig, year);
            const carried = balance?.carried || 0;
            const available = accrued + carried;
            const currentUsed = balance?.used || 0;

            if (currentUsed + netDelta > available) {
              return res.status(400).json({
                message: `Insufficient leave balance for ${ltConfig.label} in ${year}. Currently used: ${currentUsed}/${available} (${accrued} accrued + ${carried} carried). Marking this range requires ${netDelta} more days.`
              });
            }
          }
        }
      }
    }

    // 4. Validate WFH quota per month if WFH is being added
    const monthWfhDeltas = {}; // 'YYYY-M' -> { newWfh, oldWfh }
    for (const item of dateEntries) {
      const ym = `${item.dateObj.getFullYear()}-${item.dateObj.getMonth() + 1}`;
      if (!monthWfhDeltas[ym]) monthWfhDeltas[ym] = { newWfh: 0, oldWfh: 0 };

      const oldEntry = existingMap.get(item.dateStr);
      monthWfhDeltas[ym].oldWfh += getWfhWeight(oldEntry);
      monthWfhDeltas[ym].newWfh += getWfhWeight(item.entry);
    }

    const maxWfhQuota = company?.wfhPerMonth || 8;
    for (const [ym, wfhInfo] of Object.entries(monthWfhDeltas)) {
      const netWfhDelta = wfhInfo.newWfh - wfhInfo.oldWfh;
      if (netWfhDelta > 0) {
        const [y, m] = ym.split('-').map(Number);
        const otherMonthEntries = await CalendarEntry.find({
          userId: req.user._id,
          year: y,
          month: m,
          date: { $nin: targetDateStrs }
        });
        const currentOtherWfh = otherMonthEntries.reduce((sum, e) => sum + getWfhWeight(e), 0);
        if (currentOtherWfh + wfhInfo.newWfh > maxWfhQuota) {
          return res.status(400).json({
            message: `WFH quota for ${ym} (${maxWfhQuota} days) would be exceeded. You have ${currentOtherWfh} days on other dates, and this range requests ${wfhInfo.newWfh} days.`
          });
        }
      }
    }

    // 5. Database execution (Safe & Atomic per entry)
    if (type === 'CLEAR') {
      await CalendarEntry.deleteMany({
        userId: req.user._id,
        date: { $in: targetDateStrs }
      });
    } else {
      const bulkOps = dateEntries.map(item => ({
        updateOne: {
          filter: { userId: req.user._id, date: item.dateStr },
          update: {
            $set: {
              userId: req.user._id,
              date: item.dateStr,
              type: item.entry.type,
              leaveType: item.entry.leaveType,
              note: item.entry.note,
              year: item.dateObj.getFullYear(),
              month: item.dateObj.getMonth() + 1,
              isHalfDay: !!item.entry.isHalfDay,
              halfDaySession: item.entry.halfDaySession,
              secondHalfType: item.entry.secondHalfType,
              secondHalfLeaveType: item.entry.secondHalfLeaveType,
            }
          },
          upsert: true
        }
      }));
      await CalendarEntry.bulkWrite(bulkOps);
    }

    // 6. Update Leave Balances
    for (const [yStr, deltas] of Object.entries(yearLeaveDeltas)) {
      const year = parseInt(yStr);
      for (const [lk, netDelta] of Object.entries(deltas)) {
        if (netDelta !== 0) {
          await LeaveBalance.findOneAndUpdate(
            { userId: req.user._id, year, 'balances.leaveKey': lk },
            { $inc: { 'balances.$.used': netDelta } }
          );
        }
      }
    }

    // 7. Check for WFH warnings
    const warnings = [];
    if (type === 'WFH') {
      const preferredDays = company?.preferredWfhDays || [4, 5];
      for (const item of dateEntries) {
        if (item.entry?.type === 'WFH') {
          const w = checkWfhWarning(item.dateStr, preferredDays, targetDateStrs);
          if (w.length) warnings.push(...w);
        }
      }
    }

    res.json({
      success: true,
      count: targetDateStrs.length,
      updatedDates: targetDateStrs,
      warnings: warnings.slice(0, 5),
      message: `Successfully marked ${targetDateStrs.length} day(s).`
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;