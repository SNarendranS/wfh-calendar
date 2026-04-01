import express from 'express';
import webpush from 'web-push';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Get notifications
router.get('/', protect, async (req, res) => {
  try {
    const { unreadOnly, limit = 50 } = req.query;
    const filter = { userId: req.user._id };
    if (unreadOnly === 'true') filter.read = false;
    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(parseInt(limit));
    const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });
    res.json({ notifications, unreadCount });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Mark as read
router.patch('/:id/read', protect, async (req, res) => {
  try {
    await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { read: true });
    res.json({ message: 'Marked as read' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Mark all as read
router.patch('/read-all', protect, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
    res.json({ message: 'All marked as read' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delete notification
router.delete('/:id', protect, async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Save push subscription
router.post('/subscribe', protect, async (req, res) => {
  try {
    const { subscription } = req.body;
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { pushSubscriptions: subscription }
    });
    res.json({ message: 'Subscribed' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get VAPID public key
router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
});

export default router;
