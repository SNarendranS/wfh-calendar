import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Company from '../models/Company.js';
import LeaveBalance from '../models/LeaveBalance.js';

const router = express.Router();

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, companyName } = req.body;
    if (!username || !email || !password) return res.status(400).json({ message: 'All fields required' });

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) return res.status(400).json({ message: 'User already exists' });

    const user = await User.create({ username, email, password });

    // Create default company
    const company = await Company.create({ name: companyName || `${username}'s Company`, createdBy: user._id });
    user.companyId = company._id;
    await user.save();

    // Init leave balances for current year
    const year = new Date().getFullYear();
    await LeaveBalance.create({
      userId: user._id,
      year,
      balances: company.leaveTypes.map(lt => ({
        leaveKey: lt.key,
        total: lt.yearlyQuota,
        used: 0,
        carried: 0
      }))
    });

    res.status(201).json({ token: signToken(user._id), user: { id: user._id, username, email, companyId: company._id } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    res.json({ token: signToken(user._id), user: { id: user._id, username: user.username, email, companyId: user.companyId } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
