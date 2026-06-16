import express from 'express';
import webpush from 'web-push';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { addSseClient } from '../utils/notificationManager.js';

const router = express.Router();

// SSE: Stream notifications in real-time
router.get('/stream', protect, async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial heartbeat
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  addSseClient(req.user._id.toString(), res);

  // Keep-alive every 30s
  const keepAlive = setInterval(() => {
    try {
      res.write(`:keepalive\n\n`);
    } catch {
      clearInterval(keepAlive);
    }
  }, 30000);

  req.on('close', () => clearInterval(keepAlive));
});

// Get notifications
router.get('/', protect, async (req, res) => {
  try {
    const { unreadOnly, limit = 50, category } = req.query;
    const filter = { userId: req.user._id };
    if (unreadOnly === 'true') filter.read = false;
    if (category && category !== 'all') filter.category = category;

    const notifications = await Notification.find(filter)
      .populate('fromUser', 'username displayName avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });

    // Count per category
    const categoryCounts = await Notification.aggregate([
      { $match: { userId: req.user._id, read: false } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    const counts = { all: unreadCount };
    categoryCounts.forEach(c => { counts[c._id] = c.count; });

    res.json({ notifications, unreadCount, categoryCounts: counts });
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
    const { category } = req.body;
    const filter = { userId: req.user._id, read: false };
    if (category && category !== 'all') filter.category = category;
    await Notification.updateMany(filter, { read: true });
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