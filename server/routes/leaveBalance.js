import express from 'express';
import LeaveBalance from '../models/LeaveBalance.js';
import Company from '../models/Company.js';
import CalendarEntry from '../models/CalendarEntry.js';
import { protect } from '../middleware/auth.js';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';

const router = express.Router();

router.get('/:year', protect, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    let lb = await LeaveBalance.findOne({ userId: req.user._id, year });
    if (!lb) {
      const company = await Company.findById(req.user.companyId);
      lb = await LeaveBalance.create({
        userId: req.user._id, year,
        balances: (company?.leaveTypes || []).map(lt => ({
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
    enriched.balances = enriched.balances.map(b => ({
      ...b,
      usedThisWeek:  weekMap[b.leaveKey]  || 0,
      usedThisMonth: monthMap[b.leaveKey] || 0,
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
