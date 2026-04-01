import express from 'express';
import Company from '../models/Company.js';
import LeaveBalance from '../models/LeaveBalance.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const company = await Company.findById(req.user.companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    res.json(company);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/', protect, async (req, res) => {
  try {
    const { name, wfhPerMonth, preferredWfhDays, leaveTypes, publicHolidays, workingDays } = req.body;
    const company = await Company.findByIdAndUpdate(
      req.user.companyId,
      { name, wfhPerMonth, preferredWfhDays, leaveTypes, publicHolidays, workingDays },
      { new: true, runValidators: true }
    );

    // Re-sync leave balance totals for current year if leaveTypes changed
    if (leaveTypes) {
      const year = new Date().getFullYear();
      let lb = await LeaveBalance.findOne({ userId: req.user._id, year });
      if (lb) {
        lb.balances = leaveTypes.map(lt => {
          const existing = lb.balances.find(b => b.leaveKey === lt.key);
          return { leaveKey: lt.key, total: lt.yearlyQuota, used: existing?.used || 0, carried: existing?.carried || 0 };
        });
        await lb.save();
      }
    }

    res.json(company);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

export default router;
