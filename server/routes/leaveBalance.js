import express from 'express';
import LeaveBalance from '../models/LeaveBalance.js';
import Company from '../models/Company.js';
import { protect } from '../middleware/auth.js';

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
          leaveKey: lt.key, total: lt.yearlyQuota, used: 0, carried: 0
        }))
      });
    }
    res.json(lb);
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
